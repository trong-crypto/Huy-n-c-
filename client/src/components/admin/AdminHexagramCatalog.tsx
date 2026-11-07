"use client";

import { useCallback, useState } from "react";
import { FormField } from "@/components/ui/Controls";
import { LookupFailure, NameVerification, TrigramPair } from "@/components/hexagrams/LookupPresentation";
import { SourceReferences } from "@/components/results/Evidence";
import { getHexagram, listHexagrams } from "@/services/rest/hexagrams";
import { useLookup } from "@/services/rest/useLookup";
import { AdminContentForm } from "./AdminContentForm";
import styles from "./admin.module.css";

const loadCatalog = (signal: AbortSignal) => listHexagrams({ q: "", upper: "", lower: "", page: 0, size: 64 }, signal);

function HexagramReadingEditor({ code }: { code: string }) {
  const load = useCallback((signal: AbortSignal) => getHexagram(code, signal), [code]);
  const result = useLookup(code, load);
  if (result.status === "loading") return <p role="status">Đang tải chi tiết quẻ…</p>;
  if (result.status === "failed") return <LookupFailure error={result.error} retry={result.retry} />;
  const hexagram = result.data;
  return <div className={styles.contentStack}>
    <section className={styles.contentPanel} aria-label="Chi tiết quẻ công khai">
      <h2>{hexagram.name}</h2><code>{hexagram.code}</code>
      <NameVerification status={hexagram.verificationStatus} structural={hexagram.nameKind === "STRUCTURAL_LABEL"} />
      <TrigramPair upper={hexagram.upperTrigramCode} lower={hexagram.lowerTrigramCode} />
      <h3>Nguồn tên quẻ</h3><SourceReferences sources={hexagram.sourceReferences} />
      <h3>Nghĩa tên đã đối chiếu</h3>
      {hexagram.interpretations.length === 0 && <p>Chưa có nghĩa tên đã đối chiếu trong dữ liệu công khai.</p>}
      {hexagram.interpretations.map(entry => <div key={entry.resultCode} className={styles.preview}>
        <strong>{entry.title}</strong><p>{entry.content}</p><SourceReferences sources={entry.sourceReferences} />
      </div>)}
      <p className="field-hint">Trạng thái đối chiếu nguồn ở trên thuộc dữ liệu công khai. Trạng thái duyệt bản chỉnh sửa đang chờ Backend quản trị.</p>
    </section>
    <AdminContentForm heading="Soạn đề xuất giải nghĩa" initialTitle={hexagram.name} requiresProvenance />
  </div>;
}

export function AdminHexagramCatalog() {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const result = useLookup("admin-public-hexagrams", loadCatalog);
  const keyword = query.trim().toLocaleLowerCase("vi");
  const matches = result.data?.items.filter(item => `${item.name} ${item.code}`.toLocaleLowerCase("vi").includes(keyword)) ?? [];

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="admin-hexagram-catalog" aria-busy={result.status === "loading"}>
      <h2 id="admin-hexagram-catalog">Danh mục 64 quẻ</h2>
      <p className="field-hint">Đọc từ API tra cứu công khai, chỉ dùng để đối chiếu.</p>
      <FormField id="admin-hexagram-search" label="Tìm tên hoặc mã quẻ">
        <input type="search" id="admin-hexagram-search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
      </FormField>
      {result.status === "loading" && <p role="status">Đang tải danh sách quẻ…</p>}
      {result.status === "failed" && <LookupFailure error={result.error} retry={result.retry} />}
      {result.status === "completed" && <>
        <p role="status">{matches.length} quẻ phù hợp</p>
        {matches.length === 0 ? <p>Không có quẻ phù hợp với từ khóa.</p> : <ul className={styles.recordList}>
          {matches.map(item => <li key={item.code}>
            <button type="button" aria-pressed={code === item.code} onClick={() => setCode(item.code)}>{item.name}<small>{item.code}</small></button>
          </li>)}
        </ul>}
      </>}
    </section>
    {code ? <HexagramReadingEditor key={code} code={code} /> : <p className={styles.notice}>Chọn một quẻ để xem chi tiết và nguồn đối chiếu.</p>}
  </div>;
}
