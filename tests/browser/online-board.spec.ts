import {test,expect,type Route,type Locator} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {isolatedRooms} from "./isolated-rooms";
import type {RoomView} from "../../src/server/rooms";

test("online shared game board retains depot geometry, expansion rail and direct input",async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport});
 const activate=(target:Locator)=>info.project.use.hasTouch?target.tap():target.click();
 const proxy=async(r:Route)=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 await page.context().route("**/api/rooms{,/**}",proxy);await peer.route("**/api/rooms{,/**}",proxy);await page.context().routeWebSocket("**/api/rooms/*/live",ws=>ws.close());await peer.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
 try{
  const response=await fetch(`${server.url}/api/rooms`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"보드 A",shieldRules:true,whiteCastles:true,inns:true,tradeRoutes:true,vineyards:true})});expect(response.status).toBe(200);const seat=await response.json();
  const joined=await fetch(`${server.url}/api/rooms/${seat.id}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"보드 B"})});expect(joined.status).toBe(200);const other=await joined.json();
  const view=async()=>await(await fetch(`${server.url}/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json() as RoomView;
  let initial=await view();const rolled=await fetch(`${server.url}/api/rooms/${seat.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${seat.token}`},body:JSON.stringify({revision:initial.revision,action:initial.actions.find(a=>a.action.type==="roll-round")!.action})});expect(rolled.status).toBe(200);
  const path=join(server.directory,`${seat.id}.json`),room=JSON.parse(await readFile(path,"utf8"));room.game.players[0].workers=10;room.game.players[0].silver=10;room.game.dice.players["seat-1"].forEach((d:{value:number})=>d.value=1);await writeFile(path,JSON.stringify(room));initial=await view();
  await page.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),seat);await peer.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),other);await page.goto("/online");const guest=await peer.newPage();await guest.goto("/online");
  await expect(page.getByLabel("온라인 주사위 1",{exact:true})).toBeEnabled();
  const board=page.getByRole("region",{name:"공용 공급처 보드",exact:true}),table=page.getByRole("region",{name:"온라인 공용 게임판",exact:true});
  await expect(board.locator("[data-depot]")).toHaveCount(6);await expect(board.locator("[data-shield-slot]")).toHaveCount(6);await expect(board.locator("[data-info-panel]")).toHaveCount(4);await expect(board.locator("[data-black-depot]")).toHaveCount(1);await expect(page.locator(".online-estates .trade-route-panel")).toHaveCount(2);await expect(table.locator(".trade-route-panel")).toHaveCount(0);
  await page.mouse.move(0,0);await table.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath("after-online-board.png"),fullPage:true});await table.screenshot({path:info.outputPath("table-overview.png")});
  const svg=board.locator(".common-board-svg"),scale=board.getByRole("button",{name:"공용 보드 배율 복원",exact:true});
  for(const zoom of [1,1.6,2]){
   await scale.click();await expect(scale).toHaveText("100%");
   if(zoom===1.6)for(let n=1;n<=6;n++){await board.locator(".live-board-scroll").evaluate(el=>el.dispatchEvent(new WheelEvent("wheel",{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true})));await expect(scale).toHaveText(`${100+n*10}%`);}
   if(zoom===2)for(let n=0;n<4;n++)await board.getByRole("button",{name:"공용 보드 확대",exact:true}).click();
   await expect(scale).toHaveText(`${zoom*100}%`);
   const geometry=await svg.evaluate(el=>{
    const rect=(e:Element)=>e.getBoundingClientRect(),shields=[...el.querySelectorAll("[data-shield-zone]")],others=[...el.querySelectorAll("[data-supply-hit],[data-goods-space],[data-info-panel]")];
    return {viewBox:el.getAttribute("viewBox"),overlap:shields.some(s=>others.some(o=>{const a=rect(s),b=rect(o);return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;}))};
   });expect(geometry).toEqual({viewBox:"0 0 950 1030",overlap:false});
   for(const target of await board.locator("[data-shield-slot] .shield-outline,[data-supply-hit],[data-goods-space]").all()){
    await target.scrollIntoViewIfNeeded();await target.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.y+r.height/2-innerHeight/2);});
    expect(await target.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),owner=el.closest("[data-shield-slot],.supply-art-tile")??el;return !!hit&&owner.contains(hit);})).toBe(true);
   }
   await page.mouse.move(0,0);await board.screenshot({path:info.outputPath(`board-${zoom*100}.png`)});
  }
  await scale.click();
  const side=table.getByRole("region",{name:"공용 포도 공급처",exact:true});await page.mouse.move(0,0);await side.scrollIntoViewIfNeeded();await page.getByRole("heading",{name:"Burgundy · 2인 온라인 방",exact:true}).click();await side.scrollIntoViewIfNeeded();await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);await page.screenshot({path:info.outputPath("expansion-rail.png")});
  const positions=await table.evaluate(el=>{const a=el.querySelector(".common-board-panel")!.getBoundingClientRect(),b=el.querySelector(".vineyard-supply")!.getBoundingClientRect();return {gap:b.x-a.right,top:Math.abs(a.y-b.y)};});expect(positions.gap).toBeCloseTo(12,0);expect(positions.top).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const undo=async()=>{await page.getByRole("button",{name:"이전 행동으로",exact:true}).click();await expect.poll(async()=>(await view()).players[0].storage).toEqual(initial.players[0].storage);await expect.poll(async()=>(await view()).dice).toEqual(initial.dice);};
  const take=initial.actions.find(a=>a.action.type==="use-die"&&a.action.intent.kind==="take-tile")!;if(take.action.type!=="use-die"||take.action.intent.kind!=="take-tile")throw Error("No depot target");
  await activate(page.getByLabel("온라인 주사위 1",{exact:true}));await activate(board.locator(`[data-tile-id="${take.action.intent.tileId}"]`));await expect.poll(async()=>(await view()).players[0].storage).toContain(take.action.intent.tileId);await undo();
  const black=initial.actions.find(a=>a.action.type==="buy-black-tile"&&initial.blackDepot.includes(a.action.tileId))!;if(black.action.type!=="buy-black-tile")throw Error("No purchase target");if(info.project.use.hasTouch)await page.getByLabel("보드에서 은화 구매 선택",{exact:true}).check();await activate(board.locator(`[data-tile-id="${black.action.tileId}"]`));await expect.poll(async()=>(await view()).players[0].silver).toBe(8);await expect(guest.locator(`[data-black-depot] [data-tile-id="${black.action.tileId}"]`)).toHaveCount(0);await undo();
  await activate(page.getByLabel("온라인 주사위 1",{exact:true}));const vine=side.locator('[data-vine-supply-kind="depot"] button:enabled').first();await activate(vine);await expect.poll(async()=>(await view()).players[0].vineyardReserve?.length).toBe(1);await expect(guest.locator('[data-vine-supply-kind="depot"] [data-vine-tile="empty"]')).toHaveCount(1);await page.reload();await expect(side.locator('[data-vine-supply-kind="depot"] [data-vine-tile="empty"]')).toHaveCount(1);
  await page.locator(".online-estates .trade-route-panel").first().getByRole("button",{name:"전체 무역로 펼치기",exact:true}).click();await expect(page.locator(".online-estates .trade-route-panel").first().locator("[data-trade-card]")).toHaveCount(5);
 }finally{await peer.close();await server.close();}
});
