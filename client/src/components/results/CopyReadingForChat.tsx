"use client";

import { useState } from "react";
import { draftLimit } from "@/components/chat/chatState";

export function CopyReadingForChat({ text }: { text: string }) {
  const cleanText = text.replaceAll("\0", "");
  const suffix = "\n… (đã rút gọn để gửi qua chat)";
  const message = cleanText.length > draftLimit
    ? cleanText.slice(0, draftLimit - suffix.length).replace(/[\uD800-\uDBFF]$/, "").trimEnd() + suffix
    : cleanText;
  const [feedback, setFeedback] = useState<{ message: string; copied: boolean }>();
  const current = feedback?.message === message ? feedback : undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setFeedback({ message, copied: true });
    } catch {
      setFeedback({ message, copied: false });
    }
  }

  return <div>
    <button type="button" className="secondary-button" onClick={copy}>Sao chép lá số để gửi tư vấn</button>
    {current && <p role="status" className="field-hint">{current.copied
      ? "Đã sao chép. Mở cuộc trò chuyện đang hoạt động, dán vào ô Tin nhắn rồi bấm Gửi."
      : "Trình duyệt không cho sao chép tự động. Chọn nội dung bên dưới để sao chép thủ công."}</p>}
    {current && !current.copied && <textarea aria-label="Nội dung lá số để sao chép" readOnly rows={6}
      value={message} onFocus={event => event.currentTarget.select()} />}
  </div>;
}
