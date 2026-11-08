"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FieldError, FormField } from "@/components/ui/Controls";
import { glossError, readGloss, reviewGloss, saveGloss, setGlossVisibility,
  type GlossAction, type GlossInput, type GlossState, type GlossWorkflow } from "@/services/rest/adminHexagramGlosses";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import { cmsFieldError, cmsFieldProps, cmsTextError, stripCmsText } from "./adminContentValidation";
import styles from "./admin.module.css";

const statuses: Record<GlossWorkflow["status"], string> = { DRAFT: "Bản nháp", PENDING_REVIEW: "Chờ duyệt", PUBLISHED: "Đã công bố" };
const success = { "submit-review": "Đã gửi duyệt.", "return-to-draft": "Đã trả về bản nháp.", publish: "Đã công bố nghĩa tên." };
const fieldMessages = {
  content: "Kiểm tra nghĩa tên đề xuất.",
  sourceSectionId: "Chọn trang nguồn có đủ thông tin đối chiếu.",
  reason: "Kiểm tra lý do trả về.",
  printedSourceLabel: "Kiểm tra nhãn theo bản in.",
  verificationNote: "Kiểm tra ghi chú đối chiếu.",
};

function savedFields({ revision, detail }: GlossState): GlossInput {
  return { content: revision?.content ?? "", sourceSectionId: revision?.sourceSectionId
    ?? detail.nameGloss?.source?.sectionId ?? detail.nameSource?.sectionId ?? "" };
}

export function HexagramGlossWorkspace({ code, refreshPublic }: { code: string; refreshPublic: () => void }) {
  const auth = useAdminSession();
  return auth ? <LoadEditor code={code} auth={auth} refreshPublic={refreshPublic} />
    : <p role="status">Cần phiên Admin để biên tập nghĩa tên.</p>;
}

type Auth = NonNullable<ReturnType<typeof useAdminSession>>;

function LoadEditor({ code, auth, refreshPublic }: { code: string; auth: Auth; refreshPublic: () => void }) {
  const { handleError } = auth;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readGloss(code, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [code, handleError]);
  const state = useLookup(code, load);
  if (state.status === "loading") return <p role="status">Đang tải trạng thái duyệt nghĩa tên…</p>;
  if (state.status === "failed") return <section className={styles.contentPanel}>
    <p role="alert">{glossError(state.error)}</p>
    <button type="button" className="secondary-button" onClick={state.retry}>Thử tải lại</button>
  </section>;
  return <Editor code={code} initial={state.data} auth={auth} refreshPublic={refreshPublic} />;
}

