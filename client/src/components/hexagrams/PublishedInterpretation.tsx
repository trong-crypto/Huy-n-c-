"use client";

import { useCallback } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { SectionCard } from "@/components/ui/Controls";
import { getPublishedInterpretation, type InterpretationContent, type InterpretationSource } from "@/services/rest/hexagramInterpretations";
import { useLookup } from "@/services/rest/useLookup";
import styles from "./publishedInterpretation.module.css";

export function InterpretationText({ content, sources, lines, compact = false, movingLine }: {
  content: InterpretationContent; sources: InterpretationSource[]; lines: readonly boolean[];
  compact?: boolean; movingLine?: number;
}) {
  const displayed = compact ? (movingLine ? [movingLine] : []) : [1, 2, 3, 4, 5, 6];
  return <div className={styles.content}>
    <section><h3>Ý nghĩa tổng quan</h3><p className="interpretation-text">{content.overview}</p></section>
    {!compact && <>
      {content.image && <section><h3>Hình tượng quẻ</h3><p className="interpretation-text">{content.image}</p></section>}
      {content.original && <section><h3>Lời quẻ Hán cổ</h3><p lang="zh" className="interpretation-text">{content.original}</p></section>}
      {content.paraphrase && <section><h3>Diễn nghĩa tiếng Việt</h3><p className="interpretation-text">{content.paraphrase}</p></section>}
    </>}
    {displayed.length > 0 && <section>
      {!compact && <h3>Giải nghĩa các hào</h3>}
      <ol className={styles.lineList}>{displayed.map(position => <li key={position} className={styles.line}>
        <h4>{compact ? "Hào động" : "Hào"} {position} · {lines[position - 1] ? "Dương" : "Âm"}</h4>
        <p className="interpretation-text">{content.lines[position - 1] || "Chưa có lời giải cho hào này."}</p>
      </li>)}</ol>
    </section>}
    {!compact && content.application && <section><h3>Gợi ý suy ngẫm</h3><p className="interpretation-text">{content.application}</p></section>}
    <section><h3>Nguồn tham khảo</h3>
      <ul className="source-list">{sources.map(source => <li key={source.id} className="source-reference">
        <strong>{source.title}</strong><p>{[source.author, source.edition, source.locator].filter(Boolean).join(" · ")}</p>
        <p className="field-hint">{source.reviewStatus === "VERIFIED" ? "Nguồn đã được đối chiếu." : "Nguồn chờ đối chiếu."} {source.reuseNote}</p>
        {sourceUrl(source.url) && <a className="source-link" href={sourceUrl(source.url)} target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a>}
      </li>)}</ul>
    </section>
  </div>;
}

function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* Only display links with a validated absolute URL. */ }
}

type Props = { code: string; lines: readonly boolean[]; title?: string; compact?: boolean; movingLine?: number };

export function PublishedInterpretation(props: Props) {
  return <div className={styles.card}>
    <SectionCard title={props.title ?? "Luận giải chi tiết"}>
      {CLIENT_CONFIG.hexagramInterpretations ? <LoadPublished {...props} /> : <p>Kho luận giải chi tiết chưa được bật.</p>}
    </SectionCard>
  </div>;
}

function LoadPublished({ code, lines, compact, movingLine }: Props) {
  const load = useCallback((signal: AbortSignal) => getPublishedInterpretation(code, signal), [code]);
  const reading = useLookup(code, load);
  if (reading.status === "loading") return <p role="status">Đang tải bài luận giải…</p>;
  if (reading.status === "failed") return <div>
    <p role="alert">Chưa tải được bài luận giải.</p>
    <button className="secondary-button" type="button" onClick={reading.retry}>Thử tải lại</button>
  </div>;
  const publication = reading.data.publication;
  if (!publication) return <p>Quẻ này chưa có bài luận giải được công bố.</p>;
  return <>
    <p className="field-hint">Bản biên soạn đã công bố · Phiên bản {publication.version}. Nội dung dùng để tham khảo biểu tượng.</p>
    <InterpretationText content={publication.content} sources={publication.sources} lines={lines} compact={compact} movingLine={movingLine} />
  </>;
}
