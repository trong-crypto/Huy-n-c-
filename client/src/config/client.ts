// Client defaults, not permanent business rules. Progress does not extend this timeout.
export const CLIENT_CONFIG = Object.freeze({
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  restTimeoutMs: 10_000,
  hexagramPageSize: 20,
  requestTimeoutMs: 15_000,
  connectionTimeoutMs: 10_000,
  reconnectDelayMs: 3_000,
  protocolNoticeMs: 6_000,
});
