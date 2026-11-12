import type { InterpretationEntry, TamTheCategory, TamTheResult } from "@/types/contract";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/Controls";
import { DecisionReferences, EvidenceSummary, ReadingDecisions, RuleEvidenceList, SourceReferences } from "./Evidence";
import { explainTamTheEntry } from "./tamTheExplanation";
import { CopyReadingForChat } from "./CopyReadingForChat";

const categoryLabels = { CAREER: "Công danh", WEALTH: "Tài lộc", LOVE: "Tình duyên" };
const subreadingLabels = { LOC: "Lộc", SANG_HEN: "Sang hèn", DIEN_SAN: "Điền sản" };
const categoryDescriptions = {
  CAREER: "Các nhóm nghề và mô tả nghề nghiệp trong sách xưa. Kết quả tra bảng không đánh giá năng lực hay chỉ định nghề bạn phải làm.",
  WEALTH: "Các mục nói về sinh kế, hoàn cảnh sống và tài sản theo quan niệm trong sách. Mỗi mục được tra riêng, không phải dự báo thu nhập.",
  LOVE: "Đọc bài thơ gốc và phần giải nghĩa bên dưới để hiểu hình ảnh, từ cổ và ý từng cặp câu. Lời thơ không xác định số lần kết hôn hoặc sự kiện sẽ xảy ra với bạn.",
};
const subreadingDescriptions = {
  LOC: "Lời sách về sinh kế và tài lộc.",
  SANG_HEN: "Tên mục cổ dùng để mô tả hoàn cảnh sống và quan hệ gia đình; không phải cách xếp hạng con người.",
  DIEN_SAN: "Điền sản nghĩa là ruộng đất, tài sản đất đai trong bối cảnh của sách.",
};

function Entries({ entries, category }: { entries: readonly InterpretationEntry[]; category: TamTheCategory }) {
  return <div className="interpretation-entries">{entries.map(entry => {
    const explanation = explainTamTheEntry(category, entry);
    const poem = explanation?.couplets;
    return <article className="interpretation-entry" key={entry.resultCode}>
      <h4>{entry.title}</h4>
      {poem && <><p className="eyebrow">BÀI THƠ GỐC</p><blockquote className="tamthe-poem"><p className="interpretation-text">{entry.content}</p></blockquote></>}
      {explanation ? <section className="tamthe-explanation" aria-label={`${poem ? "Giải nghĩa bài thơ" : "Giải nghĩa"} ${entry.title}`}>
        <h5>{poem ? "Bài thơ nói gì?" : "Hiểu bằng lời thường"}</h5>
        <p className="interpretation-text">{explanation.meaning}</p>
        {poem && <ol className="poem-couplets" aria-label={`Giải nghĩa từng cặp câu của ${entry.title}`}>
          {poem.map(couplet => <li key={couplet.lines}><strong>Câu {couplet.lines}</strong><p className="interpretation-text">{couplet.meaning}</p></li>)}
        </ol>}
      </section> : <><p className="interpretation-text">{entry.content}</p>
        <p className="field-hint">Đang hiển thị nguyên văn từ Server; chưa có phần giải nghĩa hỗ trợ đọc tương ứng.</p></>}
      <details className="result-technical"><summary>{poem ? "Nguồn của" : "Xem lời gốc và nguồn của"} {entry.title}</summary>
        {explanation && !poem && <p className="interpretation-text">{entry.content}</p>}
        <SourceReferences sources={entry.sourceReferences} />
      </details>
    </article>;
  })}</div>;
}

export function TamTheResultView({ data, actions, save }: { data: TamTheResult; actions?: ReactNode; save?: ReactNode }) {
  const entryText = (entry: InterpretationEntry) => `${entry.title}\n${entry.content}`;
  const sections = data.categories.map(category => {
    const content = category.subreadings
      ? category.subreadings.map(sub => [subreadingLabels[sub.code],
        ...(sub.status === "NO_SOURCE_MATCH" ? ["Chưa có lời luận trong nguồn."] : sub.entries.map(entryText))].join("\n"))
      : category.entries.map(entryText);
    return [categoryLabels[category.category], ...content].join("\n");
  });
  return <div className="tamthe-result" aria-label="Kết quả luận giải Tam Thế">
    <header className="result-summary"><div><p className="eyebrow">DIỄN CẦM TAM THẾ</p><h2>Bảng tra và lời luận từ nguồn.</h2>
      <p>{data.coverageMode === "EXTENDED" ? "Tài lộc mở rộng · Lộc, Sang hèn, Điền sản" : "Tra cứu cơ bản"}</p></div>
      <section aria-label="Căn cứ nội dung Tam Thế"><EvidenceSummary ruleBasis={data.ruleBasis} sourceStatus={data.sourceStatus} /></section>
    </header>
    <div className="result-actions"><CopyReadingForChat text={["Diễn Cầm Tam Thế", ...sections].join("\n\n")} />{actions}{save}</div>
    <p className="result-section-note">Phần giải nghĩa là nội dung biên tập hỗ trợ đọc văn bản. Lời gốc và nguồn được giữ để đối chiếu; các mô tả trong sách cổ không phải kết luận về cuộc đời bạn.</p>
    {data.coverageMode === "EXTENDED" && <p className="field-hint">Lộc, Sang hèn và Điền sản có dữ liệu riêng. Một mục thiếu dữ liệu không làm mất kết quả của các mục còn lại; các liên kết biên tập được ghi trong phần căn cứ.</p>}
    {data.categories.map(category => <section key={category.category} aria-label={`Kết quả ${categoryLabels[category.category]}`}>
      <SectionCard title={categoryLabels[category.category]}>
        <p className="result-section-note">{categoryDescriptions[category.category]}</p>
        {category.category === "WEALTH" && category.subreadings ? <div className="wealth-subreadings">
          {category.subreadings.map(sub => <section className="wealth-subreading" key={sub.code} aria-label={`Tiểu mục ${subreadingLabels[sub.code]}`}>
            <header className="subreading-heading"><h3>{subreadingLabels[sub.code]}</h3>
              <span className={`evidence-badge${sub.status === "MATCHED" ? " evidence-badge--verified" : " evidence-badge--review"}`}>
                {sub.status === "MATCHED" ? "Có dữ liệu tra cứu" : "Chưa có lời luận trong nguồn"}
              </span>
            </header>
            <p className="field-hint">{subreadingDescriptions[sub.code]}</p>
            {sub.status === "NO_SOURCE_MATCH" ? <p className="status-banner" role="note">Chưa có lời luận Lộc tương ứng trong bảng nguồn cho dữ kiện này. Đây là thiếu dữ liệu tra cứu, không có nghĩa bạn không có tài lộc. Bạn vẫn có thể đọc các mục Sang hèn và Điền sản bên dưới.</p>
              : <Entries entries={sub.entries} category={category.category} />}
            <details className="result-technical"><summary>Nguồn và căn cứ của {subreadingLabels[sub.code]}</summary>
              <dl className="reference-fields"><div><dt>Khóa tra cứu từ Server</dt><dd><code>{sub.lookupKey}</code></dd></div></dl>
              <SourceReferences sources={sub.sourceReferences} />
              {sub.decisionReferences.length > 0 && <><h4>Quyết định liên quan</h4><ReadingDecisions decisions={sub.decisionReferences} /></>}
            </details>
          </section>)}
        </div> : <Entries entries={category.entries} category={category.category} />}
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
