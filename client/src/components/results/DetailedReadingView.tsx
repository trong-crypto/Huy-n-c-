import type { DetailedReading, ReadingPhase, ReadingRelation, SeasonReading, TrigramRole } from "@/types/readingContract";
import { SectionCard } from "@/components/ui/Controls";
import { readingTopicLabels } from "@/components/mai-hoa/ReadingOptionsFields";
import { EvidenceSummary, ReadingDecisions, SourceReferences } from "./Evidence";

const phases: Record<ReadingPhase["kind"], string> = {
  INITIAL_USE: "Ban đầu — Dụng", MIDDLE_BODY_MUTUAL: "Giữa — Hỗ Thể",
  MIDDLE_USE_MUTUAL: "Giữa — Hỗ Dụng", FINAL_USE: "Cuối — Dụng sau biến",
};
const relations: Record<ReadingRelation, string> = {
  SAME_ELEMENT: "Thể và quái đối chiếu cùng hành", USE_GENERATES_BODY: "Quái đối chiếu sinh Thể",
  BODY_GENERATES_USE: "Thể sinh quái đối chiếu", BODY_CONTROLS_USE: "Thể khắc quái đối chiếu",
  USE_CONTROLS_BODY: "Quái đối chiếu khắc Thể",
};
const trigrams: Record<TrigramRole["trigramCode"], string> = {
  CAN: "Càn", DOAI: "Đoài", LY: "Ly", CHAN: "Chấn", TON: "Tốn", KHAM: "Khảm", CAN2: "Cấn", KHON: "Khôn",
};
const elements: Record<TrigramRole["element"], string> = { KIM: "Kim", MOC: "Mộc", THUY: "Thủy", HOA: "Hỏa", THO: "Thổ" };
const seasons = { SPRING: "Xuân", SUMMER: "Hạ", AUTUMN: "Thu", WINTER: "Đông", EARTH_MONTH: "Tháng Thổ" };
const strengths = { VIGOROUS: "Vượng theo quy ước mùa", WEAK: "Suy theo quy ước mùa", UNCLASSIFIED: "Chưa phân loại theo quy tắc" };

function RoleDescription({ role }: { role: TrigramRole }) {
  return <dl className="role-description">
    <div><dt>Vị trí</dt><dd>{role.side === "UPPER" ? "Thượng quái" : "Hạ quái"}</dd></div>
    <div><dt>Quái</dt><dd>{trigrams[role.trigramCode]}</dd></div>
    <div><dt>Hành</dt><dd>{elements[role.element]}</dd></div>
  </dl>;
}

function SeasonView({ season }: { season: SeasonReading }) {
  return <section className="reading-season" aria-label="Mùa và thời điểm luận">
    <h3>Mùa và thời điểm luận</h3>
    {season.status === "NOT_EVALUATED" ? <p className="status-banner">Chưa xét mùa vì chưa cung cấp thời điểm luận. Không tự lấy ngày giờ hiện tại.</p> : <>
      <dl className="reference-fields">
        <div><dt>Thời điểm từ Server</dt><dd><time dateTime={season.datetime}>{season.datetime}</time></dd></div>
        <div><dt>Ngày âm</dt><dd>{String(season.lunarDate.day).padStart(2, "0")}/{String(season.lunarDate.month).padStart(2, "0")}/{season.lunarDate.year}{season.lunarDate.isLeapMonth ? " (tháng nhuận)" : ""}</dd></div>
        <div><dt>Mùa theo quy ước</dt><dd>{seasons[season.season]}</dd></div>
        <div><dt>Phân loại Thể</dt><dd>{strengths[season.bodyStrength]}</dd></div>
      </dl>
      <details className="result-technical"><summary>Nguồn xét mùa</summary><SourceReferences sources={season.sourceReferences} /></details>
    </>}
  </section>;
}

export function DetailedReadingView({ reading }: { reading: DetailedReading }) {
  return <section className="detailed-reading" aria-label="Luận giải chi tiết Mai Hoa">
    <SectionCard title={`Luận giải chi tiết · ${readingTopicLabels[reading.topic]}`}>
      <p className="result-section-note">Lời diễn giải biên tập được trả từ Server. Căn cứ từng đoạn và các quy ước tính toán được trình bày riêng.</p>
      <div className="reading-role-grid">
        <section aria-label="Thể từ Server"><h3>Thể</h3><RoleDescription role={reading.body} /></section>
        <section aria-label="Dụng từ Server"><h3>Dụng</h3><RoleDescription role={reading.use} /></section>
      </div>
      <ol className="reading-phases" aria-label="Bốn giai đoạn luận giải">
        {reading.phases.map((phase, index) => <li key={phase.kind}>
          <article className="reading-phase">
            <p className="eyebrow">GIAI ĐOẠN {index + 1}</p><h3>{phases[phase.kind]}</h3>
            <p className="reading-relation">{relations[phase.relation]}</p>
            <RoleDescription role={phase.comparator} />
            <p className="interpretation-text">{phase.content}</p>
            <EvidenceSummary ruleBasis={phase.ruleBasis} sourceStatus={phase.sourceStatus} />
            <details className="result-technical"><summary>Nguồn của giai đoạn {index + 1}</summary>
              <SourceReferences sources={phase.sourceReferences} /><p className="field-hint">Mẫu lời luận: <code>{phase.templateCode}</code></p>
            </details>
          </article>
        </li>)}
      </ol>
      <section className="reading-summary" aria-label="Tóm tắt luận giải"><h3>Tóm tắt</h3><p className="interpretation-text">{reading.summary}</p></section>
      <SeasonView season={reading.season} />
      <section className="reading-decisions" aria-label="Quyết định tính toán của lời luận">
        <h3>Quyết định tính toán và giới hạn</h3><ReadingDecisions decisions={reading.calculationDecisions} />
      </section>
      <details className="result-technical"><summary>Nguồn tổng hợp của lời luận</summary><SourceReferences sources={reading.sourceReferences} /></details>
    </SectionCard>
  </section>;
}
