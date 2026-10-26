"use client";

import Link from "next/link";
import { useCallback } from "react";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { SectionCard } from "@/components/ui/Controls";
import { HexagramView } from "./HexagramView";
import { LookupFailure, NameVerification, TrigramPair } from "./LookupPresentation";
import { SourceReferences } from "@/components/results/Evidence";
import { getHexagram } from "@/services/rest/hexagrams";
import { useLookup } from "@/services/rest/useLookup";

export function HexagramDetailPanel({ code }: { code: string }) {
  const load = useCallback((signal: AbortSignal) => getHexagram(code, signal), [code]);
  const result = useLookup(code, load);
  return <PageContainer>
    <Link className="source-link lookup-back" href="/hexagrams">← Về danh sách quẻ</Link>
    <PageHeader eyebrow="THƯ VIỆN / CHI TIẾT QUẺ" title={result.status === "completed" ? result.data.name : "Chi tiết quẻ"}>
      <p><code className="lookup-code">{code}</code></p><p>Cấu trúc và nghĩa tên từ kho dữ liệu nguồn; không phải luận giải hào hoặc dự đoán.</p>
    </PageHeader>
    <div aria-busy={result.status === "loading"}>
      <p role="status" aria-live="polite">{result.status === "loading" ? "Đang tải chi tiết quẻ…" : result.status === "completed" ? "Đã tải chi tiết quẻ." : "Chưa tải được chi tiết quẻ."}</p>
      {result.status === "failed" && <LookupFailure error={result.error} retry={result.retry} />}
      {result.status === "completed" && <>
        <div className="lookup-detail-grid">
          <HexagramView roleLabel="Quẻ tra cứu" code={result.data.code} linesBottomUp={result.data.linesBottomUp}
            name={result.data.nameKind === "CANONICAL_TITLE" ? result.data.name : null} nameStatus={result.data.verificationStatus} />
          <SectionCard title="Tên quẻ và căn cứ nguồn">
            <NameVerification status={result.data.verificationStatus} structural={result.data.nameKind === "STRUCTURAL_LABEL"} />
            <TrigramPair upper={result.data.upperTrigramCode} lower={result.data.lowerTrigramCode} />
            <p className="field-hint">Hào 1 ở dưới, hào 6 ở trên. Không gán hào động trong trang tra cứu.</p>
            <details className="result-technical"><summary>Nguồn tên quẻ</summary><SourceReferences sources={result.data.sourceReferences} /></details>
          </SectionCard>
        </div>
        <section className="lookup-interpretations" aria-label="Nghĩa tên đã duyệt">
          {result.data.interpretations.length === 0 ? <p className="status-banner">Server chưa cung cấp nghĩa tên đã được xác minh cho quẻ này. Không bổ sung lời luận thay thế.</p> : result.data.interpretations.map(gloss =>
            <SectionCard key={gloss.resultCode} title={gloss.title}>
              <p className="evidence-badge evidence-badge--verified">Nghĩa tên đã được đối chiếu</p>
              <p className="interpretation-text">{gloss.content}</p>
              <dl className="reference-fields"><div><dt>Thứ tự trong nguồn</dt><dd>{gloss.sourceOrder}</dd></div>
                <div><dt>Nhãn in được bảo tồn</dt><dd>{gloss.printedSourceLabel}</dd></div></dl>
              <details className="result-technical"><summary>Ghi chú xác minh nghĩa tên</summary><p className="interpretation-text">{gloss.verificationNote}</p></details>
              <h3>Nguồn của nghĩa tên</h3><SourceReferences sources={gloss.sourceReferences} />
            </SectionCard>)}
        </section>
      </>}
    </div>
  </PageContainer>;
}
