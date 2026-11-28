"use client";
import { useCallback, useRef, useState } from "react";
import { useAdminSession } from "./AdminSessionGate";
import { adminOptions } from "@/services/rest/methodGuides";
import { requestJson, RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { isRecord } from "@/types/contractValidation";
import { FeedbackModal } from "@/components/chat/FeedbackDialog";
import { chatRequestId } from "@/components/chat/useRoomChat";
import styles from "./admin.module.css";

export const moderationLabels={WARNING:"Cảnh cáo",TEMP_LOCK:"Khóa có thời hạn",PERMANENT_LOCK:"Khóa không thời hạn",DISMISS:"Không đủ căn cứ",AUTO_UNLOCK:"Tự mở khóa khi hết hạn",MANUAL_LOCK:"Khóa tại quản lý tài khoản",MANUAL_UNLOCK:"Admin mở khóa tài khoản"};
export function ModerationActions({report,changed}:{report:{id:string;target_id:string;target_name:string;status:string;version?:number;target_status?:string};changed:()=>void}) {
 const auth=useAdminSession();const [action,setAction]=useState("WARNING"),[days,setDays]=useState(7),[note,setNote]=useState("");
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [checked,setChecked]=useState(false);
 const retry=useRef<{key:string;id:string}|null>(null),pending=useRef(false);
 const closed=["RESOLVED","DISMISSED"].includes(report.status);
 async function submit(){
  if(!auth||pending.current||!note.trim()||closed||!checked||report.status!=="REVIEWING")return;
  pending.current=true;setBusy(true);setError("");
  const data={action,note:note.trim(),days:action==="TEMP_LOCK"?days:0,expectedVersion:report.version??1};const key=JSON.stringify(data);
  if(retry.current?.key!==key)retry.current={key,id:chatRequestId()};
  try{await requestJson(`/admin/reports/${report.id}/decisions`,(v:unknown):v is {saved:true}=>isRecord(v)&&v.saved===true,new AbortController().signal,
    {...data,requestId:retry.current!.id},{...adminOptions(auth.session.csrfToken),method:"POST"});setConfirm(false);changed();}
  catch(e){auth.handleError(e);setError(e instanceof RestError?e.apiError?.message??"Chưa xác nhận được quyết định. Thử lại với cùng nội dung hoặc tải lại báo cáo.":"Chưa gửi được. Hãy thử lại.");}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className={styles.accountDetailsSection} aria-label="Biện pháp xử lý vi phạm"><h3>Biện pháp xử lý</h3>
  {closed?<p>Báo cáo đã đóng. Mở lại báo cáo nếu cần xem xét thêm; quyết định cũ vẫn được giữ trong lịch sử.</p>:<div className={styles.contentStack}>
   {report.target_status==="LOCKED"&&<p>Tài khoản đang bị khóa. Bạn vẫn có thể cảnh cáo hoặc kết luận chưa đủ căn cứ; thay đổi khóa tại Quản lý người dùng.</p>}
   <label>Chọn biện pháp<select value={action} onChange={e=>setAction(e.target.value)} disabled={busy}>{Object.entries(moderationLabels).filter(([key])=>["WARNING","TEMP_LOCK","PERMANENT_LOCK","DISMISS"].includes(key)).map(([key,label])=><option key={key} value={key} disabled={report.target_status==="LOCKED"&&["TEMP_LOCK","PERMANENT_LOCK"].includes(key)}>{label}</option>)}</select></label>
   {action==="TEMP_LOCK"&&<label>Thời hạn khóa<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,7,30].map(n=><option key={n} value={n}>{n} ngày</option>)}</select></label>}
   <label>Lý do quyết định (bắt buộc)<textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
   <p>Không ghi danh tính người báo cáo trong lý do. Tài khoản bị xử phạt sẽ nhận nội dung này.</p>
   <label className={styles.reportEvidenceCheck}><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/><span>Tôi đã kiểm tra nội dung phản ánh, hội thoại hoặc lịch sử liên quan.</span></label>
   <button type="button" className="primary-button" disabled={busy||!note.trim()||!checked} onClick={()=>{setError("");setConfirm(true);}}>Xem và xác nhận quyết định</button>
  </div>}
  {confirm&&<FeedbackModal title="Xác nhận xử lý báo cáo" close={()=>{if(!busy)setConfirm(false);}}>
    <p>Tài khoản: <strong>{report.target_name}</strong></p><p>Biện pháp: <strong>{moderationLabels[action as keyof typeof moderationLabels]}{action==="TEMP_LOCK"?` · ${days} ngày`:""}</strong></p>
    <p style={{whiteSpace:"pre-wrap"}}>Lý do: {note}</p>
    <p>{action==="TEMP_LOCK"?"Các phiên đăng nhập sẽ bị thu hồi. Tài khoản tự mở lại khi hết hạn; người dùng cần đăng nhập lại.":action==="PERMANENT_LOCK"?"Các phiên đăng nhập sẽ bị thu hồi. Tài khoản chỉ mở lại khi admin quyết định.":action==="WARNING"?"Tài khoản vẫn sử dụng bình thường và nhận thông báo cảnh cáo.":"Không áp dụng xử phạt tài khoản."}</p>
    {error&&<p role="alert">{error}</p>}<div className={styles.contentActions}><button className="secondary-button" disabled={busy} onClick={()=>setConfirm(false)}>Hủy</button><button className="primary-button" disabled={busy} onClick={()=>void submit()}>{busy?"Đang xử lý…":"Xác nhận áp dụng"}</button></div>
  </FeedbackModal>}
  <ModerationHistory accountId={report.target_id}/>
 </section>;
}
export function ModerationHistory({accountId}:{accountId:string}) {
 const [page,setPage]=useState(0);
 type Entry={id:string;action:string;reason:string;created_at:string;expires_at:string|null;actor_name:string|null};
 const load=useCallback((signal:AbortSignal)=>requestJson(`/admin/accounts/${accountId}/moderation?page=${page}`,(v:unknown):v is {items:Entry[]}=>isRecord(v)&&Array.isArray(v.items)&&v.items.every(x=>isRecord(x)&&typeof x.id==="string"&&typeof x.action==="string"&&typeof x.reason==="string"&&typeof x.created_at==="string"),signal,undefined,adminOptions()),[accountId,page]);
 const data=useLookup(`${accountId}:${page}`,load);
 const date=(v:string)=>new Date(v).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
 return <details><summary>Lịch sử xử lý tài khoản</summary>{data.status==="loading"?<p>Đang tải lịch sử…</p>:data.status==="failed"?<><p>Chưa tải được lịch sử.</p><button className="secondary-button" onClick={data.retry}>Tải lại lịch sử</button></>:<>
  {!data.data.items.length&&<p>Chưa có quyết định xử lý vi phạm.</p>}
  <ul>{data.data.items.map(x=><li key={x.id}><strong>{moderationLabels[x.action as keyof typeof moderationLabels]??x.action}</strong> · {date(x.created_at)}<p style={{whiteSpace:"pre-wrap"}}>{x.reason}</p><p>{x.actor_name??"Hệ thống"}{x.expires_at?` · Hết hạn ${date(x.expires_at)}`:""}</p></li>)}</ul>
  <div className={styles.contentActions}><button className="secondary-button" disabled={!page} onClick={()=>setPage(n=>n-1)}>Lịch sử trước</button><button className="secondary-button" disabled={data.data.items.length!==20} onClick={()=>setPage(n=>n+1)}>Lịch sử tiếp</button></div>
 </>}</details>;
}
