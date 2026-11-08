import { CLIENT_CONFIG } from "@/config/client";
export function sessionSocketTarget(origin: string) {
  const page = new URL(origin);
  const scheme = page.protocol === "https:" ? "wss:" : "ws:";
  const socket = CLIENT_CONFIG.accountHistory ? new URL(`${scheme}//${page.host}/api/v1/ws`) : new URL(CLIENT_CONFIG.wsUrl);
  const loopback = (host: string) => host === "localhost" || host === "127.0.0.1";
  if (loopback(page.hostname) && loopback(socket.hostname)) socket.hostname = page.hostname;
  const cookieCompatible = socket.hostname === page.hostname && socket.protocol === scheme;
  return { url: socket.href, cookieCompatible };
}
