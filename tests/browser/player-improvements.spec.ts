import {startOnlineLobby} from "./starting-castles";
import {test,expect,type Page} from "@playwright/test";
import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction} from "../../src/game/core";
import {directActions} from "../../src/game/direct-actions";
import {serializeSavedGame} from "../../src/game/save";
import type {GameState,GameAction} from "../../src/game/types";
const step=(g:GameState,a:GameAction)=>{const r=applyCoreAction(g,a);if(!r.ok)throw Error(JSON.stringify(r));return r.value.state;};
let loadSerial=0;
async function load(page:Page,game:GameState){const key=`improvements-loaded:${loadSerial++}`;await page.addInitScript(({saved,key})=>{if(!sessionStorage.getItem(key)){localStorage.setItem("burgundy-expanded:local-v1",saved);sessionStorage.setItem(key,"1");}},{key,saved:serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}})});await page.goto("/");await expect(page.locator("[data-game-revision]")).toHaveAttribute("data-game-revision",String(game.revision));}
function innFixture(){let g=createPracticeSession({names:["여관검사A","여관검사B"],seed:"inn-context",inns:true,officialSlots:true});g=step(g,{type:"roll-round",playerId:"seat-1"});g={...g,players:g.players.map(p=>({...p,silver:10,workers:30}))};const buy=directActions(g,"seat-1").find(a=>a.type==="buy-black-tile"&&g.tiles[a.tileId].type==="inn")!;g=step(g,buy);const put=directActions(g,"seat-1").find(a=>a.type==="use-die"&&a.intent.kind==="place-tile"&&g.tiles[a.intent.tileId].type==="inn")!;if(put.type!=="use-die"||put.intent.kind!=="place-tile")throw Error("fixture");return {g:step(g,put),cellId:put.intent.cellId};}
test("placed inn popup uses actual terrain, keeping generic art and default help",async({page},info)=>{
 const {g,cellId}=innFixture();await load(page,g);const cell=page.locator(`[data-estate-cell="${cellId}"][data-tile-help="inn"]`).first(),terrain=g.players[0].duchy.cells.find(c=>c.id===cellId)!.terrain;
 const name=({castle:"성",building:"건물",mine:"광산",ship:"선박",livestock:"동물",monastery:"수도원"})[terrain];
 if(info.project.use.hasTouch){await cell.evaluate(e=>e.scrollIntoView({block:"center",behavior:"instant"}));const b=(await cell.boundingBox())!,cdp=await page.context().newCDPSession(page);await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await cdp.detach();}else await cell.hover();const popup=page.locator("#tile-effect-tooltip");await expect(popup).toContainText(`현재 ${name} 타일로 적용 중`);await expect(popup.locator('[data-inn-art]')).toHaveCount(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(g);await page.screenshot({path:`.local-data/player-improvements/${info.project.name}-inn-context.png`});
});

import {boundary,setup,mount} from "../fixtures/shields";
test("final settlement rows sum to engine totals with recorded earned and final additions",async({page},info)=>{
 let g=boundary(createPracticeSession({names:["정산A","정산B"],seed:"settlement"}));g={...g,turn:{...g.turn,phase:"E"},players:g.players.map((p,i)=>({...p,victoryPoints:17+i})),scoreLedger:Object.fromEntries(g.players.map((p,i)=>[p.id,[{id:`TEST-FIXTURE:${p.id}`,category:"building" as const,points:17+i,source:{document:"project-user-rule" as const,pages:[],section:"TEST FIXTURE · earned building points"}}]]))};g={...g,market:{...g.market,phaseGoods:{A:[],B:[],C:[],D:[],E:[]},numberedDepots:g.market.numberedDepots.map((d,i)=>i?d:{...d,goods:[...d.goods,...Object.values(g.market.phaseGoods).flat()]})}};g=step(g,{type:"advance-phase",playerId:"seat-1"});await load(page,g);
 for(const score of g.finalScores!){const table=page.locator(`[data-score-player="${score.playerId}"]`);await expect(table.locator("[data-score-total]")).toHaveAttribute("data-score-total",String(score.total));expect(await table.locator("[data-row-score]").evaluateAll(nodes=>nodes.reduce((n,e)=>n+Number(e.getAttribute("data-row-score")),0))).toBe(score.total);await expect(table).toContainText("건물 효과");}
 await page.locator(".score-settlement").screenshot({path:`.local-data/player-improvements/${info.project.name}-settlement.png`});
});

import {vineFixture} from "../fixtures/vineyards";
import {createShieldLayout,setShieldLayout} from "../../src/game/shields";
test("goods three slots use real layers without quantity badges; sales and six-type history persist",async({page},info)=>{
 for(const kinds of [0,1,2,3]){
  let g=setup();g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:Array.from({length:kinds},(_,k)=>({type:(k+1) as 1|2|3,tiles:Array.from({length:k+1},(_,n)=>({id:`TEST-GOODS:${k}:${n}`,type:(k+1) as 1|2|3}))})),soldGoods:[{id:"TEST-SOLD:a",type:6},{id:"TEST-SOLD:b",type:6}]})};await load(page,g);
  const storage=page.getByLabel("규칙A 상품 저장고",{exact:true});await expect(storage.locator("[data-goods-slot]")).toHaveCount(3);await expect(storage.locator("[data-goods-layer]")).toHaveCount(kinds*(kinds+1)/2);await expect(storage.locator("button>b,button>strong")).toHaveCount(0);
  if(kinds===3){await page.getByRole("button",{name:/^행동 주사위 1 눈/}).click();await storage.getByRole("button",{name:"규칙A 3번 상품 3개 판매",exact:true}).click();await expect(storage.locator("[data-goods-layer]")).toHaveCount(3);await page.reload();await expect(storage.locator("[data-goods-layer]")).toHaveCount(3);
   await page.getByRole("button",{name:"규칙A 상품 판매 내역 · 총 5개",exact:true}).click();const popup=page.getByRole("dialog",{name:"규칙A 상품 판매 내역",exact:true});await expect(popup.locator("[data-sold-type]")).toHaveCount(6);await expect(popup.locator('[data-sold-type="3"]')).toHaveText("3");await expect(popup.locator('[data-sold-type="6"]')).toHaveText("2");await expect(popup.locator('[data-sold-type="2"]')).toHaveText("0");await popup.locator("h3").click();await expect(popup).toBeVisible();await page.screenshot({path:`.local-data/player-improvements/${info.project.name}-goods-history.png`});await page.locator(".goods-history-backdrop").click({position:{x:3,y:3}});await expect(popup).toHaveCount(0);
  }
 }
});
test("left reserve renders zero one two real vine tiles, selects and rotates with shared board",async({page},info)=>{
 for(const count of [0,1,2]){
  let g=vineFixture();const shields=createShieldLayout(2,g.random,true);g=mount(setShieldLayout({...g,random:shields.random,config:{...g.config,extensions:[...g.config.extensions,{id:"shields",options:{rules:true}}]}},shields.layout),4);
  if(count>0)g=step(g,directActions(g,"seat-1").find(a=>a.type==="use-die"&&a.intent.kind==="vineyard"&&a.intent.command==="take")!);
  if(count>1)g=step(g,directActions(g,"seat-1").find(a=>a.type==="extension"&&a.extensionId==="vineyards")!);
  await load(page,g);const storage=page.getByLabel("포도1 타일 보관함",{exact:true});await expect(storage.locator(".vine-keyspace")).toHaveCount(count);await expect(storage.locator('[data-vine-tile]:not([data-vine-tile="empty"])')).toHaveCount(count);await expect(storage).not.toContainText("포도 점유");
  if(count===2){await page.getByRole("button",{name:/^행동 주사위 2 눈/}).click();await storage.locator(".vine-keyspace").first().click();const board=page.getByRole("region",{name:"포도1 포도밭",exact:true});await board.getByRole("button",{name:"돌려서 배치",exact:true}).click();await board.locator('[data-vine-slot][aria-disabled="false"]').first().click();await expect(storage.locator(".vine-keyspace")).toHaveCount(1);expect((await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).vineyards.players['seat-1'].placed[0].flipped).toBe(true);await storage.screenshot({path:`.local-data/player-improvements/${info.project.name}-vine-storage.png`});}
 }
});

