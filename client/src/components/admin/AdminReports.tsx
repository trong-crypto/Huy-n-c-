"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminSession } from "./AdminSessionGate";
import { useLookup } from "@/services/rest/useLookup";
import { requestJson } from "@/services/rest/transport";
import { adminOptions } from "@/services/rest/methodGuides";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { reportReasons, FeedbackModal } from "@/components/chat/FeedbackDialog";
import styles from "./admin.module.css";
import { ModerationActions, ModerationHistory, moderationLabels } from "./ModerationActions";

type ReviewEvent={id:string;previous_status:string;note:string;created_at:string;actor_name:string};
type Report={id:string;target_id:string;reporter_name:string;target_name:string;target_status?:string;reason:keyof typeof reportReasons;description:string;status:string;admin_note:string;created_at:string;conversation_id:string;version?:number;review_note?:string;
 decision_action?:string|null;decision_reason?:string|null;decision_at?:string|null;decision_expires_at?:string|null;decision_actor?:string|null;review_events?:ReviewEvent[]};
const statuses={PENDING:"Chờ xử lý",REVIEWING:"Đang xem xét",RESOLVED:"Đã xử lý",DISMISSED:"Không đủ căn cứ"};
const isReport=(v:unknown):v is Report=>isRecord(v)&&isUuid(v.id)&&isUuid(v.target_id)&&isUuid(v.conversation_id)
 &&[v.reporter_name,v.target_name,v.description,v.admin_note,v.created_at].every(x=>typeof x==="string")&&typeof v.reason==="string"&&Object.hasOwn(reportReasons,v.reason)&&typeof v.status==="string"&&Object.hasOwn(statuses,v.status)
 &&(v.version===undefined||Number.isSafeInteger(v.version)&&(v.version as number)>0)
 &&(v.review_note===undefined||typeof v.review_note==="string")
 &&[v.decision_action,v.decision_reason,v.decision_at,v.decision_expires_at,v.decision_actor].every(x=>x==null||typeof x==="string")
 &&(v.review_events===undefined||Array.isArray(v.review_events)&&v.review_events.every(x=>isRecord(x)&&[x.id,x.previous_status,x.note,x.created_at,x.actor_name].every(field=>typeof field==="string")));
