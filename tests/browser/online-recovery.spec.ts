import {test,expect,type Route} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {isolatedRooms} from "./isolated-rooms";
import type {RoomView} from "../../src/server/rooms";

for(const committed of [false,true])test(`uncertain action ${committed?"after":"before"} commit survives reload with one request ID and one effect`,async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport});
 let outage=false,drop=true,outageReads=0;const bodies:{requestId:string;revision:number;action:{type:string;intent?:{kind:string}}}[]=[];
 const proxy=async(route:Route,fragile=false)=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(fragile&&outage){if(req.method()==="GET")outageReads++;await route.fulfill({status:503,json:{error:"테스트 서버 재시작 중"}});return;}
  const payload=req.method()==="POST"?req.postDataJSON():null,worker=fragile&&path.endsWith("/actions")&&payload?.action?.intent?.kind==="take-workers";
  if(worker)bodies.push(payload);
  if(worker&&drop&&!committed){drop=false;outage=true;await route.abort("failed");return;}
  const res=await fetch(server.url+path,{method:req.method(),headers:{...req.headers(),host:new URL(server.url).host,origin:server.url},body:req.postData()??undefined});
  if(worker&&drop){expect(res.status).toBe(200);drop=false;outage=true;await route.abort("failed");return;}
  await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
 };
 await page.context().route("**/api/rooms{,/**}",r=>proxy(r,true));await peer.route("**/api/rooms{,/**}",r=>proxy(r));
 await page.context().routeWebSocket("**/api/rooms/*/live",ws=>ws.close());await peer.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
 try{
  const seat=await(await fetch(server.url+"/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"복원A"})})).json();
  const other=await(await fetch(`${server.url}/api/rooms/${seat.id}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"복원B"})})).json();
  const view=async()=>await(await fetch(`${server.url}/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json() as RoomView;
  await page.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),seat);await peer.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),other);
  await page.goto("/online");const guest=await peer.newPage();await guest.goto("/online");await page.getByRole("button",{name:"주사위 굴리기",exact:true}).click();
  await expect(page.getByLabel("온라인 일꾼 획득",{exact:true})).toBeEnabled();const before=await view();await page.getByLabel("온라인 일꾼 획득",{exact:true}).click();
  await expect(page.getByLabel("온라인 연결 상태",{exact:true})).toContainText("서버 재연결 중");await expect(page.getByLabel("온라인 일꾼 획득",{exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"이전 행동으로",exact:true})).toBeDisabled();
  const pending=await page.evaluate(id=>JSON.parse(localStorage.getItem(`burgundy-online-action:${id}`)!),seat.id);expect(pending.requestId).toBe(bodies[0].requestId);
  expect((await view()).players[0].workers).toBe(before.players[0].workers+(committed?2:0));
  await page.waitForTimeout(3100);expect(outageReads).toBeLessThan(10);
  await page.reload();await expect(page.getByRole("button",{name:"연결 다시 시도",exact:true})).toBeVisible();expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`burgundy-online-action:${id}`)!).requestId,seat.id)).toBe(pending.requestId);
  outage=false;await page.evaluate(()=>window.dispatchEvent(new Event("online")));
  await expect.poll(()=>page.evaluate(id=>localStorage.getItem(`burgundy-online-action:${id}`),seat.id)).toBeNull();await expect(page.getByLabel("온라인 일꾼 획득",{exact:true})).toBeEnabled();
  await expect(page.getByRole("alert",{name:"온라인 오류",exact:true})).toHaveCount(0);const after=await view();expect(after.players[0].workers).toBe(before.players[0].workers+2);expect(after.revision).toBe(before.revision+1);expect(bodies.length).toBeGreaterThanOrEqual(2);expect(bodies.every(b=>b.requestId===pending.requestId&&b.revision===before.revision)).toBe(true);
  const stored=await readFile(join(server.directory,`${seat.id}.json`),"utf8");expect(JSON.parse(stored).requests.filter((r:{id:string})=>r.id===pending.requestId)).toHaveLength(1);
  await page.reload();await guest.reload();for(const [p,identity] of [[page,seat],[guest,other]] as const){await expect(p.locator("[data-game-revision]")).toHaveAttribute("data-game-revision",String(after.revision));expect(await p.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!).token)).toBe(identity.token);}
  expect(await readFile(join(server.directory,`${seat.id}.json`),"utf8")).toBe(stored);
  await page.getByLabel("온라인 연결 상태",{exact:true}).screenshot({path:info.outputPath(`recovered-${committed}.png`)});
 }finally{await page.context().unrouteAll({behavior:"ignoreErrors"});await peer.unrouteAll({behavior:"ignoreErrors"});await peer.close();await server.close();}
});

test("incompatible persisted room stops retries and preserves identity until an explicit retry",async({page})=>{
 const server=await isolatedRooms();let incompatible=false,rejectAction=false,reads=0;
 await page.route("**/api/rooms{,/**}",async r=>{const q=r.request();if(rejectAction&&q.method()==="POST"){await r.fulfill({status:409,json:{error:"최신 준비 상태에서 다시 선택하세요."}});return;}if(incompatible&&q.method()==="GET"){reads++;await r.fulfill({status:409,json:{code:"ROOM_SCHEMA_UNSUPPORTED",error:"지원하지 않는 방 저장 형식입니다. 원본은 보존됩니다."}});return;}const res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});await page.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
 try{
  await page.goto("/online");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();await expect(page.getByRole("button",{name:"준비 완료",exact:true})).toBeEnabled();const identity=await page.evaluate(()=>localStorage.getItem("burgundy-online-seat-v1"));
  incompatible=true;await page.evaluate(()=>window.dispatchEvent(new Event("burgundy-room-retry")));await expect(page.getByLabel("온라인 연결 상태",{exact:true})).toContainText("저장 형식");await expect(page.getByRole("alert",{name:"온라인 오류",exact:true})).toContainText("원본은 보존");await expect(page.getByRole("button",{name:"준비 완료",exact:true})).toBeDisabled();
  await page.waitForTimeout(2100);expect(reads).toBe(1);expect(await page.evaluate(()=>localStorage.getItem("burgundy-online-seat-v1"))).toBe(identity);
  incompatible=false;await page.getByRole("button",{name:"연결 다시 시도",exact:true}).click();await expect(page.getByRole("button",{name:"준비 완료",exact:true})).toBeEnabled();
  rejectAction=true;await page.getByRole("button",{name:"준비 완료",exact:true}).click();await expect(page.getByRole("alert",{name:"온라인 오류",exact:true})).toContainText("최신 준비 상태");await page.waitForTimeout(1500);await expect(page.getByRole("alert",{name:"온라인 오류",exact:true})).toContainText("최신 준비 상태");
  rejectAction=false;await page.getByRole("button",{name:"준비 완료",exact:true}).click();await expect(page.getByRole("button",{name:"준비 취소",exact:true})).toBeVisible();await expect(page.getByRole("alert",{name:"온라인 오류",exact:true})).toHaveCount(0);
 }finally{await page.context().unrouteAll({behavior:"ignoreErrors"});await server.close();}
});
