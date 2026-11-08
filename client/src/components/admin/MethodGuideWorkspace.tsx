"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { divinationCatalog } from "@/config/divinationCatalog";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { createGuide, listGuideEvents, listGuides, methodGuideError, readGuide, reviewGuide, saveGuide, setGuideVisibility,
  type Guide, type GuideDraft, type GuideStatus, type MethodCode } from "@/services/rest/methodGuides";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { contentLimits, validateContentDraft } from "./adminContentValidation";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const methods = divinationCatalog.flatMap(family => family.methods.map(method => ({ ...method, group: family.group })));
type CatalogMethod = typeof methods[number];
const statuses: Record<GuideStatus, string> = { DRAFT: "Bản nháp", PENDING_REVIEW: "Chờ duyệt", PUBLISHED: "Đã công bố" };
const actions: Record<string, string> = { CREATE: "Tạo bài", SAVE_DRAFT: "Lưu bản nháp", SUBMIT_REVIEW: "Gửi duyệt",
  RETURN_TO_DRAFT: "Trả về bản nháp", PUBLISH: "Công bố", SHOW: "Hiện bài", HIDE: "Ẩn bài" };

export function MethodGuideWorkspace() {
  const [selected, setSelected] = useState<MethodCode | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [revision, setRevision] = useState(0);
  const auth = useAdminSession();
  const handleError = auth?.handleError;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listGuides(signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [handleError]);
  const list = useLookup(String(revision), load);
  const refreshList = useCallback(() => setRevision(value => value + 1), []);
  const q = query.trim().toLocaleLowerCase("vi");
  const method = methods.find(item => item.code === selected);
  if (!auth) return <p role="status">Cần phiên Admin để quản lý bài hướng dẫn.</p>;

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel}>
      <h2>Chọn phương pháp</h2>
      <div className="form-stack">
        <FormField id="admin-guide-search" label="Tìm phương pháp">
          <input id="admin-guide-search" type="search" value={query} onChange={event => setQuery(event.target.value)} />
        </FormField>
        <FormField id="admin-guide-group" label="Nhóm phương pháp">
          <select id="admin-guide-group" value={group} onChange={event => setGroup(event.target.value)}>
            <option value="">Tất cả</option>
            {divinationCatalog.map(family => <option key={family.href}>{family.group}</option>)}
          </select>
        </FormField>
      </div>
      {list.status === "loading" && <p role="status">Đang tải trạng thái bài hướng dẫn…</p>}
      {list.status === "failed" && <><p role="alert">{methodGuideError(list.error)}</p>
        <button type="button" className="secondary-button" onClick={list.retry}>Tải lại danh sách</button></>}
      <ul className={styles.recordList}>
        {methods.map(item => ({ item, summary: list.data?.items.find(row => row.methodCode === item.code) }))
          .filter(({ item, summary }) => (!group || item.group === group)
            && `${item.title} ${item.code} ${summary?.title ?? ""}`.toLocaleLowerCase("vi").includes(q))
          .map(({ item, summary }) => <li key={item.code}>
            <button type="button" aria-pressed={selected === item.code} onClick={() => setSelected(item.code)}>
              {item.title}<small>{item.group} · {summary ? statuses[summary.status] : list.data ? "Chưa có bài" : item.code}</small>
            </button>
          </li>)}
      </ul>
    </section>
    {method ? <LoadEditor key={method.code} method={method} csrf={auth.session.csrfToken}
      handleError={auth.handleError} onUpdated={refreshList} /> : <section className={styles.contentPanel}>
      <p>Chọn một phương pháp để tạo hoặc chỉnh sửa bài hướng dẫn.</p>
    </section>}
  </div>;
}

