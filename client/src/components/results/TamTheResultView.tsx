import type { InterpretationEntry, TamTheResult } from "@/types/contract";
import { SectionCard } from "@/components/ui/Controls";
import { DecisionReferences, EvidenceSummary, ReadingDecisions, RuleEvidenceList, SourceReferences } from "./Evidence";

const categoryLabels = { CAREER: "Công danh", WEALTH: "Tài lộc", LOVE: "Tình duyên" };
const subreadingLabels = { LOC: "Lộc", SANG_HEN: "Sang hèn", DIEN_SAN: "Điền sản" };

function Entries({ entries }: { entries: readonly InterpretationEntry[] }) {
  return <div className="interpretation-entries">{entries.map(entry => <article className="interpretation-entry" key={entry.resultCode}>
    <h4>{entry.title}</h4><p className="interpretation-text">{entry.content}</p>
    <details className="result-technical"><summary>Nguồn của {entry.title}</summary><SourceReferences sources={entry.sourceReferences} /></details>
  </article>)}</div>;
}

export function TamTheResultView({ data }: { data: TamTheResult }) {
  return <div className="tamthe-result" aria-label="Kết quả luận giải Tam Thế">
    <header className="result-summary"><div><p className="eyebrow">DIỄN CẦM TAM THẾ</p><h2>Bảng tra và lời luận từ nguồn.</h2>
      <p>{data.coverageMode === "EXTENDED" ? "Tài lộc mở rộng · Lộc, Sang hèn, Điền sản" : "Tra cứu cơ bản"}</p></div>
      <section aria-label="Căn cứ nội dung Tam Thế"><EvidenceSummary ruleBasis={data.ruleBasis} sourceStatus={data.sourceStatus} /></section>
    </header>
    {data.coverageMode === "EXTENDED" && <p className="response-warning" role="note">Trạng thái nội dung đã đối chiếu không thay cho căn cứ của các liên kết biên tập. Xem riêng các quyết định nhóm và giới hạn áp dụng.</p>}
    {data.categories.map(category => <section key={category.category} aria-label={`Kết quả ${categoryLabels[category.category]}`}>
      <SectionCard title={categoryLabels[category.category]}>
        {category.category === "WEALTH" && category.subreadings ? <div className="wealth-subreadings">
          {category.subreadings.map(sub => <section className="wealth-subreading" key={sub.code} aria-label={`Tiểu mục ${subreadingLabels[sub.code]}`}>
            <header className="subreading-heading"><h3>{subreadingLabels[sub.code]}</h3>
              <span className={`evidence-badge${sub.status === "MATCHED" ? " evidence-badge--verified" : " evidence-badge--review"}`}>
                {sub.status === "MATCHED" ? "Có dữ liệu tra cứu" : "Không có giao điểm Lộc"}
              </span>
            </header>
            {sub.status === "NO_SOURCE_MATCH" ? <p className="status-banner" role="note">Bản in không có giao điểm Lộc cho khóa tra cứu này. Không bổ sung lời luận Lộc. Các mục Sang hèn và Điền sản vẫn được trình bày theo dữ liệu riêng.</p>
              : <Entries entries={sub.entries} />}
            <details className="result-technical"><summary>Nguồn và căn cứ của {subreadingLabels[sub.code]}</summary>
              <dl className="reference-fields"><div><dt>Khóa tra cứu từ Server</dt><dd><code>{sub.lookupKey}</code></dd></div></dl>
              <SourceReferences sources={sub.sourceReferences} />
              {sub.decisionReferences.length > 0 && <><h4>Quyết định liên quan</h4><ReadingDecisions decisions={sub.decisionReferences} /></>}
            </details>
          </section>)}
        </div> : <Entries entries={category.entries} />}
      </SectionCard>
    </section>)}
    {data.coverageMode === "EXTENDED" && data.editorialDecisions.length > 0 && <section aria-label="Quyết định biên tập Tam Thế">
      <SectionCard title="Quyết định biên tập và giới hạn"><ReadingDecisions decisions={data.editorialDecisions} /></SectionCard>
    </section>}
    <SectionCard title="Nguồn tham chiếu Tam Thế"><SourceReferences sources={data.sourceReferences} /></SectionCard>
    <SectionCard title="Căn cứ quy tắc Tam Thế"><RuleEvidenceList rules={data.rules} /></SectionCard>
    {data.decisionReferences.length > 0 && <SectionCard title="Quyết định nhóm của phép tra"><DecisionReferences decisions={data.decisionReferences} /></SectionCard>}
  </div>;
}
