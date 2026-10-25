import type { DecisionReference, RuleBasis, RuleEvidence, SourceReference, SourceStatus } from "@/types/contract";

const sourceLabels: Record<SourceStatus, string> = {
  DRAFT: "Nguồn đang ở bản nháp",
  SOURCE_LOCATED: "Đã xác định vị trí nguồn",
  SOURCE_AMBIGUOUS: "Nguồn còn điểm cần đối chiếu",
  BLOCKED_SOURCE_CONFLICT: "Nguồn có nội dung mâu thuẫn",
  VERIFIED: "Nguồn đã được đối chiếu",
};
const basisLabels: Record<RuleBasis, string> = {
  SOURCE_VERIFIED: "Theo nguồn đã duyệt",
  TEAM_DECISION: "Theo quy ước nhóm",
};

export function EvidenceSummary({ ruleBasis, sourceStatus }: { ruleBasis: RuleBasis; sourceStatus: SourceStatus }) {
  return <dl className="evidence-summary">
    <div><dt>Căn cứ áp dụng</dt><dd>{basisLabels[ruleBasis]}</dd></div>
    <div><dt>Trạng thái nguồn quy tắc</dt><dd className={`evidence-badge${sourceStatus === "VERIFIED" ? " evidence-badge--verified" : " evidence-badge--review"}`}>{sourceLabels[sourceStatus]}</dd></div>
  </dl>;
}

// Link safety only, not a second DTO decoder. Never construct a missing URL.
function webLink(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export function SourceReferences({ sources }: { sources: readonly SourceReference[] }) {
  if (sources.length === 0) return <p className="field-hint">Phản hồi không cung cấp nguồn tham chiếu tại mục này.</p>;
  return <ul className="source-list">{sources.map((source, index) => {
    const href = webLink(source.url);
    return <li key={index} className="source-reference">
      <h4>{source.title}</h4>
      <dl className="reference-fields">
        <div><dt>Mã nguồn</dt><dd><code>{source.sourceId}</code></dd></div>
        <div><dt>Phiên bản / bản nguồn</dt><dd>{source.version}</dd></div>
        <div><dt>Mục tham chiếu</dt><dd><code>{source.section}</code></dd></div>
        <div><dt>Trang in</dt><dd>{source.printedPage ?? "Không cung cấp"}</dd></div>
        <div><dt>Trang PDF</dt><dd>{source.pdfPage ?? "Không cung cấp"}</dd></div>
      </dl>
      {href ? <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">Mở nguồn tham chiếu ↗</a>
        : source.url !== null ? <p className="reference-url">Địa chỉ được cung cấp (không mở liên kết): {source.url}</p>
          : <p className="field-hint">Không có liên kết được cung cấp.</p>}
      {source.sha256 !== null && <details className="reference-hash"><summary>Dấu vân tay tệp SHA-256</summary><code>{source.sha256}</code></details>}
    </li>;
  })}</ul>;
}

export function DecisionReferences({ decisions }: { decisions: readonly DecisionReference[] }) {
  if (decisions.length === 0) return null;
  return <ul className="decision-list">{decisions.map((decision, index) => <li key={index}>
    <p className="decision-id"><code>{decision.decisionId}</code></p>
    <p>{decision.description}</p>
    <dl className="reference-fields">
      <div><dt>Ngày quyết định</dt><dd>{decision.decidedAt}</dd></div>
      <div><dt>Tài liệu quyết định</dt><dd><code>{decision.document}</code></dd></div>
    </dl>
  </li>)}</ul>;
}

export function RuleEvidenceList({ rules }: { rules: readonly RuleEvidence[] }) {
  return <div className="rule-evidence-list">{rules.map((rule, index) => <details className="rule-evidence" key={index}>
    <summary><span><code>{rule.ruleCode}</code><span className="rule-version">Phiên bản {rule.ruleVersion}</span></span><span>{sourceLabels[rule.sourceStatus]}</span></summary>
    <div className="rule-evidence-content">
      <dl className="reference-fields"><div><dt>Chính sách thực thi</dt><dd>{rule.executionPolicy === "TEAM_DECISION" ? "Thực thi theo quyết định nhóm" : "Chỉ thực thi theo nguồn đã duyệt"}</dd></div></dl>
      <EvidenceSummary ruleBasis={rule.ruleBasis} sourceStatus={rule.sourceStatus} />
      <h4>Nguồn của quy tắc này</h4><SourceReferences sources={rule.sourceReferences} />
      {rule.decisionReferences.length > 0 && <><h4>Quyết định của quy tắc này</h4><DecisionReferences decisions={rule.decisionReferences} /></>}
    </div>
  </details>)}</div>;
}
