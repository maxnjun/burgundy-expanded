import {test,expect,type Page,type Locator,type TestInfo,type CDPSession} from "@playwright/test";
import {setup,placed,mount,stash} from "../fixtures/shields";
import {serializeSavedGame} from "../../src/game/save";
import {getTileHelp} from "../../src/game/tile-help";
import {validateCoreState} from "../../src/game/core/state";
import {prepareTileEffect} from "../../src/game/core/effects";
import {isolatedRooms} from "./isolated-rooms";

const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);
function fixture(count=2){
 let g=placed(mount(setup(count),16),0,getTileHelp("monastery",13)!.tile!);
 g=stash(g,getTileHelp("monastery",14)!.tile!).g;
 const slot=g.market.numberedDepots.flatMap(d=>d.slots).find(s=>s.requiredType==="monastery")!;
 g={...g,tiles:{...g.tiles,"help-supply":{id:"help-supply",type:"monastery",number:13,back:"matching-color"}},market:{...g.market,removedTileIds:[...g.market.removedTileIds,...(slot.tileId?[slot.tileId]:[])],numberedDepots:g.market.numberedDepots.map(d=>({...d,slots:d.slots.map(s=>s.id===slot.id?{...s,tileId:"help-supply"}:s)}))}};
 expect(validateCoreState(g).valid).toBe(true);return g;
}
async function load(page:Page,count=2,ai=false,g=fixture(count)){
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));
 await page.addInitScript(saved=>localStorage.setItem("burgundy-expanded:local-v1",saved),serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:g,logs:["TEST FIXTURE · read-only tile explanation"],view:{zoom:1,focus:false,table:true,boardZooms:{},computerPlayerIds:ai?[g.players[1].id]:[],computerPaused:ai}}));
 await page.goto("/");await expect(page.locator('[data-tile-id="help-supply"]')).toBeVisible();return g;
}
const artifact=(info:TestInfo,name:string)=>`.local-data/tile-help/${info.project.name}-${name}.png`;
async function fits(page:Page,popup:Locator){const b=(await popup.boundingBox())!,v=page.viewportSize()!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(v.width+.5);expect(b.y+b.height).toBeLessThanOrEqual(v.height+.5);}
async function touchStart(page:Page,cdp:CDPSession,source:Locator){await source.scrollIntoViewIfNeeded();const b=(await source.boundingBox())!;const p={x:b.x+b.width/2,y:b.y+b.height/2,id:1};await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});return p;}
async function touchEnd(cdp:CDPSession){await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}

