"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { getCustomerSession } from "@/services/rest/customerAuth";
import { RestError } from "@/services/rest/transport";
import { chatRoutes } from "@/components/chat/chatState";
import { chatRequestId } from "@/components/chat/useRoomChat";
import { readingMessage, storeReadingHandoff } from "@/components/chat/readingHandoff";

export function CopyReadingForChat({ text }: { text: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function openConsultation() {
    if (pending.current) return;
    const message = readingMessage(text);
    const controller = new AbortController();
    pending.current = controller;
    setNotice("");
    setLogin(false);
    setBusy(true);
    try {
      if (!CLIENT_CONFIG.accountHistory) {
        await navigator.clipboard.writeText(message);
        if (!controller.signal.aborted) setNotice("Đã sao chép lá số.");
        return;
      }
      const { account } = await getCustomerSession(controller.signal);
      if (controller.signal.aborted) return;
      if (account.role !== "USER") {
        setNotice("Cần tài khoản người dùng để gửi yêu cầu tư vấn.");
        return;
      }
      storeReadingHandoff({ accountId: account.id, messageId: chatRequestId(), text: message });
      void Promise.resolve().then(() => navigator.clipboard?.writeText(message)).catch(() => {});
      router.push(chatRoutes.user);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof RestError && ["INVALID_SESSION", "LOGIN_REQUIRED"].includes(error.code)) {
        setNotice("Hãy đăng nhập rồi mở lại kết quả để gửi tư vấn.");
        setLogin(true);
      } else {
        setNotice("Chưa thể chuẩn bị lá số để chuyển sang tư vấn. Vui lòng thử lại.");
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  return <div>
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void openConsultation()}>
      {busy ? "Đang mở tư vấn…" : "Sao chép lá số để gửi tư vấn"}
    </button>
    {notice && <p role="status" className="field-hint">{notice} {login && <Link href={customerAuthRoutes.login}>Đăng nhập</Link>}</p>}
  </div>;
}
