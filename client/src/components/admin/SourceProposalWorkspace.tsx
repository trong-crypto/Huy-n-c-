"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { SourceReferences } from "@/components/results/Evidence";
import { FieldError, FormField } from "@/components/ui/Controls";
import { bookFields, readSourceProposal, requestSourceApplication, saveSourceProposal,
  sourceCatalogError, type BookField, type SourceApplication, type SourceEntry,
  type SourceProposalState } from "@/services/rest/adminSourceCatalog";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { cmsFieldError, cmsFieldProps, cmsTextError, stripCmsText } from "./adminContentValidation";
import styles from "./admin.module.css";

type Access = { csrf: string; handleError: (error: unknown) => void;
  onApplied: (field: BookField, value: string) => void };
const messages = { proposal: "Kiểm tra nội dung đề xuất.", reason: "Kiểm tra lý do chỉnh sửa.",
  bookField: "Chọn trường metadata được hỗ trợ.", bookValue: "Kiểm tra giá trị metadata đề xuất." };
const reloadErrors = new Set(["SOURCE_PROPOSAL_EXISTS", "VERSION_CONFLICT", "NOT_FOUND", "INVALID_RESPONSE",
  "REQUEST_TIMEOUT", "NETWORK_ERROR", "INTERNAL_ERROR", "INVALID_TRANSITION", "SOURCE_ALREADY_APPLIED", "SOURCE_CHANGED"]);
const statuses = { DRAFT: "Bản nháp cũ", PENDING_REVIEW: "Đang chờ xử lý cũ", APPROVED: "Đã ghi nhận trực tiếp" } as const;
const events = { SUBMIT: "Gửi duyệt (lịch sử)", RETURN: "Trả về (lịch sử)", APPROVE: "Cập nhật trực tiếp" } as const;

export function SourceProposalWorkspace({ entry, ...access }: { entry: SourceEntry } & Access) {
  const [open, setOpen] = useState(false);
  return <section className={styles.contentStack} aria-label="Đề xuất chỉnh sửa nguồn">
    {!open ? <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Cập nhật thông tin nguồn</button>
      : <LoadProposal entry={entry} {...access} />}
  </section>;
}

function LoadProposal({ entry, ...access }: { entry: SourceEntry } & Access) {
  const { handleError } = access;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readSourceProposal(entry, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [entry, handleError]);
  const result = useLookup(`${entry.kind}:${entry.id}`, load);
  if (result.status === "loading") return <p role="status">Đang tải đề xuất chỉnh sửa…</p>;
  if (result.status === "failed") return <>
    <p role="alert">{sourceCatalogError(result.error)}</p>
    <button type="button" className="secondary-button" onClick={result.retry}>Tải lại đề xuất</button>
  </>;
  return <ProposalEditor entry={entry} initial={result.data} {...access} />;
}

function fields(state: SourceProposalState) {
  return { proposal: state?.revision.proposal ?? "", reason: state?.revision.reason ?? "",
    bookField: state?.revision.bookChange?.field ?? "" as const, bookValue: state?.revision.bookChange?.value ?? "" };
}

