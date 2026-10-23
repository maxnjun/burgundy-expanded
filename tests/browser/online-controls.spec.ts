import {test,expect,type Route} from "@playwright/test";
import {isolatedRooms} from "./isolated-rooms";
import {startOnlineLobby,chooseOnlineStart,waitOnlineFresh} from "./starting-castles";
import type {RoomView} from "../../src/server/rooms";

test("direct online input, reversible starting preview, both undo modes and peer reconnect",async({page,browser},info)=>{
 test.setTimeout(120_000);const server=await isolatedRooms(),context=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile});
 const proxy=async(route:Route)=>{const req=route.request(),res=await fetch(server.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(server.url).host,origin:server.url},body:req.postData()??undefined});await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 await page.context().route("**/api/rooms{,/**}",proxy);await context.route("**/api/rooms{,/**}",proxy);await page.context().routeWebSocket("**/api/rooms/*/live",ws=>ws.close());await context.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());const guest=await context.newPage();
 try{
  await page.goto("/online");await page.getByLabel("온라인 이름").fill("A");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();const code=await page.getByLabel("공유할 방 코드").inputValue();
  await guest.goto("/online");await guest.getByLabel("온라인 이름").fill("B");await guest.getByLabel("방 코드",{exact:true}).fill(code);await guest.getByRole("button",{name:"방 참가",exact:true}).click();await startOnlineLobby(page,guest);
  await expect(page.getByRole("button",{name:"온라인 행동 실행",exact:true})).toHaveCount(0);await expect(page.getByLabel("온라인 행동 종류",{exact:true})).toHaveCount(0);
  const cells=page.locator('[data-can-start="true"]');await expect(cells.first()).toBeVisible();const first=await cells.first().getAttribute("data-estate-cell"),second=await cells.nth(1).getAttribute("data-estate-cell");
  await cells.first().click();await expect(page.locator('[data-starting-preview="true"]')).toHaveAttribute("data-estate-cell",first!);await waitOnlineFresh(guest);await expect(guest.locator('[data-starting-preview="true"]')).toHaveAttribute("data-estate-cell",first!);
  await cells.nth(1).click();await expect(page.locator('[data-starting-preview="true"]')).toHaveAttribute("data-estate-cell",second!);await page.reload();await expect(page.locator('[data-starting-preview="true"]')).toHaveAttribute("data-estate-cell",second!);
  await page.screenshot({path:info.outputPath("online-starting-preview.png"),fullPage:true});await page.getByRole("button",{name:"되돌리기",exact:true}).click();await expect(page.locator('[data-starting-preview="true"]')).toHaveCount(0);await expect(page.getByRole("button",{name:"턴 종료",exact:true})).toBeDisabled();
  await chooseOnlineStart(page);await chooseOnlineStart(guest);await waitOnlineFresh(page);await page.getByRole("button",{name:"주사위 굴리기",exact:true}).click();
  const auth=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!)),view=async()=>await(await fetch(`${server.url}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}})).json() as RoomView;
  await expect(page.getByLabel("온라인 주사위 1",{exact:true})).toBeEnabled();const initial=await view(),take=initial.actions.find(x=>x.action.type==="use-die"&&x.action.intent.kind==="take-tile"&&x.action.adjustment.workersSpent===0)!;if(take.action.type!=="use-die"||take.action.intent.kind!=="take-tile")throw Error("No tile take");
  const action=take.action;if(action.type!=="use-die"||action.intent.kind!=="take-tile")throw Error("Missing supply target");const die=initial.dice.players[initial.seat].findIndex(d=>d.id===action.dieId);await page.getByLabel(`온라인 주사위 ${die+1}`,{exact:true}).click();const intent=action.intent;
  await page.locator(`[data-depot="${intent.depot}"] [data-tile-id="${intent.tileId}"]`).click();await expect.poll(async()=>(await view()).players[0].storage).toContain(intent.tileId);
  await expect(page.getByRole("button",{name:"이전 행동으로",exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath("online-undo-ready.png"),fullPage:true});await page.getByRole("button",{name:"이전 행동으로",exact:true}).click();await expect.poll(async()=>(await view()).players[0].storage).toEqual(initial.players[0].storage);await waitOnlineFresh(guest);
  await page.getByLabel("온라인 일꾼 획득",{exact:true}).click();await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers+2);
  await page.getByRole("button",{name:"되돌리기",exact:true}).click();await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers);await expect.poll(async()=>(await view()).dice.players[initial.seat]).toEqual(initial.dice.players[initial.seat]);
  await page.screenshot({path:info.outputPath("online-direct-controls.png"),fullPage:true});
  for(let i=0;i<2;i++){await page.getByLabel("온라인 일꾼 획득",{exact:true}).click();await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers+2*(i+1));}
  await page.getByRole("button",{name:"턴 종료",exact:true}).click();await expect(page.getByRole("button",{name:"되돌리기",exact:true})).toBeDisabled();await guest.reload();await waitOnlineFresh(guest);await expect(guest.getByLabel("온라인 일꾼 획득",{exact:true})).toBeEnabled();
 }finally{await context.close();await server.close();}
});
