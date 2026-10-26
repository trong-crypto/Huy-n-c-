import type { CalendarInput, CalendarResult, CanChiResult } from "@/types/contract";
import { BRANCH_LABELS, STEM_LABELS, isCanChiResult } from "@/types/calendarValidation";
import { DecisionReferences, EvidenceSummary, RuleEvidenceList, SourceReferences } from "@/components/results/Evidence";

function pairLabel(pair: CanChiResult["year"]) {
  return `${STEM_LABELS[pair.stem as keyof typeof STEM_LABELS]} ${BRANCH_LABELS[pair.branch as keyof typeof BRANCH_LABELS]}`;
}
export function CalendarResultView({ data, input }: { data: CalendarResult; input: { date: CalendarInput; time?: string } }) {
  const lunar = data.lunarDate;
  const canChi = isCanChiResult(data);
  return <section className="calendar-result" aria-label={canChi ? "Kết quả Can Chi" : "Kết quả đổi lịch"}>
    <h3>{canChi ? "Can Chi từ Server" : "Ngày Âm – Dương từ Server"}</h3>
    <p className="calendar-original">Đầu vào: {input.date.day}/{input.date.month}/{input.date.year} · {input.date.calendarType === "SOLAR" ? "Dương lịch" : `Âm lịch${input.date.isLeapMonth ? " · Tháng nhuận" : " · Tháng thường"}`}{input.time === undefined ? "" : ` · ${input.time}`}</p>
    <dl className="calendar-dates reference-fields">
      <div><dt>Ngày Dương</dt><dd><time dateTime={data.solarDate}>{data.solarDate}</time></dd></div>
      <div><dt>Ngày Âm</dt><dd>{String(lunar.day).padStart(2, "0")}/{String(lunar.month).padStart(2, "0")}/{lunar.year}</dd></div>
      <div><dt>Tháng âm</dt><dd>{lunar.isLeapMonth ? "Tháng nhuận" : "Tháng thường (không nhuận)"}</dd></div>
      <div><dt>Múi giờ mô hình</dt><dd>{data.timezone} · UTC+07:00 cố định</dd></div>
    </dl>
    {canChi && <>
      <dl className="can-chi-grid">{(["year", "month", "day", "hour"] as const).map((key, index) => <div key={key}>
        <dt>{["Can Chi năm", "Can Chi tháng", "Can Chi ngày", "Can Chi giờ"][index]}</dt>
        <dd>{data[key] === null ? "Chưa xét giờ" : pairLabel(data[key])}</dd>
      </div>)}</dl>
      {data.hour === null && <p className="status-banner">Chưa xét Can Chi giờ vì không cung cấp giờ. Không dùng thời gian hiện tại của thiết bị.</p>}
    </>}
    <EvidenceSummary ruleBasis={data.ruleBasis} sourceStatus={data.sourceStatus} />
    {data.ruleBasis === "TEAM_DECISION" && <p className="response-warning">Kết quả có áp dụng quy ước nhóm; không xem đây là căn cứ SOURCE_VERIFIED. Xem quyết định và giới hạn bên dưới.</p>}
    <details className="result-technical"><summary>Nguồn và quy tắc lịch</summary>
      <p className="field-hint">Phiên bản bộ quy tắc: {data.ruleVersion}. Nguồn thuật toán có thể không có trang sách in hoặc PDF.</p>
      <SourceReferences sources={data.sourceReferences} /><RuleEvidenceList rules={data.rules} />
      {data.decisionReferences.length > 0 && <><h4>Quyết định nhóm</h4><DecisionReferences decisions={data.decisionReferences} /></>}
    </details>
  </section>;
}
