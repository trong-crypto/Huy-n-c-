import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapSession } from "@/services/rest/history";
import { RestError } from "@/services/rest/transport";
import { SessionNotice, SessionProvider, useSession } from "./SessionProvider";
import { sessionSocketTarget } from "./socketIdentity";

vi.mock("@/services/rest/history", async original => ({ ...await original<typeof import("@/services/rest/history")>(), bootstrapSession: vi.fn() }));
const bootstrap = vi.mocked(bootstrapSession);
const session = () => ({ expiresAt: new Date(Date.now() + 60_000).toISOString(), csrfToken: "a".repeat(64) });
function Probe() {
  const value = useSession(); return <><p data-testid="session-state">{value?.status}</p><button onClick={() => value?.handleError(new RestError("INVALID_SESSION"))}>Expire</button><button onClick={() => value?.handleError(new RestError("CSRF_REJECTED"))}>Reject CSRF</button><SessionNotice /></>;
}
beforeEach(() => { bootstrap.mockReset().mockResolvedValue(session()); });
describe("H01 React-memory session lifecycle", () => {
  it("single-flights StrictMode initialization and never exposes tokens in DOM/storage/logs", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log");
    render(<StrictMode><SessionProvider><Probe /></SessionProvider></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("ready"));
    expect(bootstrap).toHaveBeenCalledTimes(1); expect(document.body.textContent).not.toContain("a".repeat(64)); expect(local).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it("fails honestly and allows only explicit bootstrap retry", async () => {
    bootstrap.mockRejectedValueOnce(new RestError("DATABASE_UNAVAILABLE")); render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("failed")); expect(bootstrap).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại phiên" })); await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("ready")); expect(bootstrap).toHaveBeenCalledTimes(2);
  });
  it.each(["Expire", "Reject CSRF"])("invalidates sensitive state for %s without automatic retry", async action => {
    render(<SessionProvider><Probe /></SessionProvider>); await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("ready"));
    fireEvent.click(screen.getByRole("button", { name: action })); expect(screen.getByTestId("session-state").textContent).toBe("invalid"); expect(bootstrap).toHaveBeenCalledTimes(1);
  });
  it("expires locally when the server expiry passes", async () => {
    vi.useFakeTimers(); bootstrap.mockResolvedValue({ ...session(), expiresAt: new Date(Date.now() + 1000).toISOString() });
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    render(<SessionProvider><Probe /></SessionProvider>); await act(async () => {});
    expect(screen.getByTestId("session-state").textContent).toBe("ready"); clock.mockReturnValue(now + 1001);
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); }); expect(screen.getByTestId("session-state").textContent).toBe("invalid");
  });
  it("rejects an already expired session instead of treating it as an owner", async () => {
    bootstrap.mockResolvedValue({ ...session(), expiresAt: "2000-01-01T00:00:00Z" }); render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("invalid"));
  });
  it("aborts bootstrap on real unmount", async () => {
    bootstrap.mockReturnValue(new Promise(() => {})); const { unmount } = render(<SessionProvider><Probe /></SessionProvider>);
    const signal = bootstrap.mock.calls[0][0]; unmount(); await act(async () => {}); expect(signal.aborted).toBe(true);
  });
  it("aligns only loopback aliases and keeps unrelated hosts unbound", () => {
    expect(sessionSocketTarget("http://127.0.0.1:3173").cookieCompatible).toBe(true);
    expect(sessionSocketTarget("http://127.0.0.1:3173").url).toContain("127.0.0.1");
    expect(sessionSocketTarget("https://different.example").cookieCompatible).toBe(false);
  });
});