function LoadEditor({ method, csrf, handleError, onUpdated }: {
  method: CatalogMethod; csrf: string; handleError: (error: unknown) => void; onUpdated: () => void;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readGuide(method.code, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [method.code, handleError]);
  const state = useLookup(method.code, load);
  if (state.status === "loading") return <p role="status">Đang tải bài hướng dẫn…</p>;
  if (state.status === "failed") return <section className={styles.contentPanel}>
    <p role="alert">{methodGuideError(state.error)}</p>
    <button type="button" className="secondary-button" onClick={state.retry}>Thử lại</button>
  </section>;
  return <Editor method={method} initial={state.data} csrf={csrf} handleError={handleError} onUpdated={onUpdated} />;
}

function fields(method: CatalogMethod, guide: Guide | null) {
  const version = guide?.working ?? guide?.published;
  return { title: version?.title ?? method.title, body: version?.body ?? method.body, editorNote: version?.editorNote ?? "" };
}

function Editor({ method, initial, csrf, handleError, onUpdated }: {
  method: CatalogMethod; initial: Guide | null; csrf: string; handleError: (error: unknown) => void; onUpdated: () => void;
}) {
  const [guide, setGuide] = useState(initial);
  const [draft, setDraft] = useState(() => fields(method, initial));
  const [validation, setValidation] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const code = method.code;
  const saved = fields(method, guide);
  const dirty = draft.title !== saved.title || draft.body !== saved.body || draft.editorNote !== saved.editorNote;
  const errors = validation ? validateContentDraft({ ...draft, provenance: draft.editorNote, visibility: "visible" }, false) : {};
  const editing = guide?.status !== "PENDING_REVIEW";

  async function run(operation: (signal: AbortSignal) => Promise<Guide | null>, message: string, resetDraft = false) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const next = await operation(controller.signal);
      if (controller.signal.aborted) return;
      setGuide(next);
      if (resetDraft) {
        setDraft(fields(method, next));
        setPreview(false);
      }
      setConflict(false);
      setNotice(message);
      onUpdated();
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure);
        if (failure instanceof RestError && ["VERSION_CONFLICT", "GUIDE_EXISTS"].includes(failure.code)) setConflict(true);
        handleError(failure);
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function change(field: keyof typeof draft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setPreview(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setValidation(true);
    if (busy || conflict || !editing || Object.keys(validateContentDraft({ ...draft, provenance: draft.editorNote, visibility: "visible" }, false)).length) return;
    const input: GuideDraft = { title: draft.title.trim(), body: draft.body.trim(), editorNote: draft.editorNote.trim() };
    void run(signal => guide ? saveGuide(code, guide.version, input, csrf, signal) : createGuide(code, input, csrf, signal),
      "Đã lưu bản nháp.", true);
  }

  function review(action: "submit-review" | "return-to-draft" | "publish", message: string) {
    if (!guide || busy || conflict || (action === "submit-review" && dirty)) return;
    const note = action === "return-to-draft" ? reason.trim() : undefined;
    if (note === "") return;
    void run(signal => reviewGuide(code, guide.version, action, note, csrf, signal), message);
  }

  return <div className={styles.contentStack}>
    <section className={styles.contentPanel}>
      <h2>{method.title}</h2>
      <p>{guide ? `${statuses[guide.status]} · Phiên bản quản trị ${guide.version}` : "Chưa có bài hướng dẫn."}</p>
      {guide?.published && <p>Bản công bố số {guide.published.revision} · {guide.visible ? "Đang hiện" : "Đang ẩn"}</p>}
      {notice && <p role="status">{notice}</p>}
      {error !== null && <p role="alert">{methodGuideError(error)}</p>}
      {conflict && <button type="button" className="secondary-button" disabled={busy}
        onClick={() => void run(signal => readGuide(code, signal), "Đã tải phiên bản mới. Nội dung đang nhập được giữ lại.")}>
        Tải phiên bản mới
      </button>}
      <form className="form-stack" onSubmit={save} noValidate aria-label="Soạn bài hướng dẫn">
        <fieldset className="form-stack" disabled={busy || !editing}>
          <FormField id="guide-title" label="Tiêu đề">
            <input id="guide-title" value={draft.title} maxLength={contentLimits.title} required
              aria-invalid={!!errors.title || undefined} onChange={event => change("title", event.target.value)} />
            {errors.title && <FieldError id="guide-title-error">{errors.title}</FieldError>}
          </FormField>
          <FormField id="guide-body" label="Nội dung">
            <textarea id="guide-body" rows={6} value={draft.body} maxLength={contentLimits.body} required
              aria-invalid={!!errors.body || undefined} onChange={event => change("body", event.target.value)} />
            {errors.body && <FieldError id="guide-body-error">{errors.body}</FieldError>}
          </FormField>
          <FormField id="guide-note" label="Ghi chú biên tập">
            <textarea id="guide-note" rows={2} value={draft.editorNote} maxLength={contentLimits.provenance}
              onChange={event => change("editorNote", event.target.value)} />
            {errors.provenance && <FieldError id="guide-note-error">{errors.provenance}</FieldError>}
          </FormField>
          <div className={styles.contentActions}>
            <PrimaryButton type="submit" disabled={conflict}>Lưu bản nháp</PrimaryButton>
            <button type="button" className="secondary-button" onClick={() => setPreview(true)}>Xem trước</button>
            {dirty && <button type="button" className="secondary-button" onClick={() => { setDraft(saved); setPreview(false); }}>
              Dùng nội dung đã lưu
            </button>}
          </div>
        </fieldset>
      </form>
      {preview && <section className={styles.preview}><h3>{draft.title}</h3><p className={styles.guideText}>{draft.body}</p></section>}
      {guide?.status === "DRAFT" && <button type="button" className="secondary-button" disabled={busy || conflict || dirty}
        onClick={() => review("submit-review", "Đã gửi duyệt.")}>Gửi duyệt</button>}
      {guide?.status === "DRAFT" && dirty && <p className="field-hint">Lưu nội dung đang nhập trước khi gửi duyệt.</p>}
      {guide?.status === "PENDING_REVIEW" && <div className="form-stack">
        <FormField id="guide-return-reason" label="Lý do trả về">
          <textarea id="guide-return-reason" rows={2} maxLength={500} value={reason} disabled={busy}
            onChange={event => setReason(event.target.value)} />
        </FormField>
        <div className={styles.contentActions}>
          <button type="button" className="secondary-button" disabled={busy || conflict || !reason.trim()}
            onClick={() => review("return-to-draft", "Đã trả về bản nháp.")}>Trả về bản nháp</button>
          <PrimaryButton type="button" disabled={busy || conflict}
            onClick={() => review("publish", "Đã công bố bài hướng dẫn.")}>Duyệt và công bố</PrimaryButton>
        </div>
      </div>}
      {guide?.published && <details>
        <summary>Xem bản đã công bố</summary>
        <h3>{guide.published.title}</h3><p className={styles.guideText}>{guide.published.body}</p>
      </details>}
      {guide?.published && <button type="button" className="secondary-button" disabled={busy || conflict}
        onClick={() => void run(signal => setGuideVisibility(code, guide.version, !guide.visible, csrf, signal),
          guide.visible ? "Đã ẩn bài hướng dẫn." : "Đã hiện bài hướng dẫn.")}>
        {guide.visible ? "Ẩn bài hướng dẫn" : "Hiện bài hướng dẫn"}
      </button>}
    </section>
    {guide && <GuideEvents code={code} version={guide.version} handleError={handleError} />}
  </div>;
}

function GuideEvents({ code, version, handleError }: { code: MethodCode; version: number; handleError: (error: unknown) => void }) {
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listGuideEvents(code, page, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [code, page, handleError]);
  const state = useLookup(`${code}:${version}:${page}`, load);
  return <section className={styles.contentPanel}>
    <h2>Nhật ký bài hướng dẫn</h2>
    {state.status === "loading" && <p role="status">Đang tải nhật ký…</p>}
    {state.status === "failed" && <><p role="alert">{methodGuideError(state.error)}</p>
      <button type="button" className="secondary-button" onClick={state.retry}>Tải lại nhật ký</button></>}
    {state.data && <>
      <ul>{state.data.items.map(event => <li key={event.version}>
        <strong>{actions[event.action] ?? event.action}</strong> · Bản {event.revision} ·{" "}
        <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("vi-VN")}</time>
        <div><small>Admin {event.actorId}</small></div>
        {event.reason && <div>{event.reason}</div>}
      </li>)}</ul>
      <div className={styles.contentActions}>
        <button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</button>
        <button type="button" className="secondary-button" disabled={page + 1 >= state.data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
      </div>
    </>}
  </section>;
}
