"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InterpretationText } from "@/components/hexagrams/PublishedInterpretation";
import { FormField } from "@/components/ui/Controls";
import { getInterpretationRevision, getInterpretationState, reviewInterpretation, saveInterpretation,
  type InterpretationContent, type InterpretationPoem, type InterpretationRevision, type InterpretationSource,
  type InterpretationState, type WorkflowAction } from "@/services/rest/hexagramInterpretations";
import { methodGuideError } from "@/services/rest/methodGuides";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const fields = [
  ["overview", "Ý nghĩa tổng quan", 6000], ["image", "Hình tượng quẻ", 2000],
  ["original", "Lời quẻ Hán cổ", 2000], ["paraphrase", "Diễn nghĩa tiếng Việt", 4000],
  ["application", "Gợi ý suy ngẫm", 4000],
] as const;
const statusLabels = { DRAFT: "Bản nháp", PENDING_REVIEW: "Chờ duyệt", PUBLISHED: "Đã công bố" };
const empty = (): InterpretationContent => ({ overview: "", image: "", original: "", paraphrase: "", lines: Array(6).fill(""), application: "" });
function sameSource(current: InterpretationSource, saved: InterpretationSource) {
  return current.id === saved.id && current.title === saved.title && current.author === saved.author
    && current.edition === saved.edition && current.locator === saved.locator && current.url === saved.url
    && current.reuseNote === saved.reuseNote && current.reviewStatus === saved.reviewStatus;
}
const messages: Record<string, string> = {
  VERSION_CONFLICT: "Một Admin khác đã thay đổi dữ liệu. Hãy tải lại trước khi sửa.",
  INVALID_TRANSITION: "Thao tác không hợp lệ với trạng thái hoặc nguồn hiện tại.",
  INVALID_SOURCE: "Chọn nguồn đã đăng ký cho đúng quẻ.",
  INVALID_INPUT: "Kiểm tra nội dung, độ dài và nguồn.",
  FORBIDDEN: "Tài khoản hiện tại không được công bố bản này.",
};
const errorText = (error: unknown) => error instanceof RestError && Object.hasOwn(messages, error.code)
  ? messages[error.code] : methodGuideError(error);

type Auth = NonNullable<ReturnType<typeof useAdminSession>>;

export function HexagramInterpretationWorkspace({ code, lines }: { code: string; lines: readonly boolean[] }) {
  const auth = useAdminSession();
  return <section className={styles.contentPanel} aria-labelledby="admin-interpretation-title">
    <h2 id="admin-interpretation-title">Luận giải chi tiết</h2>
    <p className="field-hint">Bài biên soạn riêng. Nghĩa tên E01 được quản lý ở khu vực bên trên.</p>
    {auth ? <LoadWorkspace code={code} lines={lines} auth={auth} /> : <p>Cần phiên Admin để biên tập.</p>}
  </section>;
}

function LoadWorkspace({ code, lines, auth }: { code: string; lines: readonly boolean[]; auth: Auth }) {
  const { handleError } = auth;
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getInterpretationState(code, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [code, handleError]);
  const result = useLookup(code, load);
  if (result.status === "loading") return <p role="status">Đang tải bản biên tập…</p>;
  if (result.status === "failed") return <>
    <p role="alert">{errorText(result.error)}</p>
    <button type="button" className="secondary-button" onClick={result.retry}>Tải lại bản biên tập</button>
  </>;
  return <Workspace initial={result.data} lines={lines} auth={auth} reload={result.retry} />;
}

