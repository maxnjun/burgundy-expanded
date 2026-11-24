import {expect,test,type Locator,type Page,type Route} from "@playwright/test";
import type {GameState} from "../../src/game/types";
import {isolatedRooms} from "./isolated-rooms";
import {waitOnlineFresh} from "./starting-castles";

const title="시작 플레이어 결정";
const starter=(page:Page)=>page.getByRole("dialog",{name:title,exact:true});
const rollButton=(dialog:Locator,seat:number)=>dialog.getByRole("button",{name:new RegExp(`^좌석 ${seat} .+주사위`)});
const game=(page:Page):Promise<GameState>=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);
async function press(target:Locator){
 if(await target.page().evaluate(()=>navigator.maxTouchPoints>0))await target.tap();
 else await target.click();
}
async function predetermined(page:Page,faces:number[],hotseat=false){
 await page.addInitScript(({faces,hotseat})=>{
  const getOriginal=crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto,"getRandomValues",{value:(array:Parameters<Crypto["getRandomValues"]>[0])=>{
   if(array instanceof Uint8Array&&array.length===1&&faces.length){array[0]=faces.shift()!-1;return array;}
   return getOriginal(array);
  }});
  if(hotseat)document.addEventListener("DOMContentLoaded",()=>{
   document.documentElement.dataset.nativeApp="android";
   window.dispatchEvent(new Event("burgundy-native-ready"));
  });
 },{faces,hotseat});
}

test("starter dice let 2 players roll and cancel without changing the current game",async({page})=>{
 await predetermined(page,[1,6]);
 await page.goto("/");
 await press(page.getByRole("button",{name:"⚙ 게임 준비",exact:true}));
 await expect(page.getByLabel("시작 플레이어 결정 방식",{exact:true})).toHaveValue("roll");
 await expect(page.getByRole("button",{name:"새 연습 시작",exact:true})).toBeEnabled();
 const before=await game(page);
 await press(page.getByRole("button",{name:"새 연습 시작",exact:true}));
 const dialog=starter(page);
 await expect(dialog.getByRole("button",{name:"게임 시작",exact:true})).toBeDisabled();
 await press(rollButton(dialog,1));
 await expect(dialog.getByText("굴리는 중",{exact:true})).toBeVisible();
 await expect(dialog.getByText("눈 1",{exact:true})).toBeVisible();
 await press(rollButton(dialog,2));
 await expect(dialog).toContainText("루이 님이 시작합니다.");
 expect(await game(page)).toEqual(before);
 await press(dialog.getByRole("button",{name:"닫기",exact:true}));
 await expect(dialog).toHaveCount(0);
 expect(await game(page)).toEqual(before);
});

test("starter dice narrow repeated ties in a 4-seat hotseat game",async({page},info)=>{
 await predetermined(page,[6,1,6,3,2,2,1,5],true);
 await page.goto("/");
 await press(page.getByRole("button",{name:"핫시트 — 한 기기에서 2~4인",exact:true}));
 await page.getByLabel("플레이어 수",{exact:true}).selectOption("4");
 page.once("dialog",dialog=>dialog.accept());
 await press(page.getByRole("button",{name:"핫시트 게임 시작",exact:true}));
 const dialog=starter(page);
 for(const i of [1,2,3,4])await press(rollButton(dialog,i));
 await expect(dialog.locator("[data-starter-tied]")).toHaveCount(2);
 for(const i of [2,4])await expect(rollButton(dialog,i)).toBeDisabled();
 const start=dialog.getByRole("button",{name:"게임 시작",exact:true});
 const popupBox=(await dialog.boundingBox())!,startBox=(await start.boundingBox())!;
 expect(startBox.y+startBox.height).toBeLessThanOrEqual(popupBox.y+popupBox.height);
 await dialog.screenshot({path:info.outputPath("tied-starting-dice.png")});
 for(const i of [1,3,1,3])await press(rollButton(dialog,i));
 await expect(dialog.locator("[data-starter-winner]")).toHaveAttribute("data-starter-seat","2");
 await dialog.screenshot({path:info.outputPath("winning-starting-die.png")});
 await press(start);
 await expect.poll(async()=>(await game(page)).config.startingPlayerId).toBe("seat-3");
 const after=await game(page);
 expect(after.turn.activePlayerId).toBe("seat-3");
 expect(after.turn.orderTrack[0].players).toEqual(["seat-3","seat-4","seat-1","seat-2"]);
 expect(after.players.map(p=>p.workers)).toEqual([3,4,1,2]);
 expect([after.turn.phase,after.turn.round,after.dice.rolledForRound]).toEqual(["A",1,false]);
});

