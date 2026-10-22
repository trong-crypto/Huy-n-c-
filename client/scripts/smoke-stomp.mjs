import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

const url = process.env.WS_URL ?? "ws://localhost:8080/ws";

async function waitForResponses(a, b) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (a.inbox.length >= 2 && b.inbox.length >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Hết thời gian chờ phản hồi STOMP.");
}

function connect() {
  return new Promise((resolve, reject) => {
    const inbox = [];
    const client = new Client({
      webSocketFactory: () => new WebSocket(url),
      reconnectDelay: 0,
      onConnect: () => {
        clearTimeout(deadline);
        client.subscribe("/user/queue/results", (message) => inbox.push(JSON.parse(message.body)));
        client.subscribe("/user/queue/errors", (message) => inbox.push(JSON.parse(message.body)));
        resolve({ client, inbox });
      },
      onWebSocketError: () => reject(new Error(`Không kết nối được ${url}`)),
      onStompError: () => reject(new Error("Server từ chối STOMP")),
    });
    const deadline = setTimeout(() => {
      void client.deactivate();
      reject(new Error(`Hết thời gian kết nối ${url}`));
    }, 5000);
    client.activate();
  });
}

const clients = [];
try {
  const a = await connect();
  clients.push(a.client);
  const b = await connect();
  clients.push(b.client);
  const aId = crypto.randomUUID();
  const bId = crypto.randomUUID();
  const invalidId = crypto.randomUUID();

  a.client.publish({
    destination: "/app/mai-hoa/calculate",
    body: JSON.stringify({ requestId: aId, type: "MAI_HOA", payload: { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8 } }),
    headers: { "content-type": "application/json" },
  });
  b.client.publish({
    destination: "/app/tam-the/calculate",
    body: JSON.stringify({ requestId: bId, type: "TAM_THE", payload: { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false } }),
    headers: { "content-type": "application/json" },
  });
  a.client.publish({
    destination: "/app/mai-hoa/calculate",
    body: JSON.stringify({ requestId: invalidId, type: "MAI_HOA", payload: { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 13 } }),
    headers: { "content-type": "application/json" },
  });

  await waitForResponses(a, b);
  const aIds = a.inbox.map((item) => item.requestId);
  const bIds = b.inbox.map((item) => item.requestId);
  const passed = a.inbox.length === 2 && b.inbox.length === 1
    && aIds.includes(aId) && aIds.includes(invalidId) && bIds[0] === bId
    && a.inbox.find((item) => item.requestId === invalidId)?.error?.code === "INVALID_INPUT"
    && a.inbox.find((item) => item.requestId === aId)?.error?.ruleCode === "MH-OBJECT-COUNT"
    && b.inbox[0]?.error?.ruleCode === "TT-NGU-HANH";
  if (!passed) throw new Error("Phản hồi sai requestId/session hoặc mã lỗi.");
  console.log("STOMP smoke test đạt: hai phiên tách biệt, INVALID_INPUT và ruleCode đúng.");
} finally {
  await Promise.all(clients.map((client) => client.deactivate()));
}
