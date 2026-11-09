import { expect, it } from "vitest";
import examples from "../../../docs/examples/chat-v1.json";
import { readChatEvent, type Conversation } from "./chatContract";

const room = examples.c5.data as Conversation;

it("accepts the shared C7 fixtures and preserves the C8 sequence exactly", () => {
  for (const key of ["c7Ack", "c7Message", "c7Error", "c7UncorrelatedError"] as const) {
    expect(readChatEvent(examples[key], room)).toEqual(examples[key]);
  }
  expect(readChatEvent(examples.c7Ack, room)?.type).toBe("ACK");
  expect(examples.c7Ack.sequence).toBe(examples.c8.data.nextAfterSequence);
  expect(examples.c7Ack.sequence).toBe("9007199254740993");
});

it("rejects an ACK without correlation, another room or an unsupported error code", () => {
  expect(readChatEvent({ ...examples.c7Ack, clientMessageId: null }, room)).toBeNull();
  expect(readChatEvent({ ...examples.c7Ack, sequence: 1 }, room)).toBeNull();
  expect(readChatEvent({ ...examples.c7Ack, sequence: "9223372036854775808" }, room)).toBeNull();
  expect(readChatEvent({ ...examples.c7Ack, conversationId: examples.c2.data.consultantId }, room)).toBeNull();
  expect(readChatEvent({ ...examples.c7Error, code: "STOMP_FRAME_REJECTED" }, room)).toBeNull();
});
