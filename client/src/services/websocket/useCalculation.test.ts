import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { CLIENT_CONFIG } from "@/config/client";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { MaiHoaPayload } from "@/types/contract";

type Message = { body: string };
type Publish = { destination: string; body: string; headers: Record<string, string> };
type Subscription = { destination: string; callback: (message: Message) => void; unsubscribe: Mock<() => void> };
type MockConfig = {
  brokerURL: string;
  reconnectDelay: number;
  connectionTimeout: number;
  onConnect: () => void;
  onWebSocketClose: () => void;
  onStompError: () => void;
};
type MockClient = {
  config: MockConfig;
  connected: boolean;
  subscriptions: Subscription[];
  activate: Mock<() => void>;
  deactivate: Mock<(options?: { force?: boolean }) => Promise<void>>;
  publish: Mock<(message: Publish) => void>;
  subscribe: Mock<(destination: string, callback: (message: Message) => void) => Subscription>;
};

const stomp = vi.hoisted(() => ({ instances: [] as MockClient[] }));
vi.mock("@stomp/stompjs", () => ({
  Client: class {
    connected = false;
    subscriptions: Subscription[] = [];
    activate = vi.fn<() => void>();
    deactivate = vi.fn<(options?: { force?: boolean }) => Promise<void>>(() => {
      this.connected = false;
      return Promise.resolve();
    });
    publish = vi.fn<(message: Publish) => void>();
    subscribe = vi.fn((destination: string, callback: (message: Message) => void) => {
      const subscription = { destination, callback, unsubscribe: vi.fn<() => void>() };
      this.subscriptions.push(subscription);
      return subscription;
    });
    constructor(public config: MockConfig) {
      stomp.instances.push(this);
    }
  },
}));

import objects from "../../../../docs/examples/mai-hoa-object-count.response.json";

// Canonical Server result fixture; tests do not assert source verification themselves.
const payload: MaiHoaPayload = { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8 };
const foreignId = "550e8400-e29b-41d4-a716-999999999999";
const completed = (requestId: string, data: NonNullable<unknown> = objects.data) => ({ requestId, type: "MAI_HOA", status: "COMPLETED", data, error: null });
const failed = (requestId: string, code = "RULE_NOT_AVAILABLE") => ({ requestId, type: "MAI_HOA", status: "FAILED", data: null, error: { code, message: "Lỗi thử nghiệm.", ruleCode: null, reason: "IMPLEMENTATION_UNAVAILABLE" } });

function connect(client: MockClient) {
  act(() => { client.connected = true; client.config.onConnect(); });
}

function disconnect(client: MockClient) {
  act(() => { client.connected = false; client.config.onWebSocketClose(); });
}

function mount(connected = true) {
  const hook = renderHook(() => useCalculation());
  const client = stomp.instances.at(-1)!;
  if (connected) connect(client);
  return { ...hook, client };
}

function emit(client: MockClient, value: unknown, destination = "/user/queue/results") {
  const subscription = client.subscriptions.filter((item) => item.destination === destination).at(-1)!;
  act(() => subscription.callback({ body: JSON.stringify(value) }));
}

function lastId(client: MockClient) {
  return JSON.parse(client.publish.mock.calls.at(-1)![0].body).requestId as string;
}

function progress(client: MockClient, sequence: number, changes: Record<string, unknown> = {}) {
  emit(client, {
    requestId: lastId(client), type: "MAI_HOA", sequence,
    step: ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"][sequence - 1],
    message: `Stage ${sequence}`, ...changes,
  }, "/user/queue/progress");
}

beforeEach(() => {
  vi.useFakeTimers();
  stomp.instances.length = 0;
  let id = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `550e8400-e29b-41d4-a716-${String(++id).padStart(12, "0")}`);
});

