import type { SourceStatus } from "@/types/contract";
import { TRIGRAM_LABELS } from "@/types/hexagramValidation";
import { lookupErrorMessage } from "@/services/rest/hexagrams";

const labels: Record<SourceStatus, string> = {
  VERIFIED: "Tên đã được đối chiếu", DRAFT: "Bản nháp — chưa xác minh", SOURCE_LOCATED: "Đã xác định vị trí nguồn — chưa xác minh",
  SOURCE_AMBIGUOUS: "Nguồn còn điểm cần đối chiếu", BLOCKED_SOURCE_CONFLICT: "Nguồn có nội dung mâu thuẫn",
};
export function NameVerification({ status, structural = false }: { status: SourceStatus; structural?: boolean }) {
  return <p className="lookup-verification"><span className={`evidence-badge${status === "VERIFIED" ? " evidence-badge--verified" : " evidence-badge--review"}`}>{labels[status]}</span>
    {structural && <span>Nhãn cấu trúc từ nguồn; chưa phải tên chuẩn đã duyệt.</span>}
    {status !== "VERIFIED" && <span>Bản chép phục vụ đối chiếu nguồn, không phải nội dung đã được xác minh.</span>}
  </p>;
}
export function TrigramPair({ upper, lower }: { upper: string; lower: string }) {
  return <dl className="lookup-trigrams"><div><dt>Thượng quái</dt><dd>{TRIGRAM_LABELS[upper as keyof typeof TRIGRAM_LABELS]} <code>{upper}</code></dd></div>
    <div><dt>Hạ quái</dt><dd>{TRIGRAM_LABELS[lower as keyof typeof TRIGRAM_LABELS]} <code>{lower}</code></dd></div></dl>;
}
export function LookupFailure({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="lookup-failure"><p className="response-error" role="alert">{lookupErrorMessage(error)}</p>
    <button type="button" className="secondary-button" onClick={retry}>Thử lại</button></div>;
}