test("bottom encyclopedia contains monastery29 shield18 and independent category/detail toggles",async({page},info)=>{
 const g=await load(page,3,true),panel=page.locator(".tile-encyclopedia");await panel.scrollIntoViewIfNeeded();
 await expect(panel).toHaveAttribute("open","");await expect(panel.getByRole("button",{name:"방패 카테고리",exact:true}).locator("svg text")).toHaveText("?");
 for(const [kind,label,total] of [["monastery","수도원",29],["shield","방패",18]] as const){
  await panel.getByRole("button",{name:`${label} 카테고리`,exact:true}).click();const entries=panel.locator("[data-help-entry]");await expect(entries).toHaveCount(total);
  expect(await entries.evaluateAll(els=>els.map(e=>e.getAttribute("data-help-entry")))).toEqual(Array.from({length:total},(_,i)=>`${kind}:${i+1}`));
  for(let n=1;n<=total;n++){
   const button=panel.locator(`[data-help-entry="${kind}:${n}"]`);await button.click();const content=panel.locator(".tile-help-selected");await expect(content.locator("h3")).toHaveText(getTileHelp(kind,n)!.name);await expect(content.locator(".tile-help-summary")).toHaveText(getTileHelp(kind,n)!.summary);
   if(kind==="monastery")await expect(button.locator("image")).toHaveAttribute("data-approved-monastery",String(n));
  }
  await entries.last().click();await expect(panel.locator(".tile-help-selected")).toHaveCount(0);
 }
 await panel.getByRole("button",{name:"건물 카테고리",exact:true}).click();await expect(panel.locator("[data-help-entry]")).toHaveCount(10);await panel.locator('[data-help-entry="building:warehouse"]').click();await expect(panel.locator(".tile-help-selected")).toContainText("전량 판매");
 for(const [label,id] of [["성","castle"],["광산","mine"],["선박","ship"],["여관","inn"],["포도밭","vineyard"],["무역로","trade-route"]]){
  await panel.getByRole("button",{name:`${label} 카테고리`,exact:true}).click();await expect(panel.locator(".tile-help-list")).toHaveCount(0);await expect(panel.locator(".tile-help-selected [data-help-content]")).toHaveAttribute("data-help-content",id);
 }
 await panel.getByRole("button",{name:"가축 카테고리",exact:true}).click();await expect(panel.locator("[data-help-entry]")).toHaveCount(13);await expect(panel.locator(".tile-help-selected")).toHaveCount(0);
 await panel.getByRole("button",{name:"수도원 카테고리",exact:true}).click();await expect(panel.locator(".tile-help-selected")).toHaveCount(0);await panel.locator('[data-help-entry="monastery:13"]').click();
 await panel.screenshot({path:artifact(info,"encyclopedia-monastery")});await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);
 await panel.locator(":scope > summary").click();expect(await panel.evaluate(e=>(e as HTMLDetailsElement).open)).toBe(false);await panel.locator(":scope > summary").click();
 expect(await state(page)).toEqual(g);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("PC hover is immediate non-intercepting, shares content, switches and fits 100 160 200 percent",async({page},info)=>{
 test.skip(!!info.project.use.hasTouch,"Mouse path is checked in PC project");const g=await load(page),source=page.locator('[data-tile-id="help-supply"]'),popup=page.getByRole("tooltip");
 await source.hover();await expect(popup.locator(".tile-help-summary")).toHaveText(getTileHelp("monastery",13)!.summary);await expect(popup).toHaveCSS("pointer-events","none");await fits(page,popup);
 await page.screenshot({path:artifact(info,"supply-hover")});await page.mouse.move(0,0);await expect(popup).toHaveCount(0);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true}),monk=board.locator('[data-estate-cell][data-tile-help="monastery:13"]');
 let zoom=100;for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await monk.hover();await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","monastery:13");await fits(page,popup);await page.screenshot({path:artifact(info,`estate-hover-${target}`)});}
 const mounted=board.locator('[data-estate-cell][data-tile-help="shield:16"]');await mounted.hover();await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","shield:16");await fits(page,popup);
 const stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await stored.hover();await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","monastery:14");
 await page.mouse.move(0,0);await expect(popup).toHaveCount(0);expect(await state(page)).toEqual(g);
 await page.getByRole("button",{name:/^행동 주사위 1 눈/}).click();await source.click();await expect.poll(async()=>(await state(page)).revision).toBe(g.revision+1);
 expect((await state(page)).players[0].storage).toContain("help-supply");
});

test("keyboard description cleans ARIA and route navigation removes the active popup",async({page},info)=>{
 test.skip(!!info.project.use.hasTouch,"Keyboard focus path is checked in PC project");const g=await load(page),stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await stored.scrollIntoViewIfNeeded();await page.keyboard.press("Tab");await stored.focus();
 await expect(page.getByRole("tooltip")).toBeVisible();await expect(stored).toHaveAttribute("aria-describedby","tile-effect-tooltip");await page.keyboard.press("Escape");await expect(page.getByRole("tooltip")).toHaveCount(0);await expect(stored).not.toHaveAttribute("aria-describedby","tile-effect-tooltip");
 expect(await state(page)).toEqual(g);await stored.hover();await expect(page.getByRole("tooltip")).toBeVisible();await page.getByRole("link",{name:"2인 온라인 방",exact:true}).click();await expect(page).toHaveURL(/\/online$/);await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);
});

