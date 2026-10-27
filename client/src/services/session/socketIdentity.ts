import { CLIENT_CONFIG } from "@/config/client";
export function sessionSocketTarget(origin: string) {
  const page = new URL(origin); const socket = new URL(CLIENT_CONFIG.wsUrl);
  const loopback = (host: string) => host === "localhost" || host === "127.0.0.1";
  if (loopback(page.hostname) && loopback(socket.hostname)) socket.hostname = page.hostname;
  const cookieCompatible = socket.hostname === page.hostname && socket.protocol === (page.protocol === "https:" ? "wss:" : "ws:");
  return { url: socket.href, cookieCompatible };
}
