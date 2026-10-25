import type { CalculationStep, MaiHoaResult } from "@/types/contract";
import { HexagramView } from "@/components/hexagrams/HexagramView";
import { SectionCard } from "@/components/ui/Controls";
import { DecisionReferences, EvidenceSummary, RuleEvidenceList, SourceReferences } from "./Evidence";

const methodLabels: Record<MaiHoaResult["method"], string> = {
  LINES: "Nhập sáu hào", OBJECT_COUNT: "Theo số vật", TIME: "Theo thời gian",
};
const valueLabels: Record<string, string> = {
  movingLine: "Hào động", upperLineStart: "Hào bắt đầu của hỗ thượng", lowerLineStart: "Hào bắt đầu của hỗ hạ",
  objectCount: "Số vật", hourIndex: "Chỉ số giờ Chi", movingLineSum: "Tổng hai số gốc",
  upperTrigram: "Số thượng quái", lowerTrigram: "Số hạ quái",
};

export function CalculationSteps({ steps }: { steps: readonly CalculationStep[] }) {
  return <ol className="calculation-steps" aria-label="Các bước tính từ Server">{steps.map((step, index) => <li key={index}>
    <span className="calculation-step-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    <div className="calculation-step-content"><p>{step.message}</p><code className="calculation-step-code">{step.code}</code>
      {Object.keys(step.values).length > 0 && <dl className="step-values">{Object.entries(step.values).map(([key, value]) => <div key={key}>
        <dt>{Object.hasOwn(valueLabels, key) ? valueLabels[key] : key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd>
      </div>)}</dl>}
    </div>
  </li>)}</ol>;
}

// Receives the existing validated DTO. No lookups, mutation or calculation here.
export function MaiHoaResultView({ data }: { data: MaiHoaResult }) {
  return <div className="maihoa-result" aria-label="Kết quả quẻ Mai Hoa">
    <header className="result-summary">
      <div><p className="eyebrow">MAI HOA DỊCH SỐ · {methodLabels[data.method]}</p><h2>Ba quẻ, một mạch biến hóa.</h2><p>Quẻ chủ · Quẻ hỗ · Quẻ biến</p></div>
      <section aria-label="Căn cứ của phép tính"><EvidenceSummary ruleBasis={data.ruleBasis} sourceStatus={data.sourceStatus} /></section>
    </header>
    {data.ruleBasis === "TEAM_DECISION" && <p className="response-warning result-team-warning" role="note">Kết quả tính theo quy ước nhóm. Phương pháp này áp dụng quy ước đã được nhóm thống nhất; căn cứ trong nguồn vẫn còn điểm cần đối chiếu.</p>}
    <section className="hexagram-grid" aria-label="Ba quẻ từ kết quả Server">
      <HexagramView roleLabel="Quẻ chủ" {...data.primaryHexagram} movingLine={data.movingLine} />
      <HexagramView roleLabel="Quẻ hỗ" {...data.mutualHexagram} />
      <HexagramView roleLabel="Quẻ biến" {...data.changedHexagram} />
    </section>
    <section className="moving-line-summary" aria-label="Hào động của quẻ chủ"><span aria-hidden="true">↔</span><div><h3>Hào động: {data.movingLine}</h3><p>Vị trí tính từ hào 1 ở dưới cùng của quẻ chủ.</p></div></section>
    {data.calculationSteps.length > 0 && <SectionCard title="Các bước tính"><CalculationSteps steps={data.calculationSteps} /></SectionCard>}
    <SectionCard title="Nguồn tham chiếu">
      <p className="result-section-note">Nguồn tổng hợp cho phép tính. Các trang quy tắc dưới đây không phải chứng cứ riêng cho tên từng quẻ.</p>
      <SourceReferences sources={data.sourceReferences} />
    </SectionCard>
    {data.rules.length > 0 && <SectionCard title="Căn cứ từng quy tắc"><p className="result-section-note">Chính sách thực thi, căn cứ áp dụng và trạng thái nguồn được trình bày riêng cho mỗi quy tắc.</p><RuleEvidenceList rules={data.rules} /></SectionCard>}
    {data.decisionReferences.length > 0 && <section aria-label="Quyết định nhóm của phép tính"><SectionCard title="Quyết định nhóm"><DecisionReferences decisions={data.decisionReferences} /></SectionCard></section>}
  </div>;
}
