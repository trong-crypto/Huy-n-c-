import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminReports } from "./AdminReports";
const auth=vi.hoisted(()=>({session:{csrfToken:"csrf"},handleError:vi.fn()}));
vi.mock("./AdminSessionGate",()=>({useAdminSession:()=>auth}));
it("guides review, keeps details open after a decision and requires a reason to reopen",async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
 const id="550e8400-e29b-41d4-a716-446655440001";
 let report={id,target_id:id,conversation_id:id,reporter_name:"Người dùng A",target_name:"Tư vấn viên B",target_status:"ACTIVE",reason:"HARASSMENT",description:"Nội dung cần xem xét",status:"PENDING",admin_note:"",review_note:"",version:1,created_at:"2026-11-28T00:00:00Z",decision_action:null as string|null,decision_reason:null as string|null};
 const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
  let data:unknown;
  if(options?.method==="PUT") {const body=JSON.parse(String(options.body));report={...report,status:body.status,review_note:body.note,version:report.version+1};data={saved:true};}
  else if(options?.method==="POST"){const body=JSON.parse(String(options.body));report={...report,status:"RESOLVED",version:report.version+1,admin_note:body.note,decision_action:body.action,decision_reason:body.note,target_status:"LOCKED"};data={saved:true};}
  else if(path.includes("/moderation"))data={items:[]};
  else if(path.includes("/messages"))data={items:[{sequence:1,text:"Tin nhắn đối chiếu",sender_name:"Người dùng A"}]};
  else if(path==="/api/v1/admin/reports/"+id)data=report;
  else data={items:report.status==="PENDING"?[report]:[],totalPages:1,totalElements:report.status==="PENDING"?1:0,page:0};
  return Response.json({requestId:id,status:"COMPLETED",error:null,data});
 });
 vi.stubGlobal("fetch",fetch);render(<AdminReports/>);
 fireEvent.click(await screen.findByRole("button",{name:/Tư vấn viên B.*Người báo cáo: Người dùng A/}));
 await screen.findByText("Nội dung cần xem xét");expect(screen.queryByLabelText("Chọn biện pháp")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Bắt đầu xem xét"}));
 await screen.findByLabelText("Chọn biện pháp");await screen.findByText("Tin nhắn đối chiếu");
 expect(screen.queryByRole("combobox",{name:"Trạng thái xem xét"})).toBeNull();
 fireEvent.change(screen.getByLabelText("Chọn biện pháp"),{target:{value:"TEMP_LOCK"}});
 fireEvent.change(screen.getByLabelText("Lý do quyết định (bắt buộc)"),{target:{value:"Đã đối chiếu và xử lý"}});
 expect((screen.getByRole("button",{name:"Xem và xác nhận quyết định"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole("checkbox",{name:/Tôi đã kiểm tra/}));
 fireEvent.click(screen.getByRole("button",{name:"Xem và xác nhận quyết định"}));
 expect(fetch.mock.calls.some(([,o])=>o?.method==="POST")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Xác nhận áp dụng"}));
 await screen.findByRole("heading",{name:"Kết quả xử lý"});
 expect(screen.getByText("Đã đối chiếu và xử lý")).toBeTruthy();
 expect(screen.queryByLabelText("Chọn biện pháp")).toBeNull();expect(screen.queryByLabelText("Ghi chú nội bộ của admin")).toBeNull();
 const write=fetch.mock.calls.find(([,o])=>o?.method==="POST");
 expect(JSON.parse(String(write![1]?.body))).toMatchObject({action:"TEMP_LOCK",days:7,note:"Đã đối chiếu và xử lý",expectedVersion:2,requestId:expect.any(String)});
 fireEvent.click(screen.getByRole("button",{name:"Mở lại báo cáo"}));
 const reopen=screen.getByRole("button",{name:"Xác nhận mở lại"});expect((reopen as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText("Lý do mở lại (bắt buộc)"),{target:{value:"Có thông tin mới"}});fireEvent.click(reopen);
 await screen.findByLabelText("Chọn biện pháp");expect(report.review_note).toBe("Có thông tin mới");
 fireEvent.click(screen.getByRole("button",{name:"← Danh sách báo cáo"}));
 await waitFor(()=>expect(screen.queryByRole("heading",{name:"Chi tiết báo cáo"})).toBeNull());
});