describe("useCalculation safe core", () => {
  it("T26 localizes a malformed correlated progress frame and releases the request deadline", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    progress(client, 1, { sequence: "invalid" });
    expect(result.current.localError).toBe("INVALID_RESPONSE: Thông điệp tiến trình không đúng hợp đồng.");
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("E03 settles a correlated future Server failure without a local protocol error", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    const failure = { ...failed(lastId(client), "FUTURE_CODE"), error: { code: "FUTURE_CODE", message: "safe", ruleCode: null, reason: "FUTURE_REASON" } };
    emit(client, failure, "/user/queue/errors");
    expect(result.current.response).toEqual(failure);
    expect(result.current.localError).toBeNull();
    expect(result.current.requestState).toBe("failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, undefined, "not-a-uuid", 4])("E09/E10 notice for ID %j does not clear or extend the request deadline", requestId => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(14_999));
    emit(client, { ...failed(lastId(client)), requestId }, "/user/queue/errors");
    expect(result.current.requestState).toBe("waiting");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toBeNull();
    expect(result.current.protocolNotice).toContain("không có mã yêu cầu hợp lệ");
    expect(vi.getTimerCount()).toBe(2); // Original request deadline + bounded notice.
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.localError).toContain("REQUEST_TIMEOUT");
    expect(result.current.protocolNotice).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("E11 notices with null ID/type cannot replace an existing completed result", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client)));
    const response = result.current.response;
    emit(client, { ...failed(lastId(client)), requestId: null, type: null }, "/user/queue/errors");
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response).toBe(response);
    expect(result.current.localError).toBeNull();
    expect(result.current.protocolNotice).not.toBeNull();
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.protocolNoticeMs));
    expect(result.current.protocolNotice).toBeNull();
    expect(result.current.response).toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("E12 a valid response after a generic notice clears it and completes the original pending request", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    const id = lastId(client);
    emit(client, { ...failed(id), requestId: null }, "/user/queue/errors");
    emit(client, completed(id));
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response?.requestId).toBe(id);
    expect(result.current.protocolNotice).toBeNull();
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("new manual submission clears idle notices without correlating null with null", () => {
    const { result, client } = mount();
    emit(client, { ...failed(foreignId), requestId: null, type: null }, "/user/queue/errors");
    expect(result.current.requestState).toBe("idle");
    expect(result.current.response).toBeNull();
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.protocolNotice).toBeNull();
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("notice bursts cannot extend their lifetime or allocate additional timers", () => {
    const { result, client } = mount();
    const value = { ...failed(foreignId), requestId: null };
    emit(client, value, "/user/queue/errors");
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.protocolNoticeMs - 1));
    emit(client, value, "/user/queue/errors");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.protocolNotice).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not classify malformed or wrong-destination messages as generic Server errors", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    for (const value of [
      { ...failed(foreignId), requestId: null, error: {} },
      { ...failed(foreignId), requestId: null, data: {} },
      { ...failed(foreignId), requestId: null, type: "OTHER" },
    ]) emit(client, value, "/user/queue/errors");
    emit(client, { ...failed(foreignId), requestId: null }, "/user/queue/progress");
    emit(client, failed(foreignId), "/user/queue/errors");
    expect(result.current.protocolNotice).toBeNull();
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("E17 old subscription/notice timer callbacks cannot contaminate a newer connection or notice", () => {
    const { result, client } = mount();
    const oldSubscription = client.subscriptions.find(s => s.destination === "/user/queue/errors")!;
    const timers = vi.spyOn(globalThis, "setTimeout");
    emit(client, { ...failed(foreignId), requestId: null }, "/user/queue/errors");
    const oldTimer = timers.mock.calls.at(-1)![0];
    disconnect(client);
    expect(result.current.protocolNotice).toBeNull();
    connect(client);
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => oldSubscription.callback({ body: JSON.stringify({ ...failed(foreignId), requestId: null }) }));
    expect(result.current.protocolNotice).toBeNull();
    emit(client, { ...failed(foreignId), requestId: null }, "/user/queue/errors");
    if (typeof oldTimer !== "function") throw new Error("Expected notice timer");
    act(() => oldTimer());
    expect(result.current.protocolNotice).not.toBeNull();
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(2);
  });

  it("unmount clears notice timers and blocks their retained callbacks", () => {
    const { result, client, unmount } = mount();
    const timers = vi.spyOn(globalThis, "setTimeout");
    emit(client, { ...failed(foreignId), requestId: null }, "/user/queue/errors");
    const callback = timers.mock.calls.at(-1)![0];
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    if (typeof callback !== "function") throw new Error("Expected notice timer");
    act(() => callback());
    expect(result.current.requestState).toBe("idle");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("E13/E16 uses three distinct configured timing policies", () => {
    const { client } = mount();
    expect(client.config.connectionTimeout).toBe(10_000);
    expect(client.config.reconnectDelay).toBe(3_000);
    expect(CLIENT_CONFIG.requestTimeoutMs).toBe(15_000);
  });
  it("keeps ordered progress and metadata, ignores duplicates and late progress", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    for (let sequence = 1; sequence <= 4; sequence++) progress(client, sequence);
    progress(client, 2);
    expect(result.current.progress.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
    emit(client, completed(lastId(client)));
    progress(client, 5);
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response?.data).toEqual(objects.data);
    expect(result.current.progress).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("progress never extends the total timeout and the next request starts clean", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs - 1));
    progress(client, 1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.progress).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.progress).toEqual([]);
    expect(result.current.localError).toBeNull();
  });

  it.each([{ sequence: 2 }, { sequence: 1, step: "LOOKUP" }, { sequence: "1" }])("fails correlated invalid progress without retaining a timer: %j", changes => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    progress(client, 1, changes);
    expect(result.current.requestState).toBe("failed");
    expect(result.current.localError).toContain("INVALID_RESPONSE");
    expect(result.current.response).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("failed");
  });

  it("rejects other IDs, modules and stale connection progress; disconnect retains actual stages", () => {
    const { result, client } = mount();
    const old = client.subscriptions.find(s => s.destination === "/user/queue/progress")!;
    act(() => result.current.submit("MAI_HOA", payload));
    progress(client, 1, { requestId: foreignId });
    progress(client, 1, { type: "TAM_THE" });
    expect(result.current.progress).toEqual([]);
    progress(client, 1);
    disconnect(client);
    expect(result.current.progress).toHaveLength(1);
    connect(client);
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => old.callback({ body: JSON.stringify({ requestId: lastId(client), type: "MAI_HOA", sequence: 1, step: "ACCEPTED", message: "stale" }) }));
    expect(result.current.progress).toEqual([]);
    progress(client, 1);
    expect(result.current.progress).toHaveLength(1);
  });

  it("T01 completes matching success and clears its timer", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response?.status).toBe("COMPLETED");
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs));
    expect(result.current.requestState).toBe("completed");
  });

  it.each(["INVALID_INPUT", "INVALID_DATE", "INVALID_METHOD", "RULE_NOT_AVAILABLE", "SERVER_BUSY", "INTERNAL_ERROR", "PROCESSING_TIMEOUT", "DATABASE_UNAVAILABLE", "KNOWLEDGE_DATA_INCOMPLETE"])("T02 retains matching Server failure %s", (code) => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, failed(lastId(client), code), "/user/queue/errors");
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response?.error?.code).toBe(code);
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, foreignId])("T03 ignores incoming final without pending: %j", (requestId) => {
    const { result, client } = mount();
    emit(client, { ...completed(foreignId), requestId });
    expect(result.current.requestState).toBe("idle");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T04 ignores wrong requestId without clearing or extending the timer", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs - 1));
    emit(client, completed(foreignId));
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestState).toBe("timeout");
  });

  it.each([null, "not-a-uuid"])("never completes pending for invalid incoming ID %j", (requestId) => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, { ...completed(lastId(client)), requestId });
    expect(result.current.requestState).toBe("waiting");
    expect(result.current.response).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("T05 ignores matching requestId with wrong type", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, { ...completed(lastId(client)), type: "TAM_THE" });
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
  });

  it("T06 ignores malformed JSON and still accepts a later valid final", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => client.subscriptions[0].callback({ body: "{broken-json" }));
    expect(result.current.requestState).toBe("waiting");
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T06 malformed frames do not extend the request deadline", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs - 1));
    act(() => client.subscriptions[0].callback({ body: "{broken-json" }));
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestState).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, [], false, 0, "text", {}].map((value) => [value]))("T07 ignores uncorrelatable JSON %j", (value) => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, value);
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("T07 terminates an invalid but correlated envelope as local failure", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, { requestId: lastId(client), type: "MAI_HOA", status: "OTHER" });
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toContain("Lỗi giao thức phía Client");
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(client.publish).toHaveBeenCalledTimes(2);
  });

  it("T08 rejects correlated COMPLETED with a non-null error", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, { ...completed(lastId(client)), error: failed(lastId(client)).error });
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toContain("Lỗi giao thức");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T09 rejects correlated FAILED with non-null data", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, { ...failed(lastId(client)), data: false });
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toContain("Lỗi giao thức");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T10 ignores duplicate final without replacing the first result", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client)));
    emit(client, completed(lastId(client), { ...objects.data, calculationSteps: [] }));
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response?.data).toEqual(objects.data);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T11 ignores a final received after timeout", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs));
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.response).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T12 blocks a second submit synchronously", () => {
    const { result, client } = mount();
    act(() => {
      result.current.submit("MAI_HOA", payload);
      result.current.submit("TAM_THE", { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false });
    });
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
  });

  it("T13 releases pending and timer on publish throw without reusing its ID", () => {
    const { result, client } = mount();
    client.publish.mockImplementationOnce(() => { throw new Error("send failed"); });
    act(() => result.current.submit("MAI_HOA", payload));
    const firstId = lastId(client);
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toContain("Server có thể đã nhận");
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(lastId(client)).not.toBe(firstId);
    expect(client.publish).toHaveBeenCalledTimes(2);
    expect(result.current.requestState).toBe("waiting");
  });

  it("T14 terminates pending on disconnect", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    disconnect(client);
    expect(result.current.connection).toBe("disconnected");
    expect(result.current.requestState).toBe("failed");
    expect(result.current.localError).toContain("DISCONNECTED");
    expect(vi.getTimerCount()).toBe(0);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("failed");
  });

  it("T15 reconnects subscriptions without resending failed pending", () => {
    const { result, client } = mount();
    expect(client.config.reconnectDelay).toBe(CLIENT_CONFIG.reconnectDelayMs);
    expect(client.subscribe).toHaveBeenCalledTimes(3);
    act(() => result.current.submit("MAI_HOA", payload));
    disconnect(client);
    connect(client);
    expect(result.current.connection).toBe("connected");
    expect(result.current.requestState).toBe("failed");
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(client.subscribe).toHaveBeenCalledTimes(6);
    connect(client); // Duplicate CONNECTED callback is not a new connection.
    expect(client.subscribe).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T15 does not resend a timed-out request on reconnect", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs));
    disconnect(client);
    connect(client);
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.connection).toBe("connected");
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T16 unmount clears timer, unsubscribes and deactivates without revival", () => {
    const { result, client, unmount } = mount();
    const submit = result.current.submit;
    act(() => submit("MAI_HOA", payload));
    const subscriptions = [...client.subscriptions];
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(client.deactivate).toHaveBeenCalledExactlyOnceWith({ force: true });
    subscriptions.forEach((item) => expect(item.unsubscribe).toHaveBeenCalledOnce());
    act(() => {
      client.config.onConnect();
      client.config.onWebSocketClose();
      client.config.onStompError();
      subscriptions[0].callback({ body: "broken" });
      submit("MAI_HOA", payload);
    });
    expect(stomp.instances).toHaveLength(1);
    expect(client.activate).toHaveBeenCalledOnce();
    expect(client.subscribe).toHaveBeenCalledTimes(3);
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("T17 rejects old effect/Client callbacks after StrictMode setup-cleanup-setup", () => {
    const { result } = renderHook(() => useCalculation(), { wrapper: StrictMode });
    expect(stomp.instances).toHaveLength(2);
    const old = stomp.instances[0];
    const current = stomp.instances[1];
    connect(current);
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => {
      old.config.onConnect();
      old.config.onStompError();
      old.config.onWebSocketClose();
    });
    expect(result.current.connection).toBe("connected");
    expect(result.current.requestState).toBe("waiting");
    expect(old.subscribe).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    emit(current, completed(lastId(current)));
    expect(result.current.requestState).toBe("completed");
  });

  it("T17 rejects old subscription callbacks after reconnect even with the new ID", () => {
    const { result, client } = mount();
    const old = client.subscriptions[0];
    disconnect(client);
    connect(client);
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => old.callback({ body: JSON.stringify(completed(lastId(client))) }));
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
  });

  it("T17 rejects an old timer callback while a new request is waiting", () => {
    const { result, client } = mount();
    const timer = vi.spyOn(globalThis, "setTimeout");
    act(() => result.current.submit("MAI_HOA", payload));
    const oldCallback = timer.mock.calls[0][0];
    emit(client, completed(lastId(client)));
    act(() => result.current.submit("MAI_HOA", payload));
    if (typeof oldCallback !== "function") throw new Error("Expected timer callback");
    act(() => oldCallback());
    expect(result.current.requestState).toBe("waiting");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("T18 times out at the configured boundary and allows a new manual request", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    const firstId = lastId(client);
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.requestTimeoutMs - 1));
    expect(result.current.requestState).toBe("waiting");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.localError).toContain(`${CLIENT_CONFIG.requestTimeoutMs / 1000} giây`);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(CLIENT_CONFIG.reconnectDelayMs * 2));
    expect(client.publish).toHaveBeenCalledTimes(1);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(lastId(client)).not.toBe(firstId);
    expect(client.publish).toHaveBeenCalledTimes(2);
    expect(result.current.requestState).toBe("waiting");
  });

  it("T19 accepted new submit clears previous response and error", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client)));
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toBeNull();
    disconnect(client);
    expect(result.current.localError).not.toBeNull();
    connect(client);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.requestState).toBe("waiting");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toBeNull();
  });

  it("T20 ignores late old final after local failure and clears stale error on later success", () => {
    const { result, client } = mount();
    client.publish.mockImplementationOnce(() => { throw new Error("send failed"); });
    act(() => result.current.submit("MAI_HOA", payload));
    const oldId = lastId(client);
    emit(client, completed(oldId));
    expect(result.current.requestState).toBe("failed");
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(oldId));
    expect(result.current.requestState).toBe("waiting");
    emit(client, completed(lastId(client)));
    expect(result.current.requestState).toBe("completed");
    expect(result.current.localError).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a synchronous final inside publish without leaving a timer behind", () => {
    const { result, client } = mount();
    client.publish.mockImplementationOnce((message) => {
      client.subscriptions[0].callback({ body: JSON.stringify(completed(JSON.parse(message.body).requestId)) });
    });
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.requestState).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, 0])("rejects opaque data as an invalid business response %j", (data) => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client), data));
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("routes TAM_THE with the same envelope matching rules", () => {
    const { result, client } = mount();
    act(() => result.current.submit("TAM_THE", { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false }));
    expect(client.publish.mock.calls[0][0].destination).toBe("/app/tam-the/calculate");
    emit(client, { ...failed(lastId(client)), type: "TAM_THE" });
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response?.error?.reason).toBe("IMPLEMENTATION_UNAVAILABLE");
  });

  it("does not corrupt a completed response on an idle disconnect", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    emit(client, completed(lastId(client)));
    const response = result.current.response;
    disconnect(client);
    expect(result.current.connection).toBe("disconnected");
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response).toBe(response);
    expect(result.current.localError).toBeNull();
  });

  it("terminates pending as local failure on active STOMP ERROR", () => {
    const { result, client } = mount();
    act(() => result.current.submit("MAI_HOA", payload));
    act(() => client.config.onStompError());
    expect(result.current.requestState).toBe("failed");
    expect(result.current.response).toBeNull();
    expect(result.current.localError).toContain("STOMP phía Client");
    expect(result.current.connection).toBe("connected"); // No socket-close event yet.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not publish while disconnected and clears that local error on new submit", () => {
    const { result, client } = mount(false);
    expect(result.current.connection).toBe("connecting");
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.requestState).toBe("failed");
    expect(result.current.localError).toContain("DISCONNECTED");
    expect(client.publish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    connect(client);
    act(() => result.current.submit("MAI_HOA", payload));
    expect(result.current.localError).toBeNull();
  });

  it("keeps a serialized in-memory input copy without mutating the caller", () => {
    const { result, client } = mount();
    const input: MaiHoaPayload = { method: "LINES", linesBottomUp: [true, false, true, false, true, false], movingLine: 2 };
    act(() => result.current.submit("MAI_HOA", input));
    input.linesBottomUp[0] = false;
    input.movingLine = 6;
    const sent = JSON.parse(client.publish.mock.calls[0][0].body);
    expect(sent.payload.linesBottomUp[0]).toBe(true);
    expect(sent.payload.movingLine).toBe(2);
  });

  it("handles deactivate rejection after unmount without an unhandled error", async () => {
    const { client, unmount } = mount();
    client.deactivate.mockRejectedValueOnce(new Error("teardown failed"));
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still deactivates if unsubscribe races with a socket close", () => {
    const { client, unmount } = mount();
    client.subscriptions[0].unsubscribe.mockImplementationOnce(() => { throw new Error("socket closed"); });
    unmount();
    expect(client.deactivate).toHaveBeenCalledOnce();
    expect(client.subscriptions[1].unsubscribe).toHaveBeenCalledOnce();
  });
});