const placedStarts=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.players.reduce((n:number,p:{duchy:{cells:{tileId:string|null}[]}})=>n+p.duchy.cells.filter(c=>c.tileId).length,0));
async function pickStart(page:Page){const before=await placedStarts(page);await page.locator('[data-can-start="true"]').first().click();await expect.poll(()=>placedStarts(page)).toBe(before+1);}
test("new games select starting castles on each real board, preserve partial setup and hide developer controls",async({page},info)=>{
 for(const count of [2,3,4]){
  await page.goto("/");await page.getByRole("button",{name:/게임 준비/}).click();await expect(page.getByRole("combobox",{name:/시작 성/})).toHaveCount(0);await expect(page.getByLabel("방패 UI 검증 모드",{exact:false})).not.toBeVisible();await page.getByRole("combobox",{name:"플레이어 수",exact:true}).selectOption(String(count));await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();await expect(page.locator('[data-game-revision]')).toHaveAttribute("data-game-revision","0");await expect(page.getByRole("button",{name:/^행동 주사위 1 눈/})).toBeDisabled();
  await expect.poll(()=>placedStarts(page)).toBe(0);await pickStart(page);await page.reload();expect((await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).status).toBe("setup");
  for(let i=1;i<count;i++)await pickStart(page);await expect(page.locator('[data-can-start="true"]')).toHaveCount(0);const g=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);expect(g.players.every((p:{duchy:{cells:{tileId:string|null}[]}})=>p.duchy.cells.filter(c=>c.tileId).length===1)).toBe(true);expect(g.players.every((p:{victoryPoints:number})=>p.victoryPoints===0)).toBe(true);
  await page.screenshot({path:`.local-data/player-improvements/${info.project.name}-starting-${count}p.png`});
 }
});