test("mobile single tap without a die opens read-only help, switches tiles, preserves inside scroll and closes outside",async({page},info)=>{
 test.skip(!info.project.use.hasTouch,"Native touch path is checked in mobile projects");const g=await load(page),cdp=await page.context().newCDPSession(page),source=page.locator('[data-tile-id="help-supply"]'),popup=page.getByRole("dialog",{name:"타일 효과 설명",exact:true});
 await touchStart(page,cdp,source);await touchEnd(cdp);await expect(popup).toBeVisible();await fits(page,popup);expect(await state(page)).toEqual(g);
 await popup.getByRole("heading").tap();await expect(popup).toBeVisible();await page.screenshot({path:artifact(info,"tap-monastery")});
 await popup.getByRole("button",{name:"타일 설명 닫기",exact:true}).tap();await expect(popup).toHaveCount(0);
 const shield=page.locator('[data-estate-cell][data-tile-help="shield:16"]');await touchStart(page,cdp,shield);await touchEnd(cdp);await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","shield:16");await popup.locator("summary").tap();await expect(popup).toBeVisible();await popup.evaluate(e=>e.scrollTop=100);await expect(popup).toBeVisible();await fits(page,popup);await page.screenshot({path:artifact(info,"tap-shield")});
 const stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await stored.tap();await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","monastery:14");await expect(stored).not.toHaveClass(/selected/);
 await popup.getByRole("button",{name:"타일 설명 닫기",exact:true}).tap();const monk=page.locator('[data-estate-cell][data-tile-help="monastery:13"]');await touchStart(page,cdp,monk);await touchEnd(cdp);await expect(popup.locator("[data-help-content]")).toHaveAttribute("data-help-content","monastery:13");
 await page.locator(".topbar h1,.brand").first().tap();await expect(popup).toHaveCount(0);expect(await state(page)).toEqual(g);await cdp.detach();
});

test("mobile selected die retains acquisition; movement, multi-touch and board pan never open help",async({page},info)=>{
 test.skip(!info.project.use.hasTouch,"Native touch path is checked in mobile projects");const g=await load(page,4),cdp=await page.context().newCDPSession(page),source=page.locator('[data-tile-id="help-supply"]');
 const p=await touchStart(page,cdp,source);await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...p,y:p.y+35}]});await touchEnd(cdp);await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);expect(await state(page)).toEqual(g);
 const q=await touchStart(page,cdp,source);await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[q,{x:q.x+30,y:q.y,id:2}]});await touchEnd(cdp);await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);expect(await state(page)).toEqual(g);
 await page.getByRole("button",{name:"공용 보드 드래그 이동",exact:true}).click();await touchStart(page,cdp,source);await touchEnd(cdp);await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);expect(await state(page)).toEqual(g);await page.getByRole("button",{name:"공용 보드 드래그 이동",exact:true}).click();
 await page.getByRole("button",{name:/^행동 주사위 1 눈/}).tap();await touchStart(page,cdp,source);await touchEnd(cdp);await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);await expect.poll(async()=>(await state(page)).revision).toBe(g.revision+1);expect((await state(page)).players[0].storage).toContain("help-supply");
 await page.getByRole("button",{name:/^행동 주사위 2 눈/}).tap();await page.locator(".estate-keyspaces").first().getByRole("button").first().tap();const target=page.getByRole("group",{name:"규칙A 영지",exact:true}).locator("[data-estate-cell].direct-legal").first(),cell=await target.getAttribute("data-estate-cell");await target.tap();await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);await expect.poll(async()=>(await state(page)).revision).toBe(g.revision+2);const placed=await state(page);expect(placed.players[0].duchy.cells.find((c:{id:string})=>c.id===cell).tileId).toBe(g.players[0].storage[0]);expect(placed.turn.activePlayerId).toBe(g.turn.activePlayerId);await cdp.detach();
});

