import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

const url = process.env.WS_URL ?? "ws://localhost:8080/ws";
const clients = [], frames = [], faults = [];
const patterns = [0,7,3,5,1,6,2,4,0];
const codes = ["","CAN","DOAI","LY","CHAN","TON","KHAM","CAN2","KHON"];
const bits = (lines) => lines.reduce((value, yang, i) => value | (yang ? 1 << i : 0), 0);
const payload = (datetime) => ({method:"TIME", datetime, question:"private-time-question-sentinel"});

function connect(label) {
  return new Promise((resolve,reject) => {
    const pending = new Map();
    const timer = setTimeout(() => { void client.deactivate(); reject(new Error("Connect timeout")); },8000);
    const client = new Client({webSocketFactory:() => new WebSocket(url),reconnectDelay:0,
      onConnect:() => {
        clearTimeout(timer);
        for(const queue of ["progress","results","errors"]) client.subscribe(`/user/queue/${queue}`,message => {
          try {
            const body=JSON.parse(message.body);frames.push({label,queue,body});
            const waiting=pending.get(body.requestId);
            if(!waiting) { faults.push(`${label}: unexpected/late/duplicate frame`);return; }
            if(queue==="progress") waiting.progress.push(body);
            else { pending.delete(body.requestId);clearTimeout(waiting.timer);waiting.resolve({body,queue,progress:waiting.progress}); }
          } catch(error) { faults.push(error.message); }
        });
        resolve({client,pending});
      },
      onWebSocketError:() => {clearTimeout(timer);reject(new Error("WebSocket failed"));},
      onStompError:() => {clearTimeout(timer);faults.push("STOMP rejected");reject(new Error("STOMP rejected"));}
    });
    clients.push(client);client.activate();
  });
}

function send(state,input,requestId=crypto.randomUUID()) {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(() => {state.pending.delete(requestId);reject(new Error("Response timeout"));},10000);
    state.pending.set(requestId,{resolve,timer,progress:[]});
    state.client.publish({destination:"/app/mai-hoa/calculate",headers:{"content-type":"application/json"},
      body:JSON.stringify({requestId,type:"MAI_HOA",payload:input})});
  });
}

