// Protocol acceptance client only; no UI changes. Restart handshake uses stdin, never logs cookies/CSRF.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const base=process.env.H01_HTTP_URL??"http://127.0.0.1:18084";
const ws=base.replace(/^http/,"ws")+"/ws";
const origin="http://localhost:3000",clients=[];
let httpCount=0,terminalCount=0;
const results=[];
async function http(method,route,body,owner,status=200,extra={}) {
  const headers={Origin:origin,...(owner?{Cookie:owner.cookie}:{}),...extra};
  if(method!=="GET") {
    headers["X-HuyenCo-Request"]??="1";
    if(owner)headers["X-CSRF-Token"]??=owner.csrf;
  }
  if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:typeof body==="string"?body:JSON.stringify(body)});
  const value=await response.json();httpCount++;
  assert.equal(response.status,status,`${method} ${route}: ${JSON.stringify(value)}`);
  assert.match(value.requestId,/^[a-f0-9-]{36}$/i);
  assert.equal(value.status,status<400?"COMPLETED":"FAILED");
  assert.equal(response.headers.get("cache-control"),"no-store");
  if(status>=400)assert.equal(value.data,null);else assert.equal(value.error,null);
  return {response,value};
}
async function session() {
  const {response,value}=await http("POST","/api/v1/session",{});
  const raw=response.headers.get("set-cookie");assert.ok(raw.includes("HttpOnly")&&raw.includes("SameSite=Lax")&&raw.includes("Path=/"));
  assert.deepEqual(Object.keys(value.data).sort(),["csrfToken","expiresAt"]);
  return {cookie:raw.split(";")[0],csrf:value.data.csrfToken};
}
function connect(owner,headers={}) {
  return new Promise((resolve,reject)=>{
    const state={pending:new Map(),unexpected:[],client:null};
    const timer=setTimeout(()=>reject(new Error("STOMP connection timed out")),5000);
    const client=new Client({webSocketFactory:()=>new WebSocket(ws,{headers:owner?{Cookie:owner.cookie}:{},origin}),
      connectHeaders:headers,reconnectDelay:0,heartbeatIncoming:0,heartbeatOutgoing:0,
      onConnect:()=>{
        clearTimeout(timer);
        for(const queue of ["results","errors"])client.subscribe(`/user/queue/${queue}`,frame=>{
          const value=JSON.parse(frame.body),waiting=state.pending.get(value.requestId);
          if(!waiting){state.unexpected.push(value);return;}
          clearTimeout(waiting.timer);state.pending.delete(value.requestId);terminalCount++;waiting.resolve(value);
        });
        state.client=client;resolve(state);
      },onStompError:()=>{clearTimeout(timer);reject(new Error("STOMP rejected"));},
      onWebSocketError:()=>{clearTimeout(timer);reject(new Error("WebSocket rejected"));}});
    clients.push(client);client.activate();
  });
}
function calculate(state,type,payload,id=crypto.randomUUID()) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{state.pending.delete(id);reject(new Error("Calculation timed out"));},10000);
    state.pending.set(id,{resolve,timer});
    state.client.publish({destination:type==="MAI_HOA"?"/app/mai-hoa/calculate":"/app/tam-the/calculate",
      headers:{"content-type":"application/json"},body:JSON.stringify({requestId:id,type,payload})});
  });
}
const lines={method:"LINES",linesBottomUp:[true,false,true,false,true,false],movingLine:2};
function fixture(name,value) {
  if(process.env.H01_WRITE_FIXTURES!=="1")return;
  const sample=structuredClone(value);sample.requestId="550e8400-e29b-41d4-a716-446655440001";
  fs.writeFileSync(path.join(root,"docs/examples",name),JSON.stringify(sample,null,2)+"\n");
}
try {
  const a=await session(),b=await session();
  assert.notEqual(a.cookie,b.cookie);
  assert.equal((await http("POST","/api/v1/session",{},a)).value.data.csrfToken,a.csrf);
  await http("GET","/api/v1/history",undefined,null,401);
  await http("GET","/api/v1/history",undefined,{cookie:"huyenco_session="+"A".repeat(43)},401);
  await http("POST","/api/v1/session",{},null,403,{Origin:"https://evil.example"});
  await http("POST","/api/v1/session",{},null,403,{"X-HuyenCo-Request":"0"});
  for(const body of ["{}{}",'{"x":1,"x":2}',"[]","x".repeat(16001)])await http("POST","/api/v1/session",body,null,400);
  const [ca,cb,ca2,publicClient]=await Promise.all([connect(a),connect(b),connect(a),connect(null,{ownerId:"spoof",cookie:a.cookie})]);
  const common=crypto.randomUUID();
  const [ar,br]=await Promise.all([calculate(ca,"MAI_HOA",lines,common),calculate(cb,"MAI_HOA",{...lines,movingLine:3},common)]);
  assert.equal(ar.status,"COMPLETED");assert.equal(br.status,"COMPLETED");
  const saved=(await http("POST","/api/v1/history",{calculationRequestId:common,title:"Tra cứu Mai Hoa %_"},a,201)).value;
  const savedB=(await http("POST","/api/v1/history",{calculationRequestId:common},b,201)).value;
  assert.deepEqual(saved.data.result,ar.data);assert.deepEqual(savedB.data.result,br.data);
  assert.notDeepEqual(saved.data.result.changedHexagram,savedB.data.result.changedHexagram);
  assert.ok(!JSON.stringify(saved).includes("H01_PRIVATE_MARKER"));assert.ok(!JSON.stringify(saved).includes("birthDate"));
  const duplicate=(await http("POST","/api/v1/history",{calculationRequestId:common,title:"ignored repeat"},a,201)).value;
  assert.equal(duplicate.data.id,saved.data.id);assert.equal(duplicate.data.title,saved.data.title);
  const forbidden=(await http("GET","/api/v1/history/"+saved.data.id,undefined,b,404)).value;
  await http("DELETE","/api/v1/history/"+saved.data.id,undefined,b,404);
  await http("DELETE","/api/v1/history/"+saved.data.id,undefined,a,403,{"X-CSRF-Token":"wrong"});
  await http("POST","/api/v1/history",{calculationRequestId:common},a,403,{"X-CSRF-Token":"wrong"});
  const aOnly=await calculate(ca2,"MAI_HOA",{method:"OBJECT_COUNT",objectCount:12,hourIndex:8,question:"H01_PRIVATE_MARKER"});
  await http("POST","/api/v1/history",{calculationRequestId:aOnly.requestId},b,404);
  const objectSaved=(await http("POST","/api/v1/history",{calculationRequestId:aOnly.requestId},a,201)).value;
  assert.ok(!JSON.stringify(objectSaved).includes("H01_PRIVATE_MARKER"));
  await http("DELETE","/api/v1/history/"+objectSaved.data.id,undefined,a);
  const publicResult=await calculate(publicClient,"MAI_HOA",lines);
  await http("POST","/api/v1/history",{calculationRequestId:publicResult.requestId},a,404);
  const conflict=crypto.randomUUID();
  await calculate(ca,"MAI_HOA",lines,conflict);await calculate(ca,"MAI_HOA",{...lines,movingLine:4},conflict);
  await http("POST","/api/v1/history",{calculationRequestId:conflict},a,400);
  const invalidResult=await calculate(ca,"MAI_HOA",{...lines,movingLine:7});assert.equal(invalidResult.status,"FAILED");
  await http("POST","/api/v1/history",{calculationRequestId:invalidResult.requestId},a,404);
  for(const extra of [{ownerId:"fake"},{result:{}},{title:null},{title:" "},{title:"x".repeat(101)}])
    await http("POST","/api/v1/history",{calculationRequestId:common,...extra},a,400);
  const tam=await calculate(ca,"TAM_THE",{birthDate:"2024-02-10",birthTime:"08:30",calendarType:"SOLAR",isLeapMonth:false});
  assert.equal(tam.status,"COMPLETED");
  const tamSaved=(await http("POST","/api/v1/history",{calculationRequestId:tam.requestId},a,201)).value;
  assert.deepEqual(tamSaved.data.result,tam.data);assert.ok(!JSON.stringify(tamSaved).includes("birthDate"));
  const listed=(await http("GET","/api/v1/history",undefined,a)).value;
  assert.equal(listed.data.totalElements,2);assert.equal((await http("GET","/api/v1/history",undefined,b)).value.data.totalElements,1);
  assert.equal((await http("GET","/api/v1/history?type=TAM_THE",undefined,a)).value.data.totalElements,1);
  assert.equal((await http("GET","/api/v1/history?q=%25_",undefined,a)).value.data.totalElements,1);
  assert.equal((await http("GET","/api/v1/history?q="+encodeURIComponent("' OR 1=1 --"),undefined,a)).value.data.totalElements,0);
  assert.equal((await http("GET","/api/v1/history?page=2147483647&size=100",undefined,a)).value.data.items.length,0);
  for(const query of ["size=101","page=-1","page=2147483648","type=BAD","ownerId=fake","page=0&page=1"])
    await http("GET","/api/v1/history?"+query,undefined,a,400);
  if(process.env.H01_RESTART_CHECK==="1"||process.env.H01_WAIT_TTL_MS) {
    await new Promise(resolve=>setTimeout(resolve,Number(process.env.H01_WAIT_TTL_MS??5100)));
    await http("POST","/api/v1/history",{calculationRequestId:aOnly.requestId},a,404);
  }
  await http("POST","/api/v1/history",{calculationRequestId:common},a,201);
  const unknown=crypto.randomUUID();await http("GET","/api/v1/history/"+unknown,undefined,a,404);
  assert.deepEqual((await http("GET","/api/v1/history/"+saved.data.id,undefined,a)).value.data.result,ar.data);
  fixture("history-detail.response.json",saved);fixture("history-list.response.json",listed);fixture("history-not-found.response.json",forbidden);
  for(const state of [ca,cb,ca2,publicClient])assert.deepEqual(state.unexpected,[]);
  await Promise.all(clients.map(client=>client.deactivate()));
  if(process.env.H01_RESTART_CHECK==="1") {
    const input=createInterface({input:process.stdin});
    const resumed=new Promise(resolve=>input.once("line",resolve));
    console.log("H01_READY_FOR_RESTART");await resumed;input.close();
    assert.equal((await http("POST","/api/v1/session",{},a)).value.data.csrfToken,a.csrf);
    assert.deepEqual((await http("GET","/api/v1/history/"+saved.data.id,undefined,a)).value.data.result,ar.data);
    assert.equal((await http("GET","/api/v1/history",undefined,a)).value.data.totalElements,2);
    assert.equal((await http("POST","/api/v1/history",{calculationRequestId:common},a,201)).value.data.id,saved.data.id);
    await http("POST","/api/v1/history",{calculationRequestId:aOnly.requestId},a,404);
  }
  const deleted=(await http("DELETE","/api/v1/history/"+tamSaved.data.id,undefined,a)).value;assert.equal(deleted.data.deleted,true);
  fixture("history-deleted.response.json",deleted);
  await http("GET","/api/v1/history/"+tamSaved.data.id,undefined,a,404);
  await http("DELETE","/api/v1/history/"+tamSaved.data.id,undefined,a,404);
  const report={passed:true,httpRequests:httpCount,stompTerminal:terminalCount,restartChecked:process.env.H01_RESTART_CHECK==="1"};
  fs.writeFileSync(path.join(root,"scripts/generated/h01_network.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
} finally {await Promise.all(clients.map(client=>client.deactivate()));}
