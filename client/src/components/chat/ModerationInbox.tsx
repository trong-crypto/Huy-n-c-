"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { requestJson, RestError } from "@/services/rest/transport";
import { customerOptions, readCustomerSession } from "@/services/rest/customerAuth";
import { isRecord } from "@/types/contractValidation";
import styles from "./feedback.module.css";

type Notice={id:string;title:string;body:string;created_at:string;read_at:string|null};
type Inbox={items:Notice[];unread:number};
const valid=(v:unknown):v is Inbox=>isRecord(v)&&Number.isSafeInteger(v.unread)&&Array.isArray(v.items)
 &&v.items.every(x=>isRecord(x)&&typeof x.id==="string"&&typeof x.title==="string"&&typeof x.body==="string"&&typeof x.created_at==="string"&&(x.read_at===null||typeof x.read_at==="string"));
export function ModerationInbox(){
 const [data,setData]=useState<Inbox|null>(null),[open,setOpen]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
 const current=useRef<AbortController|null>(null),alive=useRef(true);
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const panelId=useId();
 const [position,setPosition]=useState<CSSProperties>({visibility:"hidden"});
 const close=useCallback(()=>{setOpen(false);trigger.current?.focus();},[]);
 useLayoutEffect(()=>{
  if(!open)return;
  function place(){
   const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
   const viewportWidth=document.documentElement.clientWidth||window.innerWidth;
   const width=Math.min(420,viewportWidth-24),below=window.innerHeight-rect.bottom-20,above=rect.top-20;
   const height=Math.min(560,Math.max(80,below<180&&above>below?above:below));
   const top=below<180&&above>below?Math.max(12,rect.top-height-8):Math.min(rect.bottom+8,Math.max(12,window.innerHeight-100));
   setPosition({width,left:Math.max(12,Math.min(rect.right-width,viewportWidth-width-12)),top,maxHeight:Math.min(height,window.innerHeight-top-12)});
  }
  function outside(event:PointerEvent){const node=event.target as Node;if(!trigger.current?.contains(node)&&!panel.current?.contains(node))setOpen(false);}
  function keyboard(event:KeyboardEvent){if(event.key==="Escape"){event.preventDefault();close();}}
  place();const frame=window.requestAnimationFrame(()=>closeButton.current?.focus());
  window.addEventListener("resize",place);window.addEventListener("scroll",place,true);document.addEventListener("pointerdown",outside);document.addEventListener("keydown",keyboard);
  return()=>{window.cancelAnimationFrame(frame);window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);};
 },[open,close]);
 const refresh=useCallback(async()=>{
  current.current?.abort();const controller=new AbortController();current.current=controller;
  try{const next=await requestJson(`/chat/moderation-notifications?page=${page}`,valid,controller.signal,undefined,customerOptions());if(!controller.signal.aborted){setData(next);setError("");}}
  catch(e){if(controller.signal.aborted)return;if(e instanceof RestError&&["INVALID_SESSION","FORBIDDEN","ACCOUNT_SUSPENDED","LOGIN_REQUIRED"].includes(e.code)){setData(null);setOpen(false);}else if(alive.current)setError("Chưa tải được thông báo. Vui lòng thử lại.");}
 },[page]);
 useEffect(()=>{alive.current=true;void refresh();const tick=()=>{if(!document.hidden)void refresh();};const timer=window.setInterval(tick,30000);window.addEventListener("focus",tick);document.addEventListener("visibilitychange",tick);
  return()=>{alive.current=false;current.current?.abort();window.clearInterval(timer);window.removeEventListener("focus",tick);document.removeEventListener("visibilitychange",tick);};},[refresh]);
 async function read(id:string){if(busy)return;setBusy(id);setError("");try{const controller=new AbortController();const session=await readCustomerSession(controller.signal);
  await requestJson(`/chat/moderation-notifications/${id}/read`,(v:unknown):v is {saved:true}=>isRecord(v)&&v.saved===true,controller.signal,{}, {...customerOptions(),method:"PUT",headers:{...customerOptions().headers,"X-CSRF-Token":session.csrfToken}});if(alive.current)await refresh();
 }catch{if(alive.current)setError("Chưa đánh dấu được thông báo. Hãy thử lại.");}finally{if(alive.current)setBusy(null);}}
 if(!data)return null;
 return <>
  <div className={styles.inboxButton}>
   {data.unread>0&&<span className="sr-only" role="status">Có {data.unread} thông báo từ admin chưa đọc</span>}
   <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?panelId:undefined}
     onClick={()=>open?close():setOpen(true)}>Thông báo admin {data.unread>0?`(${data.unread})`:""}</button>
  </div>
  {open&&createPortal(<section ref={panel} id={panelId} role="dialog" aria-label="Thông báo từ admin" className={styles.inboxPanel} style={position}>
   <header><h2>Thông báo từ admin</h2><button ref={closeButton} type="button" className="secondary-button" aria-label="Đóng thông báo" onClick={close}>×</button></header>
   {error&&<p role="alert">{error}</p>}{!data.items.length&&<p>Chưa có thông báo trên trang này.</p>}
   {data.items.map(n=><article key={n.id} className={styles.inboxItem} data-unread={!n.read_at}><h3>{n.title}</h3><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</time><p style={{whiteSpace:"pre-wrap"}}>{n.body}</p>{!n.read_at&&<button className="secondary-button" disabled={!!busy} onClick={()=>void read(n.id)}>{busy===n.id?"Đang lưu…":"Đánh dấu đã đọc"}</button>}</article>)}
   <footer>
    <div className={styles.inboxPagination}>
     <button type="button" className={`secondary-button ${styles.inboxIconButton}`} aria-label="Trang trước" title="Trang trước" disabled={!page} onClick={()=>setPage(p=>p-1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
     <span>Trang {page+1}</span>
     <button type="button" className={`secondary-button ${styles.inboxIconButton}`} aria-label="Trang sau" title="Trang sau" disabled={data.items.length!==20} onClick={()=>setPage(p=>p+1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
    </div>
    <button type="button" className={`secondary-button ${styles.inboxIconButton}`} aria-label="Tải lại thông báo" title="Tải lại thông báo" onClick={()=>void refresh()}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7M20 12l-3-5"/></svg></button>
   </footer>
  </section>,document.body)}
 </>;
}
