import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const url=process.env.WS_URL??"ws://localhost:8080/ws";
const data=JSON.parse(fs.readFileSync(path.join(root,"data/tam_the_d02_source.json"),"utf8"));
const csv=(name)=>{
  const [header,...rows]=fs.readFileSync(path.join(root,"data",name),"utf8").trim().split(/\r?\n/).map(line=>line.split(","));
  return rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
};
const yearElements=new Map();
for(const row of csv("tam_the_year_element_review.csv")) {
  yearElements.set(`${row.first_stem}/${row.first_branch}`,row.element);
  yearElements.set(`${row.second_stem}/${row.second_branch}`,row.element);
}
const career=csv("tam_the_career13_matrix.csv"),jobs=csv("tam_the_career11_source.csv");
const stems=["GIAP","AT","BINH","DINH","MAU","KY","CANH","TAN","NHAM","QUY"];
const branches=["TY","SUU","DAN","MAO","THIN","TI","NGO","MUI","THAN","DAU","TUAT","HOI"];
const clients=[], evidence=[];
let terminalCount=0,progressCount=0;
function connect(label) {
  return new Promise((resolve,reject)=>{
    const state={label,pending:new Map(),unexpected:[]};
    const timer=setTimeout(()=>reject(new Error("Connect timeout")),5000);
    const client=new Client({webSocketFactory:()=>new WebSocket(url),reconnectDelay:0,
      onConnect:()=>{
        clearTimeout(timer);
        for(const queue of ["progress","results","errors"]) client.subscribe(`/user/queue/${queue}`,frame=>{
          const body=JSON.parse(frame.body),waiting=state.pending.get(body.requestId);
          if(!waiting) {state.unexpected.push(body);return;}
          assert.equal(body.type,"TAM_THE");
          if(queue==="progress") {waiting.progress.push(body);progressCount++;}
          else {terminalCount++;clearTimeout(waiting.timer);state.pending.delete(body.requestId);waiting.resolve({response:body,progress:waiting.progress});}
        });
        state.client=client;resolve(state);
      },onStompError:()=>reject(new Error("STOMP rejected")),onWebSocketError:()=>reject(new Error("WebSocket error"))});
    clients.push(client);client.activate();
  });
}
function request(state,payload,id=crypto.randomUUID()) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{state.pending.delete(id);reject(new Error("Terminal timeout"));},10000);
    state.pending.set(id,{resolve,progress:[],timer});
    state.client.publish({destination:"/app/tam-the/calculate",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:id,type:"TAM_THE",payload})});
  });
}
function prefix(result,expected=4) {
  assert.deepEqual(result.progress.map(p=>p.sequence),Array.from({length:expected},(_,i)=>i+1));
  assert.deepEqual(result.progress.map(p=>p.step),["ACCEPTED","VALIDATING","CALCULATING","LOOKUP"].slice(0,expected));
}
function lunar(year,month,categories) {
  return {birthDate:`${year}-${String(month).padStart(2,"0")}-01`,birthTime:"08:30",calendarType:"LUNAR",isLeapMonth:false,...(categories?{categories}:{})};
}
function verify(result,year,month,categories=["CAREER","WEALTH","LOVE"]) {
  prefix(result);
  const stem=stems[(year-1984)%10],branch=branches[(year-1984)%12],element=yearElements.get(`${stem}/${branch}`);
  assert.ok(element);
  const wealth=data.wealth.rows[stem].flatMap((value,i)=>value===month?[`WEALTH_C${String(i+1).padStart(2,"0")}`]:[]);
  const body=result.response;
  if(categories.includes("WEALTH") && !wealth.length) {
    assert.equal(body.status,"FAILED");assert.equal(body.data,null);
    assert.equal(body.error.code,"RULE_NOT_AVAILABLE");assert.equal(body.error.ruleCode,"TT-TAI-LOC");assert.equal(body.error.reason,"LOOKUP_NOT_AVAILABLE");
    return;
  }
  assert.equal(body.status,"COMPLETED");assert.equal(body.error,null);
  assert.equal(body.data.ruleBasis,"SOURCE_VERIFIED");assert.equal(body.data.sourceStatus,"VERIFIED");
  assert.deepEqual(body.data.decisionReferences,[]);
  assert.deepEqual(body.data.categories.map(c=>c.category),categories);
  for(const category of body.data.categories) {
    let expected;
    if(category.category==="WEALTH") expected=wealth;
    else if(category.category==="LOVE") expected=[`LOVE_C${String(data.love.rows[element].indexOf(month)+1).padStart(2,"0")}`];
    else {
      expected=["MUA_BAN","CAU_CHAI","LAM_THO"].filter(job=>jobs.find(r=>r.occupation===job && r.element===element).months_printed.split(";").map(Number).includes(month));
      const row=career.find(row=>row.stem===stem);
      expected.push(`CAREER13_C${String(Array.from({length:12},(_,i)=>i+1).find(i=>Number(row[`c${String(i).padStart(2,"0")}`])===month)).padStart(2,"0")}`);
    }
    assert.deepEqual(category.entries.map(e=>e.resultCode),expected);
    for(const entry of category.entries) {
      assert.ok(entry.content.length>0);
      assert.ok(entry.sourceReferences.every(s=>s.sourceId==="TT" && s.sha256==="7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d"));
      if(category.category==="LOVE"||category.category==="WEALTH") {
        const group=category.category==="LOVE"?data.love:data.wealth;
        const passage=group.passages[Number(entry.resultCode.slice(-2))-1];
        assert.equal(entry.content,passage.text);
        assert.deepEqual(entry.sourceReferences.map(s=>s.pdfPage),[...new Set([group.tablePage,...passage.pages])]);
      }
      for(const ref of entry.sourceReferences) assert.ok(body.data.sourceReferences.some(s=>JSON.stringify(s)===JSON.stringify(ref)));
    }
  }
  assert.ok(body.data.rules.every(r=>r.executionPolicy==="SOURCE_VERIFIED" && r.sourceStatus==="VERIFIED"));
  assert.ok(!JSON.stringify(body.data).includes("birthDate") && !JSON.stringify(body.data).includes("birthTime"));
}
async function fixture(state,name,payload,expectedYear,expectedMonth,categories) {
  const id="550e8400-e29b-41d4-a716-446655440001";
  const result=await request(state,payload,id);verify(result,expectedYear,expectedMonth,categories);
  if(process.env.D03_WRITE_FIXTURES==="1") {
    const folder=path.join(root,"docs/examples");
    fs.writeFileSync(path.join(folder,`${name}.request.json`),JSON.stringify({requestId:id,type:"TAM_THE",payload},null,2)+"\n");
    fs.writeFileSync(path.join(folder,`${name==="tam-the-no-match"?"tam-the-unavailable":name}.response.json`),JSON.stringify(result.response,null,2)+"\n");
  }
  evidence.push({case:name,...result});
}
try {
  const a=await connect("A"),b=await connect("B");
  await fixture(a,"tam-the",{birthDate:"2024-02-10",birthTime:"08:30",calendarType:"SOLAR",isLeapMonth:false},2024,1);
  await fixture(a,"tam-the-career",lunar(1984,10,["CAREER"]),1984,10,["CAREER"]);
  await fixture(a,"tam-the-wealth",lunar(1984,1,["WEALTH"]),1984,1,["WEALTH"]);
  await fixture(a,"tam-the-love",lunar(1984,1,["LOVE"]),1984,1,["LOVE"]);
  await fixture(a,"tam-the-no-match",lunar(2024,2),2024,2);
  for(let year=1984;year<1994;year++) for(let month=1;month<=12;month++) {
    const state=month%2?a:b;verify(await request(state,lunar(year,month)),year,month);
  }
  for(const year of [1984,1986,1988,1990,1996]) for(let month=1;month<=12;month++)
    verify(await request(b,lunar(year,month,["LOVE"])),year,month,["LOVE"]);
  for(let year=1984;year<2044;year++) verify(await request(a,lunar(year,1,["CAREER","LOVE"])),year,1,["CAREER","LOVE"]);
  for(const categories of [["LOVE","CAREER","WEALTH"],["WEALTH","LOVE"],["LOVE","CAREER"],["CAREER","WEALTH"],["WEALTH","CAREER","LOVE"]])
    verify(await request(a,lunar(1984,1,categories)),1984,1,categories);
  const sameId=crypto.randomUUID();
  const [first,second]=await Promise.all([request(a,lunar(2024,1,["LOVE"]),sameId),request(b,lunar(1984,1,["LOVE"]),sameId)]);
  verify(first,2024,1,["LOVE"]);verify(second,1984,1,["LOVE"]);
  assert.notEqual(first.response.data.categories[0].entries[0].resultCode,second.response.data.categories[0].entries[0].resultCode);
  const leap={...lunar(2023,2,["LOVE"]),isLeapMonth:true};
  const [lr,sr]=await Promise.all([request(a,leap),request(b,{birthDate:"2023-03-22",birthTime:"23:59",calendarType:"SOLAR",isLeapMonth:false,categories:["LOVE"]})]);
  prefix(lr);prefix(sr);assert.equal(lr.response.status,"COMPLETED");assert.deepEqual(lr.response.data,sr.response.data);
  for(const [payload,error] of [
    [{...lunar(2024,1),categories:[]},"INVALID_INPUT"],[{...lunar(2024,1),categories:["LOVE","LOVE"]},"INVALID_INPUT"],
    [{...lunar(2024,1),categories:["HOUR"]},"INVALID_INPUT"],[{...lunar(2024,1),birthTime:"24:00"},"INVALID_DATE"],
    [{...lunar(2024,1),isLeapMonth:null},"INVALID_INPUT"],[{...lunar(2024,1),yearStem:"GIAP"},"INVALID_INPUT"],
    [{...lunar(2023,3),isLeapMonth:true},"INVALID_DATE"],[{...lunar(2100,1)},"INVALID_DATE"],
    [{...lunar(2024,1),birthDate:"2024-01-01' OR 1=1 --"},"INVALID_DATE"],
  ]) {const r=await request(a,payload);prefix(r,2);assert.equal(r.response.error.code,error);assert.equal(r.response.data,null);}
  assert.deepEqual(a.unexpected,[]);assert.deepEqual(b.unexpected,[]);
  console.log(`D03 STOMP passed: ${terminalCount} terminal, ${progressCount} progress; tables, 60 years, category order, leap month and two-session isolation.`);
} finally {
  await Promise.all(clients.map(c=>c.deactivate()));
  if(process.env.D03_REPORT_PATH) fs.writeFileSync(process.env.D03_REPORT_PATH,JSON.stringify({terminalCount,progressCount,evidence},null,2));
}