const isPage=(v:unknown):v is {items:Report[];totalPages:number;totalElements:number}=>isRecord(v)&&Array.isArray(v.items)&&v.items.every(isReport)&&Number.isSafeInteger(v.totalPages)&&Number.isSafeInteger(v.totalElements);
export function AdminReports(){
 const auth=useAdminSession();const [status,setStatus]=useState("PENDING"),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
 const [selected,setSelected]=useState<Report|null>(null);
 const [feedback,setFeedback]=useState("");
 const detailHeading=useRef<HTMLHeadingElement>(null),opener=useRef<string|null>(null);
 useEffect(()=>{if(selected)detailHeading.current?.focus();},[selected]);
 function close(){setSelected(null);window.requestAnimationFrame(()=>{if(opener.current)document.getElementById(opener.current)?.focus();});}
 const load=useCallback(async(signal:AbortSignal)=>{try{return await requestJson(`/admin/reports?status=${status}&page=${page}`,isPage,signal,undefined,adminOptions());}catch(e){auth?.handleError(e);throw e;}},[status,page,auth]);
 const list=useLookup(JSON.stringify([status,page,revision]),load);
 return <section className={`${styles.contentPanel} ${styles.reportPage}`}><h1 ref={detailHeading} tabIndex={selected?-1:undefined}>{selected?"Chi tiết báo cáo":"Báo cáo tư vấn"}</h1><p className={styles.reportLead}>{selected?"Đối chiếu nội dung và tin nhắn trước khi đưa ra quyết định xử lý.":"Tiếp nhận báo cáo từ người dùng và tư vấn viên. Chọn một mục để xem chi tiết."}</p>
  {selected?<>
   <div className={styles.reportDetailHeading}><button type="button" className="secondary-button" onClick={close}>← Danh sách báo cáo</button><span className={styles.reportReference}>Mã báo cáo: {selected.id.slice(0,8)}</span></div>
   {feedback&&<p className={styles.reportSuccess} role="status">{feedback}</p>}
   <ReportDetails id={selected.id} revision={revision} changed={message=>{setFeedback(message??"Đã lưu quyết định và gửi thông báo kết quả.");setRevision(n=>n+1);}}/>
  </>:<>
  <div className={styles.reportFilters}>
  <label>Trạng thái báo cáo<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="ALL">Tất cả</option>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <button className="secondary-button" onClick={()=>setRevision(n=>n+1)}>Tải lại báo cáo</button>
  </div>
  {list.status==="loading"?<p role="status">Đang tải báo cáo…</p>:list.status==="failed"?<p role="alert">Không tải được báo cáo. Hãy thử tải lại.</p>:<>
   <p role="status">{list.data.totalElements} báo cáo · Chọn một báo cáo để xem chi tiết và xử lý.</p>
   <ul className={styles.reportList} aria-label="Danh sách báo cáo tư vấn">{list.data.items.map(report=><li key={report.id}>
    <button id={`report-${report.id}`} type="button" className={styles.reportRow} onClick={event=>{opener.current=event.currentTarget.id;setFeedback("");setSelected(report);}}>
     <span className={styles.reportPeople}><strong>{report.target_name}</strong><small>Người báo cáo: {report.reporter_name}</small></span>
     <span className={styles.reportReason}>{reportReasons[report.reason]}</span>
     <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</time>
     <span className={styles.reportState} data-status={report.status}>{statuses[report.status as keyof typeof statuses]}</span>
     <span className={styles.reportOpen}>Xem chi tiết →</span>
    </button>
   </li>)}</ul>
   {!list.data.items.length&&<p>Chưa có báo cáo trong nhóm này.</p>}
   <nav className={styles.contentActions} aria-label="Phân trang báo cáo"><button className="secondary-button" disabled={!page} onClick={()=>setPage(n=>n-1)}>Trang trước</button><span>Trang {page+1}/{Math.max(1,list.data.totalPages)}</span><button className="secondary-button" disabled={page+1>=list.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</button></nav>
  </>}
  </>}
 </section>;
}
function ReportDetails({id,revision,changed}:{id:string;revision:number;changed:(message?:string)=>void}) {
 const auth=useAdminSession();const handleError=auth?.handleError;
 const load=useCallback(async(signal:AbortSignal)=>{try{return await requestJson(`/admin/reports/${id}`,isReport,signal,undefined,adminOptions());}catch(e){handleError?.(e);throw e;}},[id,handleError]);
 const detail=useLookup(`${id}:${revision}`,load);
 if(detail.status==="loading")return <p role="status">Đang cập nhật chi tiết báo cáo…</p>;
 if(detail.status==="failed")return <><p role="alert">Chưa tải được báo cáo hiện tại. Hãy tải lại trước khi xử lý.</p><button className="secondary-button" onClick={detail.retry}>Tải lại chi tiết</button></>;
 return <ReportCard key={`${id}:${detail.data.version}`} report={detail.data} changed={changed} reload={detail.retry}/>;
}
function ReportCard({report,changed,reload}:{report:Report;changed:(message?:string)=>void;reload:()=>void}){
 const [evidence,setEvidence]=useState(report.status==="REVIEWING"),[page,setPage]=useState(0);
 const closed=["RESOLVED","DISMISSED"].includes(report.status);
 return <article className={styles.reportDetail} aria-label={`Báo cáo về ${report.target_name}`}>
  <ol className={styles.reportSteps} aria-label="Tiến trình xử lý báo cáo">{["Tiếp nhận","Xem xét","Kết luận"].map((label,index)=><li key={label} data-active={index===(closed?2:report.status==="REVIEWING"?1:0)} data-done={index<(closed?2:report.status==="REVIEWING"?1:0)}><span>{index+1}</span>{label}</li>)}</ol>
  <section className={styles.reportSummary} aria-label="Thông tin báo cáo">
   <div className={styles.reportSectionHeading}><div><span className={styles.reportEyebrow}>01 / THÔNG TIN BÁO CÁO</span><h2>{reportReasons[report.reason]}</h2></div><span className={styles.reportState} data-status={report.status}>{statuses[report.status as keyof typeof statuses]}</span></div>
   <dl className={styles.reportMetadata}>
    <div><dt>Người gửi báo cáo</dt><dd>{report.reporter_name}</dd></div>
    <div><dt>Tài khoản bị báo cáo</dt><dd>{report.target_name}</dd><Link href={`/admin/users?account=${report.target_id}`}>Mở tài khoản bị báo cáo</Link></div>
    <div><dt>Thời gian gửi · giờ Việt Nam</dt><dd><time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</time></dd></div>
   </dl>
   <div className={styles.reportDescription}><h3>Nội dung phản ánh</h3><p>{report.description||"Người gửi chưa bổ sung mô tả. Hãy đối chiếu tin nhắn và lịch sử tài khoản trước khi xử lý."}</p></div>
  </section>
  <div className={styles.reportWorkspace}>
   <div className={styles.reportReviewColumn}>
    <section className={styles.reportEvidencePanel} aria-label="Đối chiếu hội thoại">
     <div className={styles.reportSectionHeading}><div><span className={styles.reportEyebrow}>02 / KIỂM TRA THÔNG TIN</span><h3>Tin nhắn đối chiếu</h3></div><button type="button" className="secondary-button" aria-expanded={evidence} onClick={()=>setEvidence(v=>!v)}>{evidence?"Ẩn tin nhắn":"Đối chiếu tin nhắn"}</button></div>
     {evidence?<ReportEvidence id={report.id} page={page} setPage={setPage}/>:<div className={styles.reportEvidenceEmpty}><span aria-hidden="true">☰</span><p>Mở hội thoại để đọc nội dung trao đổi giữa hai bên.</p><small>Chỉ hiển thị tin nhắn còn trong thời hạn lưu trữ.</small></div>}
    </section>
    {report.status==="REVIEWING"&&<ReviewControls report={report} changed={changed} mode="note" reload={reload}/>}
    {!!report.review_events?.length&&<details className={styles.reportReviewPanel}><summary>Lịch sử xem xét báo cáo</summary><ul className={styles.reportReviewHistory}>{report.review_events.map(event=><li key={event.id}><strong>{["RESOLVED","DISMISSED"].includes(event.previous_status)?"Mở lại báo cáo":event.previous_status==="PENDING"?"Bắt đầu xem xét":"Cập nhật ghi chú"}</strong><p>{event.note}</p><small>{event.actor_name} · {new Date(event.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</small></li>)}</ul></details>}
   </div>
   <aside className={styles.reportDecisionPanel} aria-label="Quyết định xử lý báo cáo">
    {closed?<><span className={styles.reportEyebrow}>ĐÃ HOÀN TẤT</span><h3>Kết quả xử lý</h3><div className={styles.reportOutcome}><strong>{report.decision_action?moderationLabels[report.decision_action as keyof typeof moderationLabels]:statuses[report.status as keyof typeof statuses]}</strong><p style={{whiteSpace:"pre-wrap"}}>{report.decision_reason??report.admin_note}</p>{report.decision_at&&<small>{report.decision_actor??"Admin"} · {new Date(report.decision_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</small>}{report.decision_expires_at&&<p>Thời hạn đến {new Date(report.decision_expires_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</p>}</div><p className={styles.reportHint}>Kết quả đã được lưu. Mở lại nếu có thông tin mới; thao tác này không tự hủy biện pháp đã áp dụng.</p><ReviewControls report={report} changed={changed} mode="reopen" reload={reload}/><ModerationHistory accountId={report.target_id}/></>
     :report.status==="PENDING"?<><span className={styles.reportEyebrow}>BƯỚC TIẾP THEO</span><h3>Tiếp nhận báo cáo</h3><p>Đọc nội dung phản ánh, sau đó bắt đầu xem xét để đối chiếu hội thoại và lựa chọn biện pháp.</p><ReviewControls report={report} changed={changed} mode="start" reload={reload}/></>
     :<><span className={styles.reportEyebrow}>03 / RA QUYẾT ĐỊNH</span><ModerationActions report={report} changed={changed}/></>}
   </aside>
  </div>
 </article>;
}
function ReviewControls({report,changed,mode,reload}:{report:Report;changed:(message?:string)=>void;mode:"start"|"note"|"reopen";reload:()=>void}) {
 const auth=useAdminSession();const [note,setNote]=useState(mode==="note"?report.review_note??"":""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [confirm,setConfirm]=useState(false);const pending=useRef(false);
 async function save(){
  if(!auth||pending.current||mode!=="start"&&!note.trim())return;pending.current=true;setBusy(true);setError("");
  try{await requestJson(`/admin/reports/${report.id}`,(v:unknown):v is {saved:true}=>isRecord(v)&&v.saved===true,new AbortController().signal,
    {status:"REVIEWING",note:mode==="start"?"Admin bắt đầu xem xét báo cáo.":note.trim(),expectedVersion:report.version??1},{...adminOptions(auth.session.csrfToken),method:"PUT"});
    changed(mode==="start"?"Đã bắt đầu xem xét. Hãy kiểm tra hội thoại trước khi kết luận.":mode==="reopen"?"Đã mở lại báo cáo để xem xét thông tin mới.":"Đã lưu ghi chú nội bộ.");
  }catch(e){auth.handleError(e);setError("Chưa lưu được hoặc báo cáo đã thay đổi. Hãy tải lại chi tiết trước khi thử tiếp.");}finally{pending.current=false;setBusy(false);}
 }
 if(mode==="start")return <div className={styles.reportActionBlock}><button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?"Đang tiếp nhận…":"Bắt đầu xem xét"}</button>{error&&<p role="alert">{error}</p>}{error&&<button className="secondary-button" onClick={reload}>Tải lại chi tiết</button>}</div>;
 if(mode==="reopen")return <><button className="secondary-button" onClick={()=>{setError("");setConfirm(true);}}>Mở lại báo cáo</button>{confirm&&<FeedbackModal title="Mở lại báo cáo" close={()=>{if(!busy)setConfirm(false);}}><form onSubmit={e=>{e.preventDefault();void save();}}><p>Mở lại để xem xét thông tin mới. Quyết định cũ vẫn được giữ; việc mở lại không tự mở khóa tài khoản.</p><label>Lý do mở lại (bắt buộc)<textarea required rows={3} maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<footer><button className="secondary-button" type="button" disabled={busy} onClick={()=>setConfirm(false)}>Hủy</button><button className="primary-button" type="submit" disabled={busy||!note.trim()}>{busy?"Đang mở lại…":"Xác nhận mở lại"}</button></footer></form></FeedbackModal>}</>;
 return <details className={styles.reportReviewPanel}><summary>Ghi chú nội bộ (tùy chọn)</summary><p className={styles.reportHint}>Chỉ admin xem được. Nội dung này được lưu riêng với lý do quyết định gửi cho tài khoản.</p><label>Ghi chú nội bộ của admin<textarea rows={3} maxLength={2000} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="secondary-button" disabled={busy||!note.trim()||note.trim()===(report.review_note??"").trim()} onClick={()=>void save()}>{busy?"Đang lưu…":"Lưu ghi chú"}</button>{error&&<p role="alert">{error}</p>}{error&&<button className="secondary-button" onClick={reload}>Tải lại chi tiết</button>}</details>;
}
function ReportEvidence({id,page,setPage}:{id:string;page:number;setPage:(n:number)=>void}){
 type Message={sequence:number;text:string;sender_name:string;created_at?:string};
 const load=useCallback((signal:AbortSignal)=>requestJson(`/admin/reports/${id}/messages?page=${page}`,(v:unknown):v is {items:Message[]}=>isRecord(v)&&Array.isArray(v.items)&&v.items.every(m=>isRecord(m)&&typeof m.text==="string"&&typeof m.sender_name==="string"),signal,undefined,adminOptions()),[id,page]);
 const data=useLookup(`${id}:${page}`,load);
 return <section aria-label="Tin nhắn đối chiếu">
  <p className={styles.reportHint}>Chỉ hiển thị tin nhắn còn trong thời hạn lưu trữ của hệ thống.</p>
  <div className={styles.reportTranscript} tabIndex={0} aria-label="Nội dung hội thoại đối chiếu">
   {data.status==="loading"?<p role="status" className={styles.reportEvidenceEmpty}>Đang tải hội thoại…</p>:data.status==="failed"?<div className={styles.reportEvidenceEmpty}><p role="alert">Không tải được tin nhắn.</p><button className="secondary-button" onClick={data.retry}>Thử lại</button></div>:!data.data.items.length?<p className={styles.reportEvidenceEmpty}>Không có tin nhắn còn được lưu trên trang này.</p>:<ol>{data.data.items.map((m,i)=><li key={m.sequence??i} className={styles.reportMessage}>
    <div className={styles.reportMessageHeading}><span className={styles.reportAvatar} aria-hidden="true">{m.sender_name.charAt(0).toUpperCase()}</span><strong>{m.sender_name}</strong>{m.created_at&&<time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</time>}</div>
    <p>{m.text}</p>
   </li>)}</ol>}
  </div>
  <div className={styles.reportTranscriptFooter}><span>Trang tin nhắn {page+1} · Tối đa 50 tin</span><div className={styles.contentActions}><button className="secondary-button" disabled={!page||data.status==="loading"} onClick={()=>setPage(page-1)}>Tin nhắn trước</button><button className="secondary-button" disabled={data.status!=="completed"||data.data.items.length!==50} onClick={()=>setPage(page+1)}>Tin nhắn tiếp</button></div></div>
 </section>;
}