test("mobile mandatory castle action wins without selected dice; optional purchase remains accessible after both dice are used",async({page},info)=>{
 test.skip(!info.project.use.hasTouch,"Native touch path is checked in mobile projects");
 for(const count of [2,3,4]){
  const initial=fixture(count),castle=initial.players[0].duchy.cells.find(c=>c.tileId&&initial.tiles[c.tileId].type==="castle")!.tileId!;
  const g=prepareTileEffect(initial,initial.players[0].id,castle);expect(validateCoreState(g).valid).toBe(true);await load(page,count,false,g);
  await page.locator('[data-tile-id="help-supply"]').tap();await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);await expect.poll(async()=>(await state(page)).revision).toBe(g.revision+1);
  const after=await state(page);expect(after.players[0].storage).toContain("help-supply");expect(after.dice.players[g.players[0].id].every((d:{used:boolean})=>!d.used)).toBe(true);expect(after.turn.pendingChoice).toBeNull();
 }
 const initial=fixture(),g={...initial,dice:{...initial.dice,players:{...initial.dice.players,[initial.players[0].id]:[{...initial.dice.players[initial.players[0].id][0],used:true},{...initial.dice.players[initial.players[0].id][1],used:true}] as const}}};await load(page,2,false,g);
 const id=g.market.blackDepot.find(Boolean)!,black=page.locator(`[data-tile-id="${id}"]`);await black.tap();await expect(page.getByRole("dialog",{name:"타일 효과 설명",exact:true})).toBeVisible();expect(await state(page)).toEqual(g);await page.getByRole("button",{name:"타일 설명 닫기",exact:true}).tap();
 await page.getByLabel("추가 행동",{exact:true}).tap();await page.getByRole("checkbox",{name:"보드에서 은화 구매 선택",exact:true}).check();await black.tap();await expect(page.locator("#tile-effect-tooltip")).toHaveCount(0);await expect.poll(async()=>(await state(page)).revision).toBe(g.revision+1);const bought=await state(page);expect(bought.players[0].storage).toContain(id);expect(bought.players[0].silver).toBe(g.players[0].silver-2);
});

test("online reference and tile effects are UI-only with no action requests or revision changes",async({page},info)=>{
 const isolated=await isolatedRooms();
 await page.route("**/api/rooms{,/**}",async route=>{const req=route.request(),response=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
 try{
  await page.goto("/online");await page.getByRole("checkbox",{name:"방패 확장"}).check();await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();await expect(page.locator(".tile-encyclopedia")).toBeVisible();
  const before=await page.locator(".online-screen").getAttribute("data-game-revision");let actions=0;page.on("request",r=>{if(r.method()==="POST"&&/\/actions$/.test(new URL(r.url()).pathname))actions++;});
  const source=page.locator('[data-shield-slot][data-empty="false"]').first();await source.scrollIntoViewIfNeeded();
  if(info.project.use.hasTouch){await source.evaluate(e=>e.scrollIntoView({block:"center",behavior:"instant"}));const cdp=await page.context().newCDPSession(page);await touchStart(page,cdp,source);await touchEnd(cdp);await expect(page.getByRole("dialog",{name:"타일 효과 설명",exact:true})).toBeVisible();await cdp.detach();}else{await source.hover();await expect(page.getByRole("tooltip")).toBeVisible();}
  await page.screenshot({path:artifact(info,"online-tooltip")});await page.locator(".tile-encyclopedia").getByRole("button",{name:"방패 카테고리",exact:true}).click();await page.locator('[data-help-entry="shield:6"]').click();await expect(page.locator(".tile-help-selected")).toContainText(getTileHelp("shield",6)!.details);
  expect(actions).toBe(0);if(before!==null)await expect(page.locator('[data-game-revision]')).toHaveAttribute("data-game-revision",before);
 }finally{await isolated.close();}
});