function ProposalEditor({ entry, initial, csrf, handleError, onApplied }: { entry: SourceEntry; initial: SourceProposalState } & Access) {
  const [state, setState] = useState(initial);
  const [input, setInput] = useState(() => fields(initial));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [application, setApplication] = useState<SourceApplication | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const revision = state?.revision;
  const workflow = state?.workflow;
  const saved = fields(state);
  const dirty = input.proposal !== saved.proposal || input.reason !== saved.reason
    || input.bookField !== saved.bookField || !!input.bookField && input.bookValue !== saved.bookValue;
  const proposalError = cmsTextError(input.proposal, 2000, "Nội dung đề xuất", true);
  const reasonError = cmsTextError(input.reason, 500, "Lý do chỉnh sửa", true);
  const bookError = !input.bookField ? "" : /[\u2028\u2029]/u.test(input.bookValue) ? "Giá trị đề xuất phải nằm trên một dòng."
    : cmsTextError(input.bookValue, 300, "Giá trị đề xuất");
  const serverField = cmsFieldError(error, messages);
  const proposalIssue = serverField?.field === "proposal" ? serverField.message : submitted ? proposalError : "";
  const reasonIssue = serverField?.field === "reason" ? serverField.message : submitted ? reasonError : "";
  const bookIssue = serverField?.field === "bookValue" ? serverField.message : submitted ? bookError : "";

  function change(field: "proposal" | "reason" | "bookValue", value: string) {
    if (serverField?.field === field) setError(null);
    setApplication(null);
    setInput(current => ({ ...current, [field]: value }));
  }

  async function run(message: string, write?: (signal: AbortSignal) => Promise<unknown>, resetDraft = false): Promise<boolean> {
    if (request.current) return false;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    setApplication(null);
    let written = false;
    try {
      if (write) {
        await write(controller.signal);
        written = true;
      }
      const next = await readSourceProposal(entry, controller.signal);
      if (controller.signal.aborted) return false;
      setState(next);
      if (resetDraft || !dirty) {
        setInput(fields(next));
        setSubmitted(false);
      }
      setNeedsReload(false);
      setNotice(!write && dirty ? `${message} Nội dung đang nhập được giữ lại.` : message);
      return true;
    } catch (failure) {
      if (controller.signal.aborted) return false;
      setError(written ? "Thao tác đã được ghi. Hãy tải lại để xem trạng thái mới." : failure);
      handleError(failure);
      if (written || write && failure instanceof RestError && reloadErrors.has(failure.code)) setNeedsReload(true);
      return false;
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (busy || needsReload || !dirty || proposalError || reasonError || bookError) return;
    const content = { proposal: stripCmsText(input.proposal), reason: stripCmsText(input.reason) };
    const draft = input.bookField ? { ...content, bookField: input.bookField, bookValue: stripCmsText(input.bookValue) } : content;
    void run("Đã cập nhật trực tiếp; căn cứ và lịch sử đã được lưu.",
      signal => saveSourceProposal(entry, revision?.version, draft, csrf, signal), true)
      .then(ok => { if (ok && input.bookField) onApplied(input.bookField, stripCmsText(input.bookValue)); });
  }

  async function inspectApplication() {
    if (!state || state.workflow.status !== "APPROVED" || !state.revision.bookChange || dirty || needsReload || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await requestSourceApplication(entry, state, controller.signal);
      if (controller.signal.aborted) return;
      setApplication(result);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setApplication(null);
      setError(failure);
      handleError(failure);
      if (failure instanceof RestError && reloadErrors.has(failure.code)) setNeedsReload(true);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div className={styles.sourceUpdate} aria-busy={busy}>
    <header className={styles.sourceUpdateHeader}>
      <div><h3>Cập nhật thông tin nguồn</h3>
        <p className="field-hint">Nội dung được lưu và áp dụng ngay, kèm căn cứ cùng lịch sử Admin.</p>
      </div>
      <span className={styles.sourceUpdateStatus}>Cập nhật trực tiếp</span>
    </header>
    {entry.kind === "EXTERNAL_ALGORITHM" && <p className={styles.sourceUpdateNotice}>
      Biểu mẫu này không thay đổi URL hoặc dấu vân tay của nguồn bên ngoài.
    </p>}
    {workflow && <p>{statuses[workflow.status]} · Phiên bản {workflow.draftVersion}</p>}
    {workflow?.approvedVersion && <p>Phiên bản đã cập nhật gần nhất: {workflow.approvedVersion}</p>}
    {(revision || needsReload) && <button type="button" className="secondary-button" disabled={busy}
      onClick={() => void run("Đã tải phiên bản mới.")}>
      Tải phiên bản mới
    </button>}
    <form className={styles.sourceUpdateForm} noValidate onSubmit={submit}>
      <fieldset className={styles.sourceUpdateFields} disabled={busy || needsReload}>
        <div className={styles.sourceProposalBlock}>
          <p className={styles.sourceUpdateStep}><span className={styles.sourceUpdateStepNumber}>1</span><span>Nội dung chỉnh sửa</span></p>
        <FormField id="source-proposal-content" label="Nội dung đề xuất" hint="Tối đa 2.000 ký tự.">
          <textarea id="source-proposal-content" rows={5} required value={input.proposal}
            aria-describedby="source-proposal-content-hint" {...cmsFieldProps("source-proposal-content", proposalIssue)}
            onChange={event => change("proposal", event.target.value)} />
          {proposalIssue && <FieldError id="source-proposal-content-error">{proposalIssue}</FieldError>}
        </FormField>
        </div>
        {entry.kind === "BOOK_PAGE" && <>
          <div className={styles.sourceMetadataBlock}>
          <p className={styles.sourceUpdateStep}><span className={styles.sourceUpdateStepNumber}>2</span><span>Thông tin ấn bản</span></p>
          <FormField id="source-proposal-book-field" label="Trường cần cập nhật (tùy chọn)"
            hint="Giữ lựa chọn mặc định nếu chỉ muốn ghi nội dung chỉnh sửa.">
            <select id="source-proposal-book-field" value={input.bookField} onChange={event => {
              setApplication(null);
              if (serverField?.field === "bookField" || serverField?.field === "bookValue") setError(null);
              setInput(current => ({ ...current, bookField: event.target.value as BookField | "", bookValue: "" }));
            }} aria-describedby="source-proposal-book-field-hint"
              {...cmsFieldProps("source-proposal-book-field", serverField?.field === "bookField" ? serverField.message : "")}>
              <option value="">Chỉ ghi đề xuất để tham khảo</option>
              {Object.entries(bookFields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {serverField?.field === "bookField" && <FieldError id="source-proposal-book-field-error">{serverField.message}</FieldError>}
          </FormField>
          {input.bookField && <FormField id="source-proposal-book-value" label="Giá trị mới" hint="Một dòng, tối đa 300 ký tự.">
            <input id="source-proposal-book-value" value={input.bookValue} required
              aria-describedby="source-proposal-book-value-hint" {...cmsFieldProps("source-proposal-book-value", bookIssue)}
              onChange={event => change("bookValue", event.target.value)} />
            {bookIssue && <FieldError id="source-proposal-book-value-error">{bookIssue}</FieldError>}
          </FormField>}
          <p className={styles.sourceUpdateNotice}>Khi chọn trường metadata, giá trị mới sẽ áp dụng cho toàn bộ ấn bản và các trang nguồn thuộc ấn bản đó.</p>
          </div>
        </>}
        <div className={`${styles.sourceReasonBlock} ${entry.kind !== "BOOK_PAGE" ? styles.sourceReasonWide : ""}`}>
        <p className={styles.sourceUpdateStep}><span className={styles.sourceUpdateStepNumber}>{entry.kind === "BOOK_PAGE" ? "3" : "2"}</span><span>Căn cứ cập nhật</span></p>
        <FormField id="source-proposal-reason" label="Lý do chỉnh sửa" hint="Tối đa 500 ký tự.">
          <textarea id="source-proposal-reason" rows={3} required value={input.reason}
            aria-describedby="source-proposal-reason-hint" {...cmsFieldProps("source-proposal-reason", reasonIssue)}
            onChange={event => change("reason", event.target.value)} />
          {reasonIssue && <FieldError id="source-proposal-reason-error">{reasonIssue}</FieldError>}
        </FormField>
        </div>
      </fieldset>
      <div className={styles.sourceUpdateActions}>
        <span>{dirty ? "Có thay đổi chưa lưu" : "Thông tin đã đồng bộ"}</span>
        <button type="submit" className="primary-button" disabled={!dirty || needsReload || busy}>Lưu và cập nhật</button>
      </div>
    </form>
    {workflow?.status === "APPROVED" && revision?.bookChange && !dirty && !needsReload &&
      <section className={styles.preview} aria-label="Áp dụng thay đổi metadata">
        <h4>Áp dụng thay đổi metadata</h4>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void inspectApplication()}>
          Xem chi tiết thay đổi
        </button>
        {application && <>
          <p>{application.bookTitle} · {application.edition} · Phiên bản đề xuất {application.revision}</p>
          <p>Phạm vi thay đổi là toàn bộ ấn bản.</p>
          <dl className={styles.workflow}>
            <div><dt>Trường</dt><dd>{bookFields[application.field]}</dd></div>
            <div><dt>Giá trị trước khi sửa</dt><dd>{application.beforeValue ?? "Chưa có dữ liệu"}</dd></div>
          <div><dt>Giá trị đã áp dụng</dt><dd>{application.afterValue}</dd></div>
            <div><dt>Giá trị hiện tại</dt><dd>{application.currentValue ?? "Chưa có dữ liệu"}</dd></div>
          </dl>
          {application.stale && <p role="alert">Nguồn đã thay đổi kể từ khi lưu đề xuất. Hãy đối chiếu và gửi duyệt phiên bản mới.</p>}
          {application.applied && <p role="status">Đã áp dụng trực tiếp · Admin <code>{application.applied.actorId}</code> ·{" "}
            <time dateTime={application.applied.occurredAt}>{new Date(application.applied.occurredAt).toLocaleString("vi-VN")}</time></p>}
          {!application.stale && !application.applied && <p role="alert">Phiên bản cũ chưa được áp dụng trực tiếp. Hãy lưu phiên bản mới để cập nhật.</p>}
        </>}
      </section>}
    {workflow?.lastEvent && <div className={styles.preview}>
      <p>Thao tác gần nhất: {events[workflow.lastEvent.action]} · Phiên bản {workflow.lastEvent.revision}</p>
      <p>Admin <code>{workflow.lastEvent.actorId}</code> · <time dateTime={workflow.lastEvent.occurredAt}>
        {new Date(workflow.lastEvent.occurredAt).toLocaleString("vi-VN")}
      </time></p>
      {workflow.lastEvent.note && <p>{workflow.lastEvent.note}</p>}
    </div>}
    {revision ? <details className={styles.preview}>
      <summary>Bản đã lưu · Phiên bản {revision.version}</summary>
      <p>{revision.proposal}</p>
      <p>{revision.reason}</p>
      {revision.bookChange && <p>Thay đổi trên toàn ấn bản · {bookFields[revision.bookChange.field]} → {revision.bookChange.value}</p>}
      <p>Admin <code>{revision.createdBy}</code> · <time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString("vi-VN")}</time></p>
      <h4>Nguồn tại lúc lưu</h4><SourceReferences sources={[revision.sourceSnapshot.entry.reference]} />
      {revision.sourceSnapshot.book && <dl className={styles.workflow}>
        <div><dt>Tác giả</dt><dd>{revision.sourceSnapshot.book.author ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Nhà xuất bản</dt><dd>{revision.sourceSnapshot.book.publisher ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Năm xuất bản</dt><dd>{revision.sourceSnapshot.book.publicationYear ?? "Chưa có dữ liệu"}</dd></div>
        <div><dt>Số trang PDF</dt><dd>{revision.sourceSnapshot.book.pdfPageCount ?? "Chưa có dữ liệu"}</dd></div>
      </dl>}
    </details> : <p>Chưa có nội dung cập nhật cho mục nguồn này.</p>}
    {notice && <p role="status">{notice}</p>}
    {error !== null && !serverField && <p role="alert">{typeof error === "string" ? error : sourceCatalogError(error)}</p>}
  </div>;
}
