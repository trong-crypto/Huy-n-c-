import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RoomFeedback, LockedAccountNotice } from "./FeedbackDialog";
import type { ChatSession, Conversation } from "@/types/chatContract";
vi.mock("@/services/rest/chat",()=>({readChatCsrf:vi.fn(async()=>"csrf")}));
const user="550e8400-e29b-41d4-a716-446655440001",consultant="550e8400-e29b-41d4-a716-446655440002",id="550e8400-e29b-41d4-a716-446655440003";
const session:ChatSession={accountId:user,role:"USER",expiresAt:"2099-01-01T00:00:00Z"};
const room:Conversation={conversationId:id,userId:user,consultantId:consultant,status:"ENDED",createdAt:"2026-11-01T00:00:00Z",startedAt:"2026-11-01T00:01:00Z",endedAt:"2026-11-01T00:02:00Z",endReason:"COMPLETED",endedByAccountId:user};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
 vi.stubGlobal("fetch",vi.fn(async(path:string)=>Response.json({requestId:id,status:"COMPLETED",error:null,data:path.endsWith("/feedback")?{reported:false,stars:0}:{saved:true}})));
});
it("opens the rating prompt, submits chosen stars once and hides the rating action",async()=>{
 render(<RoomFeedback session={session} room={room} promptRating closePrompt={vi.fn()}/>);
 expect(screen.getByRole("dialog",{name:"Đánh giá tư vấn viên"})).toBeTruthy();
 fireEvent.click(screen.getByRole("radio",{name:"4 sao"}));fireEvent.click(screen.getByRole("button",{name:"Gửi đánh giá"}));
 await screen.findByText("Cảm ơn bạn đã đánh giá tư vấn viên.");
 const writes=vi.mocked(fetch).mock.calls.filter(([,options])=>options?.method==="PUT");
 expect(writes).toHaveLength(1);expect(writes[0][1]?.body).toBe(JSON.stringify({stars:4}));
 expect(screen.queryByRole("button",{name:/Đánh giá tư vấn viên/})).toBeNull();
});
it("skips a rating without writing a zero score",async()=>{
 const close=vi.fn();render(<RoomFeedback session={session} room={room} promptRating closePrompt={close}/>);
 fireEvent.click(screen.getByRole("button",{name:"Bỏ qua"}));expect(close).toHaveBeenCalled();
 expect(screen.queryByRole("dialog")).toBeNull();expect(vi.mocked(fetch).mock.calls.some(([,o])=>o?.method==="PUT")).toBe(false);
});
it.each(["USER","CONSULTANT"] as const)("lets %s report the peer with an Other description",async role=>{
 render(<RoomFeedback session={{...session,role,accountId:role==="USER"?user:consultant}} room={room} promptRating={false} closePrompt={vi.fn()}/>);
 fireEvent.click(screen.getByRole("button",{name:role==="USER"?/Báo cáo tư vấn viên/:/Báo cáo người dùng/}));
 fireEvent.change(screen.getByLabelText("Lý do báo cáo"),{target:{value:"OTHER"}});
 const description=screen.getByLabelText("Mô tả (bắt buộc)");expect((description as HTMLTextAreaElement).required).toBe(true);
 fireEvent.change(description,{target:{value:"Mô tả sự việc"}});fireEvent.click(screen.getByRole("button",{name:"Gửi báo cáo"}));
 await screen.findByText(/Đã gửi báo cáo tới admin/);
 const writes=vi.mocked(fetch).mock.calls.filter(([,o])=>o?.method==="POST");expect(writes).toHaveLength(1);
 expect(writes[0][1]?.body).toBe(JSON.stringify({reason:"OTHER",description:"Mô tả sự việc"}));
});
it("shows the lock reason and the admin contact when access is revoked",async()=>{
 render(<LockedAccountNotice/>);act(()=>window.dispatchEvent(new CustomEvent("huyenco-account-locked",{detail:"Tài khoản bị khóa: Spam"})));
 expect(screen.getByText("Tài khoản bị khóa: Spam")).toBeTruthy();
 expect(screen.getByRole("link",{name:/Liên hệ admin/}).getAttribute("href")).toBe("mailto:ddaotrondz2005@gmail.com");
 fireEvent.click(screen.getByRole("button",{name:"Đóng cửa sổ"}));await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});