import {isolatedRooms} from "./isolated-rooms";
test("online each owner picks only their own starting castle, guest can go first, reconnect retains setup",async({page,browser},info)=>{
 const isolated=await isolatedRooms(),guestContext=await browser.newContext({viewport:info.project.use.viewport});const guest=await guestContext.newPage();
 const route=async(r:import("@playwright/test").Route)=>{const q=r.request(),response=await fetch(isolated.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:q.postData()??undefined});await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});};await page.route("**/api/rooms{,/**}",route);await guest.route("**/api/rooms{,/**}",route);
 try{await page.goto("/online");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();const code=await page.getByLabel("공유할 방 코드").inputValue();await guest.goto("/online");await guest.getByLabel("방 코드",{exact:true}).fill(code);await guest.getByRole("button",{name:"방 참가",exact:true}).click();
  await startOnlineLobby(page,guest);await expect(guest.locator('[data-can-start="true"]').first()).toBeVisible();await expect(guest.locator('.online-estates>.estate-panel').first().locator('[data-can-start="true"]')).toHaveCount(0);await expect(page.getByRole("button",{name:"온라인 주사위 1",exact:true})).toBeDisabled();
  await guest.locator('[data-can-start="true"]').first().click();await expect(guest.locator('[data-can-start="true"]')).toHaveCount(0);await guest.reload();await expect(guest.locator('[data-estate-tile]')).toHaveCount(1);await page.locator('[data-can-start="true"]').first().click();await expect(page.locator('[data-can-start="true"]')).toHaveCount(0);await expect(guest.locator('[data-estate-tile]')).toHaveCount(2);await page.screenshot({path:`.local-data/player-improvements/${info.project.name}-online-starting.png`});
 }finally{await guestContext.close();await isolated.close();}
});
test("AI opponents pick their own legal starts after the human chooses",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:/게임 준비/}).click();await page.getByRole("combobox",{name:"플레이어 수",exact:true}).selectOption("4");await page.getByRole("combobox",{name:"플레이 방식",exact:true}).selectOption("computer");await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();await expect.poll(()=>placedStarts(page)).toBe(0);await pickStart(page);await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.status)).toBe("playing");expect(await placedStarts(page)).toBe(4);
});
