import {test,expect,type Route} from "@playwright/test";
import {isolatedRooms} from "./isolated-rooms";
import {startOnlineLobby,chooseOnlineStart,waitOnlineFresh} from "./starting-castles";
import type {RoomView} from "../../src/server/rooms";

test("online names, unique colors, editable own lobby profile and 58px dice survive play, undo and reconnect",async({page,browser},info)=>{
 test.setTimeout(120_000);
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile}),guest=await peer.newPage();
 const proxy=async(route:Route)=>{const req=route.request(),res=await fetch(server.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(server.url).host,origin:server.url},body:req.postData()??undefined});await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 for(const ctx of [page.context(),peer]){await ctx.route("**/api/rooms{,/**}",proxy);await ctx.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());}
 const press=async(target:ReturnType<typeof page.getByRole>)=>info.project.use.hasTouch?target.tap():target.click();
 try{
  await page.goto("/online");await page.getByLabel("온라인 색상",{exact:true}).selectOption("purple");await press(page.getByRole("button",{name:"2인 방 만들기",exact:true}));
  const code=await page.getByLabel("공유할 방 코드",{exact:true}).inputValue();await expect(page.getByLabel("내 이름 수정",{exact:true})).toHaveValue("영주 1");
  await guest.goto(`/online?room=${code}`);await guest.getByLabel("온라인 색상",{exact:true}).selectOption("purple");await press(guest.getByRole("button",{name:"방 참가",exact:true}));
  await expect(guest.getByRole("alert",{name:"온라인 오류"})).toContainText("이미 사용 중인 색상");
  await guest.getByLabel("온라인 색상",{exact:true}).selectOption("pink");await press(guest.getByRole("button",{name:"방 참가",exact:true}));await waitOnlineFresh(page);
  await expect(guest.getByLabel("내 이름 수정",{exact:true})).toHaveValue("영주 2");
  await expect(guest.getByLabel("내 색상 수정",{exact:true}).locator('option[value="purple"]')).toHaveJSProperty("disabled",true);
  await expect(page.getByRole("region",{name:"게임 시작 준비",exact:true})).toContainText("2/2명");await waitOnlineFresh(page);
  await page.getByLabel("내 이름 수정",{exact:true}).fill("보라 영주");await press(page.getByRole("button",{name:"이름·색상 저장",exact:true}));await waitOnlineFresh(guest);
  await expect(guest.getByRole("region",{name:"게임 시작 준비",exact:true})).toContainText("보라 영주");
  await guest.getByLabel("내 이름 수정",{exact:true}).fill("분홍 영주");await press(guest.getByRole("button",{name:"이름·색상 저장",exact:true}));await waitOnlineFresh(page);
  await page.screenshot({path:info.outputPath("identity-lobby.png"),fullPage:true});
  await startOnlineLobby(page,guest);await chooseOnlineStart(page);await chooseOnlineStart(guest);await waitOnlineFresh(page);await press(page.getByRole("button",{name:"주사위 굴리기",exact:true}));
  const auth=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!));
  const view=async()=>await(await fetch(`${server.url}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}})).json() as RoomView;
  await expect(page.getByLabel("온라인 주사위 1",{exact:true})).toBeEnabled();const initial=await view();
  expect(initial.players.map(p=>[p.name,p.color])).toEqual([["보라 영주","purple"],["분홍 영주","pink"]]);
  for(const [screen,color,rgb] of [[page,"purple","rgb(155, 114, 196)"],[guest,"pink","rgb(225, 139, 180)"]] as const){
   await waitOnlineFresh(screen);const dice=screen.locator('.online-direct-resources .online-die');await expect(dice).toHaveCount(2);
   for(const d of await dice.all()){await expect(d).toHaveAttribute("data-player-color",color);await expect(d).toHaveCSS("background-color",rgb);const box=await d.boundingBox();expect(box!.width).toBe(58);expect(box!.height).toBe(58);}
   await expect(screen.locator('.online-player[data-player-color="purple"] h2')).toContainText("보라 영주");await expect(screen.locator('.online-player[data-player-color="pink"] h2')).toContainText("분홍 영주");
   await expect(screen.locator('.online-profile')).toHaveCount(0);
   const controls=screen.getByLabel("온라인 합법 행동",{exact:true});await controls.scrollIntoViewIfNeeded();await screen.screenshot({path:info.outputPath(`identity-${color}-controls.png`)});
   const bounds=await dice.first().boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual((await screen.viewportSize())!.width);
  }
  await press(page.getByLabel("온라인 주사위 1",{exact:true}));await expect(page.getByLabel("온라인 주사위 1",{exact:true})).toHaveAttribute("aria-pressed","true");
  await press(page.getByLabel("온라인 일꾼 획득",{exact:true}));await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers+2);await expect(page.getByLabel("온라인 주사위 1",{exact:true})).toHaveClass(/used/);
  await press(page.getByRole("button",{name:"이전 행동으로",exact:true}));await expect.poll(async()=>(await view()).dice).toEqual(initial.dice);
  await press(page.getByLabel("온라인 일꾼 획득",{exact:true}));await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers+2);
  await press(page.getByRole("button",{name:"되돌리기",exact:true}));await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers);
  for(let i=0;i<2;i++){await press(page.getByLabel("온라인 일꾼 획득",{exact:true}));await expect.poll(async()=>(await view()).players[0].workers).toBe(initial.players[0].workers+2*(i+1));}
  await press(page.getByRole("button",{name:"턴 종료",exact:true}));await guest.reload();await waitOnlineFresh(guest);await expect(guest.getByLabel("온라인 주사위 1",{exact:true})).toBeEnabled();await expect(guest.getByLabel("온라인 상태",{exact:true})).toContainText("분홍 영주의 차례");
  await page.reload();await waitOnlineFresh(page);expect((await view()).players.map(p=>[p.name,p.color])).toEqual(initial.players.map(p=>[p.name,p.color]));await expect(page.getByRole("button",{name:"되돌리기",exact:true})).toBeDisabled();
  await guest.screenshot({path:info.outputPath("identity-peer-turn.png"),fullPage:true});
 }finally{await peer.close();await server.close();}
});