function Editor({ code, initial, auth, refreshPublic }: { code: string; initial: GlossState; auth: Auth; refreshPublic: () => void }) {
  const [state, setState] = useState(initial);
  const [input, setInput] = useState(() => savedFields(initial));
  const [reason, setReason] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const { detail, revision, workflow } = state;
  const saved = savedFields(state);
  const dirty = input.content !== saved.content || input.sourceSectionId !== saved.sourceSectionId;
  const pending = workflow?.status === "PENDING_REVIEW";
  const mayPublish = revision !== null && revision.createdBy !== auth.session.account.id;
  const fieldError = cmsFieldError(error, fieldMessages);
  const contentError = cmsTextError(input.content, 500, "Nghĩa tên đề xuất");
  const reasonError = cmsTextError(reason, 500, "Lý do trả về");
  const labelError = cmsTextError(label, 120, "Nhãn theo bản in");
  const noteError = cmsTextError(note, 500, "Ghi chú đối chiếu");
  const issue = (field: keyof typeof fieldMessages, local = "", value = "") =>
    fieldError?.field === field ? fieldError.message : value ? local : "";
  const contentIssue = issue("content", contentError, input.content);
  const sourceIssue = issue("sourceSectionId");
  const reasonIssue = issue("reason", reasonError, reason);
  const labelIssue = issue("printedSourceLabel", labelError, label);
  const noteIssue = issue("verificationNote", noteError, note);
  function clearFieldError(field: keyof typeof fieldMessages) {
    if (fieldError?.field === field) setError(null);
  }
  const options = new Map<string, string>();
  for (const source of [detail.nameGloss?.source, detail.nameSource]) {
    if (source) options.set(source.sectionId, `${source.reference.title} · ${source.reference.section} · trang PDF ${source.reference.pdfPage ?? "—"}`);
  }
  if (revision) options.set(revision.sourceSectionId, `${revision.source.title} · ${revision.source.section} · trang PDF ${revision.source.pdfPage}`);
  if (input.sourceSectionId && !options.has(input.sourceSectionId)) options.set(input.sourceSectionId, "Trang nguồn của nội dung đang nhập");

  async function refresh(message: string, write?: (signal: AbortSignal) => Promise<void>, preserveEdits = false) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    let written = false;
    try {
      if (write) {
        await write(controller.signal);
        written = true;
      }
      const next = await readGloss(code, controller.signal);
      if (controller.signal.aborted) return;
      setState(next);
      if (!dirty || write && !preserveEdits) setInput(savedFields(next));
      if (write && !preserveEdits || next.workflow?.draftVersion !== workflow?.draftVersion) {
        setReason("");
        setLabel("");
        setNote("");
      }
      setNeedsReload(false);
      setNotice((!write || preserveEdits) && dirty ? `${message} Nội dung đang nhập được giữ lại.` : message);
      refreshPublic();
    } catch (failure) {
      if (controller.signal.aborted) return;
      auth.handleError(failure);
      setError(written ? "Thao tác đã được ghi. Hãy tải lại để xem trạng thái mới." : failure);
      if (write && (written || !cmsFieldError(failure, fieldMessages))) setNeedsReload(true);
      if (written) refreshPublic();
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (busy || needsReload || pending || !dirty || !input.sourceSectionId || contentError) return;
    void refresh("Đã lưu bản nháp.", signal => saveGloss(code, revision?.version,
      { ...input, content: stripCmsText(input.content) }, auth.session.csrfToken, signal));
  }

  function review(command: GlossAction) {
    if (!workflow || busy || needsReload) return;
    void refresh(success[command.action], signal => reviewGloss(code, workflow.version, command, auth.session.csrfToken, signal));
  }

  function changeVisibility() {
    if (!workflow?.publishedVersion || busy || needsReload) return;
    const visible = !workflow.visible;
    void refresh(visible ? "Đã hiện nghĩa tên công khai." : "Đã ẩn nghĩa tên công khai.",
      signal => setGlossVisibility(code, workflow.version, visible, auth.session.csrfToken, signal), true);
  }

  return <section className={styles.contentPanel} aria-label="Duyệt nghĩa tên quẻ" aria-busy={busy}>
    <h2>Duyệt nghĩa tên quẻ</h2>
    <p>{workflow ? `${statuses[workflow.status]} · Phiên bản nháp ${workflow.draftVersion}` : "Chưa có bản nháp."}</p>
    <p>{workflow?.publishedVersion ? `Bản công bố số ${workflow.publishedVersion} · ${workflow.visible ? "Đang hiện" : "Đang ẩn"}`
      : "Nghĩa tên công khai lấy từ bộ E01."}</p>
    {workflow?.publishedVersion && <details key={String(workflow.visible)} className={styles.reviewDetails}>
      <summary>{workflow.visible ? "Ẩn nghĩa tên công khai" : "Hiện nghĩa tên công khai"}</summary>
      <p>{workflow.visible ? "Người dùng vẫn tra cứu được quẻ. Mục nghĩa tên sẽ ẩn cho tới khi Admin bật hiện."
        : `Phiên bản đã công bố số ${workflow.publishedVersion} sẽ hiển thị cho người dùng.`}</p>
      <button type="button" className="secondary-button" disabled={busy || needsReload} onClick={changeVisibility}>
        {workflow.visible ? "Xác nhận ẩn nghĩa tên" : "Xác nhận hiện nghĩa tên"}
      </button>
    </details>}
    {workflow?.lastEvent?.action === "RETURN" && workflow.lastEvent.revision === workflow.draftVersion
      && <p>Lý do trả về: {workflow.lastEvent.reason}</p>}
    {notice && <p role="status">{notice}</p>}
    {error !== null && !fieldError && <p role="alert">{typeof error === "string" ? error : glossError(error)}</p>}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void refresh("Đã tải phiên bản mới.")}>
      Tải phiên bản mới
    </button>
    {revision && <div className={styles.preview}>
      <h3>Nội dung đã lưu</h3>
      <p>{revision.content}</p>
      <p>{revision.source.title} · {revision.source.edition} · {revision.source.section}</p>
      <p>Trang in {revision.source.printedPage} · Trang PDF {revision.source.pdfPage}</p>
      <details><summary>Dấu vân tay nguồn đã lưu</summary><code>{revision.source.sha256}</code></details>
    </div>}
    <form className="form-stack" onSubmit={save} aria-label="Soạn nghĩa tên">
      <fieldset className="form-stack" disabled={busy || pending || needsReload}>
        <FormField id="hexagram-gloss-content" label="Nghĩa tên đề xuất" hint="Một dòng, tối đa 500 ký tự.">
          <input id="hexagram-gloss-content" value={input.content} required aria-describedby="hexagram-gloss-content-hint"
            {...cmsFieldProps("hexagram-gloss-content", contentIssue)}
            onChange={event => {
              clearFieldError("content");
              setInput(current => ({ ...current, content: event.target.value }));
            }} />
          {contentIssue && <FieldError id="hexagram-gloss-content-error">{contentIssue}</FieldError>}
        </FormField>
        <FormField id="hexagram-gloss-source" label="Trang nguồn đối chiếu">
          <select id="hexagram-gloss-source" value={input.sourceSectionId} required {...cmsFieldProps("hexagram-gloss-source", sourceIssue)}
            onChange={event => {
              clearFieldError("sourceSectionId");
              setInput(current => ({ ...current, sourceSectionId: event.target.value }));
            }}>
            <option value="">Chọn trang nguồn</option>
            {[...options].map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
          {sourceIssue && <FieldError id="hexagram-gloss-source-error">{sourceIssue}</FieldError>}
        </FormField>
        <button type="submit" className="secondary-button" disabled={!dirty || !!contentError || !input.sourceSectionId}>Lưu bản nháp</button>
      </fieldset>
    </form>
    {workflow?.status === "DRAFT" && <div className={styles.contentActions}>
      <button type="button" className="secondary-button" disabled={busy || needsReload || dirty}
        onClick={() => review({ action: "submit-review" })}>Gửi duyệt</button>
      {dirty && <small className="field-hint">Lưu nội dung đang nhập trước khi gửi duyệt.</small>}
    </div>}
    {pending && <fieldset className="form-stack" disabled={busy || needsReload}>
      <legend>Xử lý bản đang chờ duyệt</legend>
      <FormField id="hexagram-gloss-reason" label="Lý do trả về">
        <input id="hexagram-gloss-reason" value={reason} {...cmsFieldProps("hexagram-gloss-reason", reasonIssue)}
          onChange={event => { clearFieldError("reason"); setReason(event.target.value); }} />
        {reasonIssue && <FieldError id="hexagram-gloss-reason-error">{reasonIssue}</FieldError>}
      </FormField>
      <button type="button" className="secondary-button" disabled={!!reasonError}
        onClick={() => review({ action: "return-to-draft", reason: stripCmsText(reason) })}>Trả về bản nháp</button>
      {mayPublish ? <>
        <FormField id="hexagram-gloss-label" label="Nhãn theo bản in">
          <input id="hexagram-gloss-label" value={label} {...cmsFieldProps("hexagram-gloss-label", labelIssue)}
            onChange={event => { clearFieldError("printedSourceLabel"); setLabel(event.target.value); }} />
          {labelIssue && <FieldError id="hexagram-gloss-label-error">{labelIssue}</FieldError>}
        </FormField>
        <FormField id="hexagram-gloss-note" label="Ghi chú đối chiếu">
          <input id="hexagram-gloss-note" value={note} {...cmsFieldProps("hexagram-gloss-note", noteIssue)}
            onChange={event => { clearFieldError("verificationNote"); setNote(event.target.value); }} />
          {noteIssue && <FieldError id="hexagram-gloss-note-error">{noteIssue}</FieldError>}
        </FormField>
        <button type="button" className="primary-button" disabled={!!labelError || !!noteError}
          onClick={() => review({ action: "publish", printedSourceLabel: stripCmsText(label), verificationNote: stripCmsText(note) })}>
          Xác nhận công bố
        </button>
      </> : <p className="field-hint">Cần Admin khác người soạn để công bố phiên bản này.</p>}
    </fieldset>}
  </section>;
}
