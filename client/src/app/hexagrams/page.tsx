"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { LookupFailure, NameVerification, TrigramPair } from "@/components/hexagrams/LookupPresentation";
import { TRIGRAM_LABELS, TRIGRAMS } from "@/types/hexagramValidation";
import { listHexagrams, type HexagramQuery } from "@/services/rest/hexagrams";
import { useLookup } from "@/services/rest/useLookup";
import { CLIENT_CONFIG } from "@/config/client";

export default function HexagramsPage() {
  const [draft, setDraft] = useState({ q: "", upper: "", lower: "" });
  const [query, setQuery] = useState<HexagramQuery>({ ...draft, page: 0, size: CLIENT_CONFIG.hexagramPageSize });
  const [inputError, setInputError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const load = useCallback((signal: AbortSignal) => listHexagrams(query, signal), [query]);
  const result = useLookup(JSON.stringify(query), load);
  function search(event: FormEvent) {
    event.preventDefault();
    if (draft.q.length > 100) { setInputError("Từ khóa tối đa 100 ký tự."); searchRef.current?.focus(); return; }
    setInputError(null); setQuery({ ...draft, page: 0, size: CLIENT_CONFIG.hexagramPageSize });
  }
  return <PageContainer>
    <PageHeader eyebrow="03 / THƯ VIỆN QUẺ" title="Tra cứu 64 quẻ.">
      <p>Tìm tên, mã quẻ hoặc kết hợp thượng quái và hạ quái. Nghĩa tên và nguồn tham chiếu được trình bày riêng, không phải lời dự đoán.</p>
    </PageHeader>
    <form className="section-card lookup-search" aria-label="Tìm và lọc quẻ" onSubmit={search} noValidate>
      <FormField id="hexagram-search" label="Tên hoặc mã quẻ" hint="Tối đa 100 ký tự. Có dấu để phân biệt Bĩ/Bí; không dấu để tìm rộng hơn. Mã quẻ bắt đầu bằng H_.">
        <input ref={searchRef} id="hexagram-search" type="search" maxLength={100} value={draft.q} autoComplete="off"
          aria-invalid={!!inputError || undefined} aria-describedby={`hexagram-search-hint${inputError ? " hexagram-search-error" : ""}`}
          onChange={event => { setDraft({ ...draft, q: event.target.value }); setInputError(null); }} />
        {inputError && <FieldError id="hexagram-search-error">{inputError}</FieldError>}
      </FormField>
      {(["upper", "lower"] as const).map(side => <FormField key={side} id={`hexagram-${side}`} label={side === "upper" ? "Thượng quái" : "Hạ quái"}>
        <select id={`hexagram-${side}`} value={draft[side]} onChange={event => setDraft({ ...draft, [side]: event.target.value })}>
          <option value="">Tất cả</option>{TRIGRAMS.map(code => <option key={code} value={code}>{TRIGRAM_LABELS[code]} ({code})</option>)}
        </select>
      </FormField>)}
      <div className="lookup-search-actions"><PrimaryButton type="submit">Tìm quẻ</PrimaryButton>
        <button type="button" className="secondary-button" onClick={() => {
          const empty = { q: "", upper: "", lower: "" }; setDraft(empty); setInputError(null); setQuery({ ...empty, page: 0, size: CLIENT_CONFIG.hexagramPageSize });
        }}>Xóa bộ lọc</button></div>
    </form>
    <section className="lookup-results" aria-label="Kết quả tra cứu quẻ" aria-busy={result.status === "loading"}>
      <p role="status" aria-live="polite" className="lookup-count">{result.status === "loading" ? "Đang tải danh sách quẻ…" : result.status === "completed" ? `${result.data.totalElements} quẻ phù hợp · Trang ${result.data.page + 1}/${Math.max(1, result.data.totalPages)}` : "Tra cứu chưa hoàn tất."}</p>
      {result.status === "failed" && <LookupFailure error={result.error} retry={result.retry} />}
      {result.status === "completed" && <>
        <p className="field-hint">Kết quả đã áp dụng: {query.q ? `“${query.q}”` : "mọi tên/mã"}; thượng {query.upper || "tất cả"}; hạ {query.lower || "tất cả"}.</p>
        {result.data.items.length === 0 ? <p className="status-banner">Không có quẻ phù hợp. Hãy đổi từ khóa hoặc bộ lọc.</p> :
          <ul className="lookup-grid">{result.data.items.map(item => <li key={item.code}>
            <article className="section-card lookup-card"><h2><Link href={`/hexagrams/${encodeURIComponent(item.code)}`}>{item.name}</Link></h2>
              <code className="hexagram-code">{item.code}</code>
              <NameVerification status={item.verificationStatus} structural={item.nameKind === "STRUCTURAL_LABEL"} />
              <TrigramPair upper={item.upperTrigramCode} lower={item.lowerTrigramCode} />
              <Link className="source-link" href={`/hexagrams/${encodeURIComponent(item.code)}`}>Xem chi tiết {item.name} →</Link>
            </article>
          </li>)}</ul>}
        {result.data.totalPages > 1 && <nav className="lookup-pagination" aria-label="Phân trang quẻ">
          <button type="button" disabled={query.page === 0} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Trang trước</button>
          {Array.from({ length: result.data.totalPages }, (_, page) => <button type="button" key={page} aria-label={`Trang ${page + 1}`} aria-current={page === query.page ? "page" : undefined}
            onClick={() => { if (page !== query.page) setQuery({ ...query, page }); }}>{page + 1}</button>)}
          <button type="button" disabled={query.page + 1 >= result.data.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Trang sau</button>
        </nav>}
      </>}
    </section>
  </PageContainer>;
}
