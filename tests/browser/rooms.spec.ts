import {chooseOnlineStart,startOnlineLobby} from "./starting-castles";
import { isolatedRooms } from "./isolated-rooms";
import { test, expect } from "@playwright/test";

test("two browser seats synchronize turns, reconnect and cannot impersonate each other",async({page,browser},info)=>{
  test.setTimeout(60_000);
  const isolated=await isolatedRooms();
  const route=async(route:import("@playwright/test").Route)=>{const req=route.request();const response=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});};
  await page.context().route("**/api/rooms{,/**}",route);
  const otherContext=await browser.newContext({viewport:info.project.use.viewport});
  await otherContext.route("**/api/rooms{,/**}",route);
  const guest=await otherContext.newPage();
  try{
    await page.goto("/online");await page.getByLabel("온라인 이름").fill("온라인A");const created=page.waitForResponse(r=>r.url().endsWith("/api/rooms")&&r.request().method()==="POST");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();expect((await created).status()).toBe(200);
    const code=await page.getByLabel("공유할 방 코드").inputValue();expect(code).toMatch(/^[a-f0-9]{24}$/);
    await guest.goto(new URL("/online",page.url()).href);await guest.getByLabel("온라인 이름").fill("온라인B");await guest.getByLabel("방 코드",{exact:true}).fill(code);await guest.getByRole("button",{name:"방 참가",exact:true}).click();
    await startOnlineLobby(page,guest);await chooseOnlineStart(page);await chooseOnlineStart(guest);
    await expect(page.getByRole("button",{name:"주사위 굴리기",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"되돌리기",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"이전 행동으로",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"온라인 행동 실행",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"주사위 굴리기",exact:true}).click();
    await expect(page.getByLabel("온라인 상태",{exact:true})).toContainText("온라인A의 차례");
    const auth=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!));
    const workers=async()=>(await(await page.request.get(`${isolated.url}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}})).json()).players[0].workers as number,initialWorkers=await workers();
    for(let i=0;i<2;i++){
      await page.getByLabel("온라인 일꾼 획득",{exact:true}).click();
      await expect(page.locator(".online-logs p").filter({hasText:"일꾼 획득"})).toHaveCount(i+1);
      await expect.poll(workers).toBe(initialWorkers+2*(i+1));
    }
    await expect(page.getByRole("alertdialog",{name:"턴 종료 확인",exact:true})).toHaveCount(0);await expect(page.getByLabel("온라인 상태",{exact:true})).toContainText("온라인A의 차례");await expect(page.getByLabel("현재 행동 안내",{exact:true})).toContainText("턴을 종료하시겠습니까?");
    let endRequests=0;page.on("request",r=>{if(r.method()==="POST"&&r.url().endsWith("/actions")&&r.postDataJSON()?.action?.type==="end-turn")endRequests++;});
    await page.screenshot({path:".local-data/action-guidance/online-immediate.png"});await page.getByRole("button",{name:"턴 종료",exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect(guest.getByLabel("온라인 상태",{exact:true})).toContainText("온라인B의 차례");
    expect(endRequests).toBe(1);
    await guest.reload();await expect(guest.getByLabel("온라인 일꾼 획득",{exact:true})).toBeEnabled();
    await expect(page.getByRole("button",{name:"주사위 굴리기",exact:true})).toHaveCount(0);
    const response=await page.request.get(`${isolated.url}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}});expect(response.status()).toBe(200);
    const publicState=await response.json();expect(publicState.random).toBeUndefined();expect(publicState.supplyPools).toBeUndefined();
    const stale=await page.request.post(`${isolated.url}/api/rooms/${code}/actions`,{headers:{Authorization:`Bearer ${auth.token}`},data:{revision:publicState.revision-1,action:{type:"end-turn",playerId:"seat-1"}}});expect(stale.status()).toBe(409);const unchanged=await(await page.request.get(`${isolated.url}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}})).json();expect(unchanged.revision).toBe(publicState.revision);
    const forged=await page.request.post(`${isolated.url}/api/rooms/${code}/actions`,{headers:{Authorization:`Bearer ${auth.token}`},data:{revision:publicState.revision,action:{type:"end-turn",playerId:"seat-2"}}});expect(forged.status()).toBe(403);
    const unauthorized=await page.request.get(`${isolated.url}/api/rooms/${code}`);expect(unauthorized.status()).toBe(401);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await otherContext.close();await isolated.close();}
});
