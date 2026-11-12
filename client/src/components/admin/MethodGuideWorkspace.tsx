"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { createGuide, listGuideEvents, methodGuideError, readGuide, saveGuide, setGuideVisibility,
  type Guide, type GuideDraft, type GuideEvent, type GuideStatus, type MethodCode, type Page } from "@/services/rest/methodGuides";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { cmsFieldError, cmsFieldProps, cmsTextError, contentLimits, stripCmsText } from "./adminContentValidation";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const statuses: Record<GuideStatus, string> = { DRAFT: "Bản nháp cũ", PENDING_REVIEW: "Chờ duyệt bản cũ", PUBLISHED: "Đã cập nhật trực tiếp" };
const actions: Record<string, string> = { CREATE: "Tạo và công bố bài", SAVE_DRAFT: "Cập nhật nội dung", SUBMIT_REVIEW: "Gửi duyệt (lịch sử)",
  RETURN_TO_DRAFT: "Trả về bản nháp", PUBLISH: "Công bố", SHOW: "Hiện bài", HIDE: "Ẩn bài" };
const fieldMessages = {
  title: "Kiểm tra tiêu đề bài hướng dẫn.",
  body: "Kiểm tra nội dung bài hướng dẫn.",
  editorNote: "Kiểm tra ghi chú biên tập.",
  reason: "Kiểm tra lý do trả về.",
};

type EditorState = Pick<Guide, "status" | "version"> & {
  working: (NonNullable<Guide["working"]> & { createdBy?: string }) | null;
  published: (Omit<NonNullable<Guide["published"]>, "editorNote"> & { editorNote?: string | null }) | null;
  visible?: boolean;
};
type Editable<Code extends string> = { code: Code; title: string; body: string };
type EditorApi<Code extends string> = {
  read: (code: Code, signal: AbortSignal) => Promise<EditorState | null>;
  create: (code: Code, draft: GuideDraft, csrf: string, signal: AbortSignal) => Promise<EditorState>;
  save: (code: Code, version: number, draft: GuideDraft, csrf: string, signal: AbortSignal) => Promise<EditorState>;
  events: (code: Code, page: number, signal: AbortSignal) => Promise<Page<GuideEvent>>;
  visibility?: (code: Code, version: number, visible: boolean, csrf: string, signal: AbortSignal) => Promise<EditorState>;
};
const methodApi: EditorApi<MethodCode> = { read: readGuide, create: createGuide, save: saveGuide,
  events: listGuideEvents, visibility: setGuideVisibility };

export function MethodGuideEditor({ method, compact = false }: { method: Editable<MethodCode>; compact?: boolean }) {
  const auth = useAdminSession();
  if (!auth) return <p role="status">Cần phiên Admin để quản lý bài hướng dẫn.</p>;
  return <LoadContentEditor method={method} api={methodApi} csrf={auth.session.csrfToken} handleError={auth.handleError} compact={compact} />;
}

