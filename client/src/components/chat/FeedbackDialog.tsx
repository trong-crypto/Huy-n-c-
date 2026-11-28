"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatSession, Conversation } from "@/types/chatContract";
import { requestJson, RestError } from "@/services/rest/transport";
import { isRecord } from "@/types/contractValidation";
import { readChatCsrf } from "@/services/rest/chat";
import { customerOptions } from "@/services/rest/customerAuth";
import styles from "./feedback.module.css";

export const reportReasons = { HARASSMENT: "Quấy rối, xúc phạm hoặc đe dọa", INAPPROPRIATE: "Nội dung không phù hợp",
  FRAUD: "Yêu cầu chuyển tiền hoặc nghi lừa đảo", PRIVACY: "Tiết lộ hoặc thu thập thông tin cá nhân trái phép", SPAM: "Spam, quảng cáo hoặc làm phiền", OTHER: "Khác" };
export const lockReasons = ["Quấy rối, xúc phạm hoặc đe dọa", "Nội dung không phù hợp", "Lừa đảo hoặc yêu cầu thanh toán trái quy định",
  "Vi phạm quyền riêng tư", "Spam hoặc lạm dụng hệ thống", "Giả mạo danh tính", "Khác"];
export function FeedbackModal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=ref.current;const previous=document.activeElement as HTMLElement|null;node?.showModal();return ()=>{node?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={event=>{event.preventDefault();close();}}>
    <header><h2>{title}</h2><button type="button" className="secondary-button" aria-label="Đóng cửa sổ" onClick={close}>×</button></header>{children}
  </dialog>;
}
const isSaved=(v:unknown):v is {saved:true}=>isRecord(v)&&v.saved===true;
export function RoomFeedback({ session, room, promptRating, closePrompt, onRated }: {session:ChatSession;room:Conversation;promptRating:boolean;closePrompt:()=>void;onRated?:()=>void}) {
  const [modal,setModal]=useState<"report"|"rating"|null>(null);
  const [reason,setReason]=useState("HARASSMENT"),[description,setDescription]=useState(""),[stars,setStars]=useState(0);
  const [rated,setRated]=useState(false),[reported,setReported]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;const controller=new AbortController();
    void requestJson(`/chat/conversations/${room.conversationId}/feedback`,(v:unknown):v is {reported:boolean;stars:number}=>isRecord(v)&&typeof v.reported==="boolean"&&Number.isInteger(v.stars),controller.signal,undefined,customerOptions())
      .then(v=>{setReported(v.reported);setRated(v.stars>0);}).catch(()=>{});
    return ()=>{alive.current=false;controller.abort();};},[room.conversationId]);
  useEffect(()=>{if(promptRating&&!rated)setModal("rating");},[promptRating,rated]);
  const close=()=>{if(busy)return;setModal(null);closePrompt();};
  async function save() {
    if(busy)return;setBusy(true);setNotice("");const controller=new AbortController();
    try {const csrf=await readChatCsrf(session,controller.signal);await requestJson(`/chat/conversations/${room.conversationId}/${modal==="report"?"reports":"rating"}`,isSaved,controller.signal,
      modal==="report"?{reason,description}:{stars},{...customerOptions(),method:modal==="report"?"POST":"PUT",headers:{...customerOptions().headers,"X-CSRF-Token":csrf}});
      if(!alive.current)return;if(modal==="report")setReported(true);else {setRated(true);onRated?.();}setModal(null);closePrompt();setNotice(modal==="report"?"Đã gửi báo cáo tới admin. Nội dung không hiển thị cho người bị báo cáo.":"Cảm ơn bạn đã đánh giá tư vấn viên.");
    } catch(error){if(alive.current)setNotice(error instanceof RestError&&error.code==="FORBIDDEN"?"Chưa đủ điều kiện đánh giá cuộc trò chuyện này.":"Chưa gửi được. Vui lòng thử lại.");}
    finally{if(alive.current)setBusy(false);}
  }
  return <>
    <button type="button" className="secondary-button" disabled={reported} onClick={()=>{setNotice("");setModal("report");}}>⚑ {reported?"Đã báo cáo":session.role==="USER"?"Báo cáo tư vấn viên":"Báo cáo người dùng"}</button>
    {session.role==="USER"&&room.endReason==="COMPLETED"&&!rated&&<button type="button" className="secondary-button" onClick={()=>setModal("rating")}>☆ Đánh giá tư vấn viên</button>}
    {!modal&&notice&&<p role="status">{notice}</p>}
    {modal&&<FeedbackModal title={modal==="report"?"Gửi báo cáo cho admin":"Đánh giá tư vấn viên"} close={close}>
      <form onSubmit={event=>{event.preventDefault();void save();}}>
        {modal==="report"?<><label>Lý do báo cáo<select value={reason} onChange={event=>setReason(event.target.value)} disabled={busy}>{Object.entries(reportReasons).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>Mô tả {reason==="OTHER"?"(bắt buộc)":"(tùy chọn)"}<textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={2000} required={reason==="OTHER"} rows={4} disabled={busy}/></label>
          <p>Admin có thể đối chiếu cuộc trò chuyện để xử lý. Không nhập mật khẩu hoặc thông tin thanh toán.</p></>
          :<><p>Trải nghiệm tư vấn của bạn như thế nào?</p><fieldset className={styles.stars}><legend>Chọn từ 1 đến 5 sao</legend>{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name="rating-stars" value={n} checked={stars===n} onChange={()=>setStars(n)} required disabled={busy}/><span data-selected={n<=stars} aria-hidden="true">★</span><span className="sr-only">{n} sao</span></label>)}</fieldset><p>{stars?`${stars}/5 sao`:"Chọn số sao để đánh giá"}</p></>}
        {notice&&<p role="alert">{notice}</p>}
        <footer><button type="button" className="secondary-button" disabled={busy} onClick={close}>{modal==="rating"?"Bỏ qua":"Hủy"}</button><button type="submit" className="primary-button" disabled={busy||modal==="rating"&&!stars}>{busy?"Đang gửi…":modal==="rating"?"Gửi đánh giá":"Gửi báo cáo"}</button></footer>
      </form>
    </FeedbackModal>}
  </>;
}
export function LockedAccountNotice(){
 const [message,setMessage]=useState("");
 useEffect(()=>{const handler=(e:Event)=>setMessage((e as CustomEvent<string>).detail);window.addEventListener("huyenco-account-locked",handler);return()=>window.removeEventListener("huyenco-account-locked",handler);},[]);
 return message?<FeedbackModal title="Tài khoản đã bị khóa" close={()=>setMessage("")}><p>{message}</p><p><a href="mailto:ddaotrondz2005@gmail.com">Liên hệ admin: ddaotrondz2005@gmail.com</a></p><button className="secondary-button" onClick={()=>window.location.assign("/dang-nhap")}>Về trang đăng nhập</button></FeedbackModal>:null;
}