function verify(result,lunar,hour) {
  assert.deepEqual(result.progress.map(p=>p.step),["ACCEPTED","VALIDATING","CALCULATING","LOOKUP"]);
  assert.deepEqual(result.progress.map(p=>p.sequence),[1,2,3,4]);
  assert.ok(result.progress.every(p=>p.requestId===result.body.requestId && p.type==="MAI_HOA"));
  assert.equal(result.queue,"results");assert.equal(result.body.status,"COMPLETED");assert.equal(result.body.error,null);
  const d=result.body.data, year=((lunar.year+8)%12)+1, date=year+lunar.month+lunar.day, total=date+hour;
  const upper=(date-1)%8+1,lower=(total-1)%8+1,moving=(total-1)%6+1;
  const primary=patterns[lower]|(patterns[upper]<<3);
  assert.equal(d.method,"TIME");assert.deepEqual(d.lunarDate,lunar);
  assert.equal(d.ruleBasis,"TEAM_DECISION");assert.equal(d.sourceStatus,"VERIFIED");
  assert.deepEqual(d.rules.map(r=>r.ruleCode),["LUNAR-CONVERSION","MH-TIME","MH-TRIGRAM","MH-MUTUAL","MH-CHANGE"]);
  assert.ok(d.rules.filter(r=>r.ruleCode!=="MH-TIME").every(r=>r.sourceStatus==="VERIFIED"));
  assert.equal(d.rules[1].sourceStatus,"VERIFIED");
  assert.ok(d.decisionReferences.some(r=>r.decisionId==="DEC-20261022-MH-TIME-MOD6"));
  assert.ok(d.decisionReferences.some(r=>r.decisionId==="DEC-20261024-B04-CIVIL-TIME"));
  assert.equal(d.sourceReferences[0].sourceId,"C01-VN-FIXED7");assert.equal(d.sourceReferences[0].pdfPage,null);
  assert.ok(d.sourceReferences[0].url.startsWith("https://"));assert.match(d.sourceReferences[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(d.primaryHexagram.code,`H_${codes[upper]}_${codes[lower]}`);
  assert.equal(bits(d.primaryHexagram.linesBottomUp),primary);
  assert.equal(bits(d.mutualHexagram.linesBottomUp),((primary>>1)&7)|(((primary>>2)&7)<<3));
  assert.equal(bits(d.changedHexagram.linesBottomUp),primary^(1<<(moving-1)));
  assert.equal(d.movingLine,moving);
  for(const h of [d.primaryHexagram,d.mutualHexagram,d.changedHexagram]) {assert.equal(h.nameStatus,"VERIFIED");assert.ok(h.name);}
  assert.deepEqual(d.calculationSteps.map(s=>s.code),["TIME_NUMBERS","MUTUAL","CHANGE"]);
  const v=d.calculationSteps[0].values;
  assert.equal(v.yearBranchIndex,year);assert.equal(v.hourIndex,hour);assert.equal(v.dateSum,date);assert.equal(v.timeSum,total);
  assert.equal(v.isLeapMonth,lunar.isLeapMonth);assert.equal(v.leapMonthPolicy,"SAME_MONTH_NUMBER");
  assert.ok(!JSON.stringify(result.body).includes("private-time-question-sentinel"));
}

const lunar=(year,month,day,isLeapMonth=false)=>({year,month,day,isLeapMonth});
let passed=false;
try {
  const a=await connect("A"),b=await connect("B"), shared=crypto.randomUUID();
  const [tet,leap]=await Promise.all([send(a,payload("2024-02-10T00:00:00+07:00"),shared),send(b,payload("2023-03-22T00:00:00+07:00"),shared)]);
  verify(tet,lunar(2024,1,1),1);verify(leap,lunar(2023,2,1,true),1);
  assert.deepEqual([tet.body.data.primaryHexagram.name,tet.body.data.mutualHexagram.name,tet.body.data.changedHexagram.name],["Bác","Khôn","Mông"]);
  const controls=fs.readFileSync(path.resolve("../data/c01_control_dates.csv"),"utf8").trim().split(/\r?\n/).slice(1).map(row=>row.split(","));
  await Promise.all([a,b].map(async(state,index)=>{
    for(let i=index;i<controls.length;i+=2) {
      const [date,year,month,day,isLeapMonth]=controls[i],expected=lunar(+year,+month,+day,isLeapMonth==="true");
      for(const [time,hour] of [["00:00:00",1],["12:59:59",7],["23:00:00",1]]) verify(await send(state,payload(`${date}T${time}+07:00`)),expected,hour);
    }
  }));
  for(const [instant,expected,hour] of [
    ["2024-02-09T17:00:00Z",lunar(2024,1,1),1],["2024-02-10T01:00:00+08:00",lunar(2024,1,1),1],
    ["2024-02-09T23:59:59+07:00",lunar(2023,12,30),1],["2024-02-10T00:59:59+07:00",lunar(2024,1,1),1],
    ["2024-02-10T01:00:00+07:00",lunar(2024,1,1),2],["2024-02-10T22:59:59+07:00",lunar(2024,1,1),12],
    ["1899-12-31T17:00:00Z",lunar(1899,12,1),1],["2100-01-01T10:59:00+18:00",lunar(2099,11,20),1]
  ]) verify(await send(a,payload(instant)),expected,hour);
  for(const [input,error] of [
    [payload("2024-02-30T00:00:00+07:00"),"INVALID_DATE"],[payload("2024-01-01T12:00:00"),"INVALID_DATE"],
    [payload("1899-12-31T23:59:59+07:00"),"INVALID_DATE"],[payload("2100-01-01T00:00:00+07:00"),"INVALID_DATE"],
    [payload("+999999999-12-31T23:59:59-18:00"),"INVALID_DATE"],[payload(null),"INVALID_INPUT"],
    [{...payload("2024-02-10T00:00:00+07:00"),isLeapMonth:true},"INVALID_INPUT"],
    [{...payload("2024-02-10T00:00:00+07:00"),question:"x".repeat(501)},"INVALID_INPUT"]
  ]) {
    const result=await send(a,input);assert.equal(result.queue,"errors");assert.equal(result.body.status,"FAILED");
    assert.equal(result.body.error.code,error);assert.equal(result.body.data,null);
    assert.deepEqual(result.progress.map(p=>p.step),["ACCEPTED","VALIDATING"]);
  }
  assert.deepEqual(faults,[]);passed=true;
  if(process.env.TIME_FIXTURE_PATH) {
    fs.writeFileSync(path.resolve(process.env.TIME_FIXTURE_PATH),JSON.stringify({...tet.body,requestId:"550e8400-e29b-41d4-a716-446655440000"},null,2)+"\n");
  }
  console.log(`TIME passed: ${frames.filter(f=>f.queue!=="progress").length} terminal / ${frames.filter(f=>f.queue==="progress").length} progress; independent date controls, boundary/offset/leap, privacy and two-session checks.`);
} finally {
  await Promise.all(clients.map(c=>c.deactivate()));
  if(process.env.TIME_REPORT_PATH) {
    const output=path.resolve(process.env.TIME_REPORT_PATH);fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify({passed,faults,frames},null,2)+"\n");
  }
}
