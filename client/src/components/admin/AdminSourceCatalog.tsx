"use client";

import { useCallback, useState, type FormEvent } from "react";
import { SourceReferences } from "@/components/results/Evidence";
import { FormField } from "@/components/ui/Controls";
import { listAdminSources, readAdminSource, sourceCatalogError, sourceKinds, sourceStatuses,
  type SourceEntry, type SourceKind } from "@/services/rest/adminSourceCatalog";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import { SourceProposalWorkspace } from "./SourceProposalWorkspace";
import styles from "./admin.module.css";

type HandleError = (error: unknown) => void;

export function AdminSourceCatalog() {
  const auth = useAdminSession();
  return auth ? <Catalog csrf={auth.session.csrfToken} actorId={auth.session.account.id} handleError={auth.handleError} />
    : <p role="status">Cần phiên Admin để xem dữ liệu nguồn.</p>;
}

function Catalog({ csrf, actorId, handleError }: { csrf: string; actorId: string; handleError: HandleError }) {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<{ query: string; kind: SourceKind | ""; page: number }>({ query: "", kind: "", page: 0 });
  const [selected, setSelected] = useState<SourceEntry | null>(null);
  const { query, kind, page } = filters;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listAdminSources(query, kind, page, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [query, kind, page, handleError]);
  const result = useLookup(JSON.stringify(filters), load);

  function search(event: FormEvent) {
    event.preventDefault();
    setSelected(null);
    setFilters(current => ({ ...current, query: text.trim(), page: 0 }));
  }

  function changePage(next: number) {
    setSelected(null);
    setFilters(current => ({ ...current, page: next }));
  }

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="admin-source-catalog" aria-busy={result.status === "loading"}>
      <h2 id="admin-source-catalog">Danh sách dữ liệu nguồn</h2>
      <p className="field-hint">Tra cứu ấn bản, trang và các bản ghi tham chiếu trực tiếp.</p>
      <form className={styles.inlineFields} onSubmit={search}>
        <FormField id="admin-source-search" label="Tìm tên, mục hoặc trang">
          <input id="admin-source-search" type="search" value={text} maxLength={100} onChange={event => setText(event.target.value)} />
        </FormField>
        <FormField id="admin-source-kind" label="Loại nguồn">
          <select id="admin-source-kind" value={kind} onChange={event => {
            setSelected(null);
            setFilters(current => ({ ...current, kind: event.target.value as SourceKind | "", page: 0 }));
          }}>
            <option value="">Tất cả</option>
            {Object.entries(sourceKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        <button type="submit" className="secondary-button">Tìm nguồn</button>
      </form>
      {result.status === "loading" && <p role="status">Đang tải dữ liệu nguồn…</p>}
      {result.status === "failed" && <><p role="alert">{sourceCatalogError(result.error)}</p>
        <button type="button" className="secondary-button" onClick={result.retry}>Tải lại danh sách</button></>}
      {result.data && <>
        <p role="status">{result.data.totalElements} mục phù hợp</p>
        {result.data.items.length === 0 ? <p>Không có dữ liệu nguồn phù hợp.</p> : <ul className={styles.recordList}>
          {result.data.items.map(item => <li key={`${item.kind}:${item.id}`}>
            <button type="button" aria-pressed={selected?.kind === item.kind && selected.id === item.id}
              onClick={() => setSelected(item)}>
              {item.reference.title}
              <small>{item.reference.section} · {item.reference.pdfPage === null ? sourceKinds[item.kind] : `PDF ${item.reference.pdfPage}`}</small>
            </button>
          </li>)}
        </ul>}
        <div className={styles.contentActions}>
          <button type="button" className="secondary-button" disabled={page === 0} onClick={() => changePage(page - 1)}>Trang trước</button>
          <button type="button" className="secondary-button" disabled={page + 1 >= result.data.totalPages}
            onClick={() => changePage(page + 1)}>Trang sau</button>
        </div>
      </>}
    </section>
    {selected ? <SourceDetail key={`${selected.kind}:${selected.id}`} entry={selected} csrf={csrf} actorId={actorId} handleError={handleError} />
      : <p className={styles.notice}>Chọn một mục để xem chi tiết nguồn.</p>}
  </div>;
}

function SourceDetail({ entry, csrf, actorId, handleError }: { entry: SourceEntry; csrf: string; actorId: string; handleError: HandleError }) {
  const [applied, setApplied] = useState<{ author?: string; publisher?: string }>({});
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readAdminSource(entry, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [entry, handleError]);
  const state = useLookup(`${entry.kind}:${entry.id}`, load);
  return <section className={styles.contentPanel} aria-label="Chi tiết nguồn">
    <h2>Chi tiết nguồn</h2>
    {state.status === "loading" && <p role="status">Đang tải chi tiết nguồn…</p>}
    {state.status === "failed" && <><p role="alert">{sourceCatalogError(state.error)}</p>
      <button type="button" className="secondary-button" onClick={state.retry}>Tải lại chi tiết</button></>}
    {state.data && <>
      <p>{sourceKinds[state.data.entry.kind]} · <code>{state.data.entry.id}</code></p>
      <SourceReferences sources={[state.data.entry.reference]} />
      {state.data.book && <dl className={styles.workflow}>
        <div><dt>Tác giả</dt><dd>{applied.author ?? state.data.book.author ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Nhà xuất bản</dt><dd>{applied.publisher ?? state.data.book.publisher ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Năm xuất bản</dt><dd>{state.data.book.publicationYear ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Số trang PDF</dt><dd>{state.data.book.pdfPageCount ?? "Chưa có dữ liệu"}</dd></div>
      </dl>}
      <h3>Quy tắc tham chiếu trực tiếp</h3>
      {state.data.rules.length ? <ul>{state.data.rules.map(rule => <li key={`${rule.module}:${rule.code}:${rule.version}`}>
        <code>{rule.code}</code> · {rule.module} · {rule.version} · {sourceStatuses[rule.status]}
      </li>)}</ul> : <p>Không có quy tắc tham chiếu trực tiếp.</p>}
      <h3>Bản ghi diễn giải gốc tham chiếu trực tiếp</h3>
      {state.data.interpretations.length ? <ul>{state.data.interpretations.map(item => <li key={`${item.category}:${item.status}`}>
        <code>{item.category}</code> · {sourceStatuses[item.status]} · {item.count} bản ghi
      </li>)}</ul> : <p>Không có bản ghi diễn giải gốc tham chiếu trực tiếp.</p>}
      <SourceProposalWorkspace entry={state.data.entry} csrf={csrf} actorId={actorId} handleError={handleError}
        onApplied={(field, value) => setApplied(current => ({ ...current, [field === "AUTHOR" ? "author" : "publisher"]: value }))} />
    </>}
  </section>;
}
