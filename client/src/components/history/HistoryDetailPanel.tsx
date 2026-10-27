"use client";
import { useCallback } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { SessionNotice, useSession } from "@/services/session/SessionProvider";
import { getHistory, historyErrorMessage } from "@/services/rest/history";
import { useLookup } from "@/services/rest/useLookup";
import { MaiHoaResultView } from "@/components/results/MaiHoaResultView";
import { TamTheResultView } from "@/components/results/TamTheResultView";

export function HistoryDetailPanel({ id }: { id: string }) {
  const session = useSession();
  return <PageContainer><Link href="/history" className="source-link">← Về lịch sử</Link>
    {session?.status === "ready" ? <SavedResult key={`${session.revision}:${id}`} id={id} /> : <SessionNotice />}
  </PageContainer>;
}
function SavedResult({ id }: { id: string }) {
  const session = useSession()!; const handleError = session.handleError;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getHistory(id, signal); } catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [id, handleError]);
  const result = useLookup(id, load);
  return <><PageHeader eyebrow="LỊCH SỬ / BẢN ĐÃ LƯU" title={result.status === "completed" ? result.data.title : "Kết quả đã lưu"}>
    <p>Bản lưu được đọc từ Server sau kiểm tra phiên. Giữ nguyên quy tắc, nguồn và quyết định tại thời điểm lưu; không tính lại.</p>
  </PageHeader><p role="status" aria-live="polite">{result.status === "loading" ? "Đang tải bản đã lưu…" : result.status === "completed" ? "Đã tải bản lịch sử." : "Chưa tải được bản lịch sử."}</p>
    {result.status === "failed" && <><p role="alert" className="response-error">{historyErrorMessage(result.error)}</p><button type="button" className="secondary-button" onClick={result.retry}>Tải lại bản lưu</button></>}
    {result.status === "completed" && <><p>Đã lưu: <time dateTime={result.data.createdAt}>{result.data.createdAt}</time></p>
      <p className="field-hint">Phiên bản quy tắc của snapshot: {result.data.result.ruleVersion}</p>
      {result.data.type === "MAI_HOA" && "method" in result.data.result && <MaiHoaResultView data={result.data.result} />}
      {result.data.type === "TAM_THE" && "categories" in result.data.result && <TamTheResultView data={result.data.result} />}
    </>}
  </>;
}