export function LoadContentEditor<Code extends string>({ method, api, csrf, handleError, onUpdated, compact = false }: {
  method: Editable<Code>; api: EditorApi<Code>; csrf: string; handleError: (error: unknown) => void;
  onUpdated?: () => void; compact?: boolean;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await api.read(method.code, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [method.code, api, handleError]);
  const state = useLookup(method.code, load);
  if (state.status === "loading") return <p role="status">Đang tải bài hướng dẫn…</p>;
  if (state.status === "failed") return <section className={styles.contentPanel}>
    <p role="alert">{methodGuideError(state.error)}</p>
    <button type="button" className="secondary-button" onClick={state.retry}>Thử lại</button>
  </section>;
  return <Editor method={method} api={api} initial={state.data} csrf={csrf} handleError={handleError}
    onUpdated={onUpdated} compact={compact} />;
}

function fields(method: Editable<string>, guide: EditorState | null) {
  const version = guide?.working ?? guide?.published;
  return { title: version?.title ?? method.title, body: version?.body ?? method.body, editorNote: version?.editorNote ?? "" };
}

function Editor<Code extends string>({ method, api, initial, csrf, handleError, onUpdated, compact = false }: {
  method: Editable<Code>; api: EditorApi<Code>; initial: EditorState | null; csrf: string;
  handleError: (error: unknown) => void; onUpdated?: () => void; compact?: boolean;
}) {
  const [guide, setGuide] = useState(initial);
  const [draft, setDraft] = useState(() => fields(method, initial));
  const [validation, setValidation] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const code = method.code;
  const saved = fields(method, guide);
  const dirty = draft.title !== saved.title || draft.body !== saved.body || draft.editorNote !== saved.editorNote;
  const fieldError = cmsFieldError(error, fieldMessages);
  const titleError = cmsTextError(draft.title, contentLimits.title, "Tiêu đề");
  const bodyError = cmsTextError(draft.body, contentLimits.body, "Nội dung", true);
  const noteError = cmsTextError(draft.editorNote, contentLimits.provenance, "Ghi chú biên tập", true, true);
  const issue = (field: keyof typeof fieldMessages, local: string, show: boolean) =>
    fieldError?.field === field ? fieldError.message : show ? local : "";
  const titleIssue = issue("title", titleError, validation);
  const bodyIssue = issue("body", bodyError, validation);
  const noteIssue = issue("editorNote", noteError, validation);
  const editing = true;
  const visibility = api.visibility;

  async function run(operation: (signal: AbortSignal) => Promise<EditorState | null>, message: string, resetDraft = false) {
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
      onUpdated?.();
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure);
        if (failure instanceof RestError && ["VERSION_CONFLICT", "GUIDE_EXISTS", "INVALID_TRANSITION"].includes(failure.code)) setConflict(true);
        handleError(failure);
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function change(field: keyof typeof draft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    if (fieldError?.field === field) setError(null);
    setPreview(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setValidation(true);
    if (busy || conflict || !editing || titleError || bodyError || noteError) return;
    const input: GuideDraft = { title: stripCmsText(draft.title), body: stripCmsText(draft.body), editorNote: stripCmsText(draft.editorNote) };
    void run(signal => guide ? api.save(code, guide.version, input, csrf, signal) : api.create(code, input, csrf, signal),
      "Đã lưu và cập nhật nội dung.", true);
  }

  return <div className={`${styles.contentStack} ${compact ? styles.compactGuide : ""}`}>
    <section className={styles.contentPanel}>
      {!compact && <h2>{method.title}</h2>}
      <p>{guide ? `${statuses[guide.status]} · Phiên bản quản trị ${guide.version}` : "Chưa có bài hướng dẫn."}</p>
      <p className="field-hint">Khi lưu, nội dung được cập nhật ngay trên website và lưu thành phiên bản mới trong nhật ký Admin.</p>
      {guide?.published && <p>Bản công bố số {guide.published.revision}{visibility && (guide.visible ? " · Đang hiện" : " · Đang ẩn")}</p>}
      {conflict && <button type="button" className="secondary-button" disabled={busy}
        onClick={() => void run(signal => api.read(code, signal), "Đã tải phiên bản mới. Nội dung đang nhập được giữ lại.")}>
        Tải phiên bản mới
      </button>}
      <form className="form-stack" onSubmit={save} noValidate aria-label="Soạn bài hướng dẫn">
        <fieldset className={styles.guideEditorFields} disabled={busy || !editing}>
          <FormField id="guide-title" label="Tiêu đề">
            <input id="guide-title" value={editing ? draft.title : saved.title} required {...cmsFieldProps("guide-title", titleIssue)}
              onChange={event => change("title", event.target.value)} />
            {titleIssue && <FieldError id="guide-title-error">{titleIssue}</FieldError>}
          </FormField>
          <FormField id="guide-body" label="Nội dung">
            <textarea id="guide-body" rows={6} value={editing ? draft.body : saved.body} required {...cmsFieldProps("guide-body", bodyIssue)}
              onChange={event => change("body", event.target.value)} />
            {bodyIssue && <FieldError id="guide-body-error">{bodyIssue}</FieldError>}
          </FormField>
          <FormField id="guide-note" label="Ghi chú biên tập">
            <textarea id="guide-note" rows={2} value={editing ? draft.editorNote : saved.editorNote} {...cmsFieldProps("guide-note", noteIssue)}
              onChange={event => change("editorNote", event.target.value)} />
            {noteIssue && <FieldError id="guide-note-error">{noteIssue}</FieldError>}
          </FormField>
          <div className={styles.contentActions}>
            <PrimaryButton type="submit" disabled={conflict}>Lưu và cập nhật</PrimaryButton>
            <button type="button" className="secondary-button" onClick={() => setPreview(true)}>Xem trước</button>
            {dirty && <button type="button" className="secondary-button" onClick={() => { setDraft(saved); setPreview(false); }}>
              Dùng nội dung đã lưu
            </button>}
          </div>
        </fieldset>
      </form>
      {guide?.published && <details>
        <summary>Xem bản đã công bố</summary>
        <h3>{guide.published.title}</h3><p className={styles.guideText}>{guide.published.body}</p>
      </details>}
      {guide?.published && visibility && <button type="button" className="secondary-button" disabled={busy || conflict}
        onClick={() => void run(signal => visibility(code, guide.version, !guide.visible, csrf, signal),
          guide.visible ? "Đã ẩn bài hướng dẫn." : "Đã hiện bài hướng dẫn.")}>
        {guide.visible ? "Ẩn bài hướng dẫn" : "Hiện bài hướng dẫn"}
      </button>}
      {notice && <p role="status">{notice}</p>}
      {error !== null && !fieldError && <p role="alert">{methodGuideError(error)}</p>}
      {preview && <section className={styles.preview}><h3>{draft.title}</h3><p className={styles.guideText}>{draft.body}</p></section>}
    </section>
    {guide && (compact
      ? <details className={styles.guideHistory}><summary>Nhật ký bài hướng dẫn</summary>
        <GuideEvents code={code} version={guide.version} listEvents={api.events} handleError={handleError} /></details>
      : <GuideEvents code={code} version={guide.version} listEvents={api.events} handleError={handleError} />)}
  </div>;
}

function GuideEvents<Code extends string>({ code, version, listEvents, handleError }: {
  code: Code; version: number; listEvents: EditorApi<Code>["events"]; handleError: (error: unknown) => void;
}) {
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listEvents(code, page, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [code, page, listEvents, handleError]);
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
