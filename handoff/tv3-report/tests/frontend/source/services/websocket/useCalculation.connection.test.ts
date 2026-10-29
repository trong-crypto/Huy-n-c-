import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCalculation } from "./useCalculation";
import { CLIENT_CONFIG } from "@/config/client";
import objects from "../../../../docs/examples/mai-hoa-object-count.response.json";

// Exercise installed stompjs itself. Only the WebSocket boundary is simulated.
class TestSocket {
  static instances: TestSocket[] = [];
  readyState = 0;
  binaryType = "arraybuffer";
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send = vi.fn<(frame: string) => void>();
  close = vi.fn(() => {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  });
  terminate = () => this.close();
  constructor(public url: string) { TestSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(data: string) { this.onmessage?.({ data }); }
  connected() { this.open(); this.receive("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0"); }
  terminal(value: unknown) {
    const subscription = this.send.mock.calls.map(([frame]) => frame)
      .find(frame => frame.startsWith("SUBSCRIBE\n") && frame.includes("destination:/user/queue/results"));
    const id = subscription?.match(/\nid:([^\n]+)/)?.[1];
    if (!id) throw new Error("Expected real STOMP result subscription");
    this.receive(`MESSAGE\nsubscription:${id}\nmessage-id:test-message\ndestination:/user/queue/results\n\n${JSON.stringify(value)}\0`);
  }
  requests() { return this.send.mock.calls.map(([frame]) => frame).filter(frame => frame.startsWith("SEND\n")); }
}

beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal("WebSocket", TestSocket);
});

async function mount() {
  const hook = renderHook(() => useCalculation());
  await act(async () => {}); // stompjs awaits beforeConnect, including its default no-op.
  return { ...hook, socket: TestSocket.instances.at(-1)! };
}
async function advance(ms: number) { await act(async () => { vi.advanceTimersByTime(ms); }); }
const payload = { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8 } as const;

describe("installed stompjs connection timeout and reconnect policy", () => {
  it.each([false, true])("E13/E14 closes an attempt at 10 seconds (socket open=%s), without publishing", async open => {
    const { result, socket, unmount } = await mount();
    if (open) act(() => socket.open()); // TCP/WS open without STOMP CONNECTED still times out.
    await advance(9_999);
    expect(result.current.connection).toBe("connecting");
    expect(socket.close).not.toHaveBeenCalled();
    await advance(1);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(result.current.connection).toBe("disconnected");
    expect(result.current.requestState).toBe("idle");
    expect(result.current.localError).toBeNull();
    expect(socket.requests()).toHaveLength(0);
    await advance(2_999);
    expect(TestSocket.instances).toHaveLength(1);
    await advance(1);
    expect(TestSocket.instances).toHaveLength(2);
    const second = TestSocket.instances[1];
    await advance(9_999);
    expect(second.close).not.toHaveBeenCalled();
    await advance(1);
    expect(second.close).toHaveBeenCalledOnce();
    expect(second.requests()).toHaveLength(0);
    unmount();
    await advance(20_000);
    expect(TestSocket.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("E16 CONNECTED cancels the connection watcher; request deadline stays 15 seconds", async () => {
    const { result, socket } = await mount();
    await advance(9_999);
    act(() => socket.connected());
    expect(result.current.connection).toBe("connected");
    act(() => result.current.submit("MAI_HOA", payload));
    await advance(CLIENT_CONFIG.connectionTimeoutMs);
    expect(socket.close).not.toHaveBeenCalled();
    expect(result.current.requestState).toBe("waiting");
    await advance(4_999);
    expect(result.current.requestState).toBe("waiting");
    await advance(1);
    expect(result.current.requestState).toBe("timeout");
    expect(result.current.localError).toContain("REQUEST_TIMEOUT");
    expect(result.current.response).toBeNull();
    expect(socket.requests()).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("E15 reconnect attempt timeout preserves a completed result and never resends it", async () => {
    const { result, socket } = await mount();
    act(() => socket.connected());
    act(() => result.current.submit("MAI_HOA", payload));
    const sent = socket.requests()[0];
    const body = JSON.parse(sent.slice(sent.indexOf("\n\n") + 2).replace(/\0$/, ""));
    act(() => socket.terminal({ ...objects, requestId: body.requestId }));
    expect(result.current.requestState).toBe("completed");
    const response = result.current.response;
    act(() => socket.close());
    await advance(3_000);
    await advance(10_000);
    expect(result.current.connection).toBe("disconnected");
    expect(result.current.requestState).toBe("completed");
    expect(result.current.response).toBe(response);
    expect(result.current.localError).toBeNull();
    expect(TestSocket.instances.flatMap(item => item.requests())).toHaveLength(1);
  });

  it("E17 unmount during connect cannot reconnect or affect a replacement hook", async () => {
    const old = await mount();
    old.unmount();
    const current = await mount();
    act(() => current.socket.connected());
    act(() => current.result.current.submit("MAI_HOA", payload));
    await advance(10_000); // Let the old library watcher expire; it owns only its old Client.
    expect(current.result.current.connection).toBe("connected");
    expect(current.result.current.requestState).toBe("waiting");
    expect(current.socket.close).not.toHaveBeenCalled();
    expect(TestSocket.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1); // Only the current request deadline.
    current.unmount();
    await advance(20_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