function Workspace({ initial, lines, auth, reload }: {
  initial: InterpretationState; lines: readonly boolean[]; auth: Auth; reload: () => void;
}) {
  const [state, setState] = useState(initial);
  const [content, setContent] = useState(() => initial.latest?.content ?? empty());
  const [selected, setSelected] = useState(() => initial.latest?.sources.map(source => source.id) ?? []);
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [old, setOld] = useState<InterpretationRevision | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const sources = state.sources.filter(source => selected.includes(source.id));
  const pending = state.status === "PENDING_REVIEW";
  const savedSources = state.latest?.sources ?? [];
  const sourcesMatch = sources.length === savedSources.length
    && sources.every(source => savedSources.some(saved => sameSource(source, saved)));
  const mayPublish = state.latest && state.latest.createdBy !== auth.session.account.id
    && sourcesMatch && savedSources.every(source => source.reviewStatus === "VERIFIED");
  const latestContent = state.latest?.content ?? empty();
  const dirty = JSON.stringify(content) !== JSON.stringify(latestContent) || !sourcesMatch;
  const poem = content.poem;
  const validPoem = !poem || [poem.title, poem.body, poem.author].every(value => value.trim().length > 0);
  const valid = validPoem && content.overview.trim().length > 0 && sources.length === selected.length && selected.length > 0;

  function changePoem(next: InterpretationPoem | null) {
    setContent(current => ({ ...current, poem: next ?? (latestContent.poem ? null : undefined) }));
  }

  async function perform(work: (signal: AbortSignal) => Promise<void>) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null); setNotice("");
    try { await work(controller.signal); }
    catch (failure) {
      if (!controller.signal.aborted) { auth.handleError(failure); setError(failure); }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function saved(next: InterpretationState, notice: string) {
    setState(next);
    setContent(next.latest?.content ?? empty());
    setSelected(next.latest?.sources.map(source => source.id) ?? []);
    setNote("");
    setNotice(notice);
  }

  function save() {
    void perform(async signal => {
      const next = await saveInterpretation(state.code, state.version, content, selected, auth.session.csrfToken, signal);
      if (!signal.aborted) saved(next, "Đã lưu bản nháp trên Server.");
    });
  }

  function review(action: WorkflowAction) {
    void perform(async signal => {
      const next = await reviewInterpretation(state.code, state.version, action, note.trim(), auth.session.csrfToken, signal);
      if (!signal.aborted) saved(next, action === "PUBLISH" ? "Đã công bố." : action === "RETURN" ? "Đã trả bản nháp." : "Đã gửi duyệt.");
    });
  }

  function readVersion(version: string) {
    setOld(null);
    if (!version) return;
    void perform(async signal => {
      const result = await getInterpretationRevision(state.code, Number(version), signal);
      if (!signal.aborted) setOld(result);
    });
  }

  return <div className={styles.contentStack} aria-busy={busy}>
    <p>{state.latest ? `${statusLabels[state.status]} · Bản ${state.latest.version}` : "Chưa có bản biên soạn."}
      {state.publishedVersion && ` · Đang công bố bản ${state.publishedVersion}`}</p>
    {state.reviewNote && <p className="field-hint">Ghi chú duyệt · {state.reviewNote}</p>}
    <form className={styles.contentStack} onSubmit={event => { event.preventDefault(); if (valid && dirty) save(); }}>
      <fieldset disabled={pending || busy} className={styles.interpretationFields}>
        {fields.map(([key, label, max]) => <FormField key={key} id={`interpretation-${key}`} label={label}>
          <textarea id={`interpretation-${key}`} rows={key === "overview" ? 4 : 3} maxLength={max}
            value={content[key]} onChange={event => setContent({ ...content, [key]: event.target.value })} />
        </FormField>)}
        <fieldset className={styles.interpretationGroup}>
          <legend>Luận giải từng hào</legend>
          {lines.map((yang, index) => <FormField key={index} id={`interpretation-line-${index + 1}`}
            label={`Hào ${index + 1} · ${yang ? "Dương" : "Âm"}`}>
            <textarea id={`interpretation-line-${index + 1}`} rows={3} maxLength={2000} value={content.lines[index]}
              onChange={event => setContent({ ...content, lines: content.lines.map((value, position) => position === index ? event.target.value : value) })} />
          </FormField>)}
        </fieldset>
        <fieldset className={styles.interpretationGroup}>
          <legend>Bài thơ diễn nghĩa</legend>
          {poem ? <>
            <p className="field-hint">Cần nhập tiêu đề, nội dung và tác giả hoặc đơn vị biên soạn. Thơ chỉ thay đổi trên trang người dùng sau khi bản mới được công bố.</p>
            <FormField id="interpretation-poem-title" label="Tiêu đề bài thơ">
              <input id="interpretation-poem-title" maxLength={120} required value={poem.title}
                onChange={event => changePoem({ ...poem, title: event.target.value })} />
            </FormField>
            <FormField id="interpretation-poem-body" label="Nội dung bài thơ">
              <textarea id="interpretation-poem-body" rows={6} maxLength={8000} required value={poem.body}
                onChange={event => changePoem({ ...poem, body: event.target.value })} />
            </FormField>
            <FormField id="interpretation-poem-author" label="Tác giả hoặc đơn vị biên soạn">
              <input id="interpretation-poem-author" maxLength={160} required value={poem.author}
                onChange={event => changePoem({ ...poem, author: event.target.value })} />
            </FormField>
            <FormField id="interpretation-poem-source" label="Nguồn tham khảo bài thơ (tùy chọn)">
              <input id="interpretation-poem-source" maxLength={500} value={poem.source ?? ""}
                onChange={event => changePoem({ ...poem, source: event.target.value })} />
            </FormField>
            <button type="button" className="secondary-button" onClick={() => changePoem(null)}>Xóa bài thơ khỏi bản nháp</button>
          </> : <>
            <p>Chưa có bài thơ.</p>
            <button type="button" className="secondary-button"
              onClick={() => changePoem({ title: "", body: "", author: "" })}>Thêm bài thơ</button>
          </>}
        </fieldset>
        <fieldset className={styles.interpretationGroup}>
          <legend>Nguồn tham khảo đã đăng ký</legend>
          {state.sources.length === 0 && <p>Chưa có nguồn chi tiết cho quẻ. TV3 cần đăng ký nguồn trước khi lưu bản nháp.</p>}
          {state.sources.map(source => <label key={source.id} className={styles.interpretationSource}>
            <input type="checkbox" checked={selected.includes(source.id)} disabled={!selected.includes(source.id) && selected.length >= 8}
              onChange={event => setSelected(event.target.checked ? [...selected, source.id] : selected.filter(id => id !== source.id))} />
            <span>{source.title} · {source.locator} · {source.reviewStatus === "VERIFIED" ? "Đã đối chiếu" : "Chờ đối chiếu"}</span>
          </label>)}
        </fieldset>
      </fieldset>
      <div className={styles.contentActions}>
        <button type="button" className="secondary-button" aria-expanded={preview} onClick={() => setPreview(!preview)}>Xem trước luận giải</button>
        <button type="submit" className="secondary-button" disabled={!valid || !dirty || pending || busy}>Lưu bản nháp</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={reload}>Tải lại từ Server</button>
      </div>
    </form>
    {state.latest && state.status === "DRAFT" &&
      <button type="button" className="secondary-button" disabled={dirty || busy} onClick={() => review("SUBMIT")}>Gửi duyệt</button>}
    {pending && <div className={styles.inlineFields}>
      <FormField id="interpretation-review-note" label="Ghi chú đối chiếu">
        <textarea id="interpretation-review-note" rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} />
      </FormField>
      {!sourcesMatch && <p className="field-hint">Thông tin nguồn đã thay đổi. Hãy trả về bản nháp để biên tập viên lưu lại nguồn trước khi gửi duyệt.</p>}
      {!mayPublish && <p className="field-hint">Công bố cần Admin khác người soạn và nguồn đã xác minh.</p>}
      <div className={styles.contentActions}>
        <button type="button" className="secondary-button" disabled={busy || !note.trim()} onClick={() => review("RETURN")}>Trả về bản nháp</button>
        <button type="button" className="secondary-button" disabled={busy || !mayPublish || !note.trim()} onClick={() => review("PUBLISH")}>Công bố luận giải</button>
      </div>
    </div>}
    {state.revisions.length > 0 && <FormField id="interpretation-revisions" label="Xem lại phiên bản">
      <select id="interpretation-revisions" disabled={busy} onChange={event => readVersion(event.target.value)}>
        <option value="">Chọn phiên bản</option>
        {state.revisions.map(version => <option key={version} value={version}>Bản {version}</option>)}
      </select>
    </FormField>}
    {preview && <div className={styles.preview} aria-label="Bản xem trước luận giải">
      <p className="field-hint">Bản xem trước dành cho Admin.</p>
      <InterpretationText content={content} sources={sources} lines={lines} />
    </div>}
    {old && <div className={styles.preview} aria-label={`Nội dung phiên bản ${old.version}`}>
      <h3>Phiên bản {old.version}</h3>
      <InterpretationText content={old.content} sources={old.sources} lines={lines} />
    </div>}
    {notice && <p role="status">{notice}</p>}
    {error !== null && <p role="alert">{errorText(error)}</p>}
  </div>;
}
