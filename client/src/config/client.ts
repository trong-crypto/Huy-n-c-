// Client defaults, not permanent business rules. Progress does not extend this timeout.
export const CLIENT_CONFIG = Object.freeze({
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws",
  requestTimeoutMs: 15_000,
  connectionTimeoutMs: 10_000,
  reconnectDelayMs: 3_000,
  protocolNoticeMs: 6_000,
});