test("starter dice roll automatically for both AI seats in a 3-player game",async({page})=>{
 await predetermined(page,[6,3,1]);
 await page.goto("/");
 await press(page.getByRole("button",{name:"⚙ 게임 준비",exact:true}));
 await page.getByLabel("플레이어 수",{exact:true}).selectOption("3");
 await page.getByLabel("플레이 방식",{exact:true}).selectOption("computer");
 await press(page.getByRole("button",{name:"새 연습 시작",exact:true}));
 const dialog=starter(page);
 await expect(rollButton(dialog,2)).toBeDisabled();
 await expect(rollButton(dialog,3)).toBeDisabled();
 await expect(dialog.getByText("눈 6",{exact:true})).toBeVisible();
 await expect(dialog.getByText("눈 3",{exact:true})).toBeVisible();
 await press(rollButton(dialog,1));
 await expect(dialog.locator("[data-starter-winner]")).toHaveAttribute("data-starter-seat","1");
 await press(dialog.getByRole("button",{name:"게임 시작",exact:true}));
 await expect.poll(async()=>(await game(page)).config.startingPlayerId).toBe("seat-2");
 expect((await game(page)).players.map(p=>p.workers)).toEqual([3,1,2]);
});

test("starter manual mode preserves direct selection of a non-first seat",async({page})=>{
 await page.goto("/");
 await press(page.getByRole("button",{name:"⚙ 게임 준비",exact:true}));
 await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");
 await page.getByLabel("시작 플레이어",{exact:true}).selectOption("1");
 await press(page.getByRole("button",{name:"새 연습 시작",exact:true}));
 await expect.poll(async()=>(await game(page)).config.startingPlayerId).toBe("seat-2");
 await expect(starter(page)).toHaveCount(0);
});

test("online starter dice use each authenticated seat and persist through reconnect",async({page,browser,baseURL})=>{
 const isolated=await isolatedRooms();
 const peer=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{
  const proxy=async(route:Route)=>{
   const req=route.request(),res=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});
   await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
  };
  for(const context of [page.context(),peer]){
   await context.route("**/api/rooms{,/**}",proxy);
   await context.routeWebSocket("**/api/rooms/*/live",socket=>socket.close());
  }
  const guest=await peer.newPage();
  await page.goto("/online");
  await expect(page.getByLabel("시작 플레이어 결정 방식")).toHaveValue("roll");
  await press(page.getByRole("button",{name:"2인 방 만들기",exact:true}));
  const link=await page.getByLabel("초대 링크",{exact:true}).inputValue();
  await guest.goto(link);
  await press(guest.getByRole("button",{name:"방 참가",exact:true}));
  await expect(page.getByRole("region",{name:"게임 시작 준비"})).toContainText("2/2명");
  await press(page.getByRole("button",{name:"준비 완료",exact:true}));
  await expect(page.getByRole("button",{name:"준비 취소",exact:true})).toBeVisible();
  await waitOnlineFresh(guest);
  await press(guest.getByRole("button",{name:"준비 완료",exact:true}));
  const hostPopup=starter(page),guestPopup=starter(guest);
  const submit=async(p:Page,i:number)=>{
   const saved=p.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith("/actions")&&r.request().postDataJSON()?.action?.command==="roll-starter");
   await press(rollButton(starter(p),i));
   expect((await saved).status()).toBe(200);
  };
  await expect(hostPopup).toBeVisible();
  await expect(rollButton(hostPopup,2)).toBeDisabled();
  await expect(rollButton(guestPopup,1)).toBeDisabled();
  await submit(page,1);
  await expect(hostPopup.getByText(/^눈 [1-6]$/)).toHaveCount(1);
  await guest.reload();
  await expect(guestPopup.getByText(/^눈 [1-6]$/)).toHaveCount(1);
  await submit(guest,2);
  const start=hostPopup.getByRole("button",{name:"게임 시작",exact:true});
  for(let i=0;i<20;i++){
   await waitOnlineFresh(page);
   if(await start.isEnabled())break;
   await expect(hostPopup.getByText(/최고 눈이 같아/)).toBeVisible();
   await submit(page,1);
   await waitOnlineFresh(guest);
   await submit(guest,2);
  }
  const won=await hostPopup.locator("[data-starter-winner]").getAttribute("data-starter-seat");
  await press(start);
  await expect(hostPopup).toHaveCount(0);
  await expect(guestPopup).toHaveCount(0);
  const winningPage=won==="0"?page:guest;
  await expect(winningPage.locator('[data-can-start="true"]').first()).toBeVisible();
 }finally{await peer.close();await isolated.close();}
});
