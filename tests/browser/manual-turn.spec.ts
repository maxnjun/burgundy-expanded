import {test,expect,type Page} from "@playwright/test";
import {createPracticeSession} from "../../src/game/practice";
import {serializeSavedGame} from "../../src/game/save";
import {directActions} from "../../src/game/direct-actions";
import {prepareTileEffect} from "../../src/game/core/effects";
import {setup,placed} from "../fixtures/shields";
import type {GameState,ActionIntent} from "../../src/game/types";

const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game as GameState);
const guidance=(page:Page)=>page.getByLabel("현재 행동 안내",{exact:true});
const prompt=(page:Page)=>page.getByRole("alertdialog",{name:"턴 종료 확인",exact:true});
async function load(page:Page,game:GameState){
 await page.clock.install();await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.goto("/");
 await expect.poll(async()=>(await current(page)).turn.stage).toBe("player-turn");
}
function initial(count=2,silver=30){const g=createPracticeSession({names:["턴A","턴B","턴C","턴D"].slice(0,count),seed:"manual-turn",officialSlots:true,fullEffects:true,inns:true,vineyards:true,tradeRoutes:true,shieldRules:true,whiteCastles:true,boardIds:Array(count).fill("se:base:2")});return {...g,players:g.players.map(p=>({...p,silver,workers:30}))};}
async function workers(page:Page,i:number){await page.getByRole("button",{name:new RegExp(`^행동 주사위 ${i} 눈`)}).click();await page.getByRole("button",{name:"일꾼 자원",exact:true}).click();}

for(const count of [2,3,4])test(`human ${count}p immediate undo/end, no automatic end or dialogs, exact reload and player boundaries`,async({page})=>{
 const dialogs:string[]=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 await load(page,initial(count));const baseline=await current(page),controls=page.getByLabel("차례 제어",{exact:true});
 await expect(guidance(page)).toHaveText('주사위를 선택하세요.');await expect(page.locator('.direct-selection')).toHaveCount(0);await expect(page.getByText('주사위 선택 후 대상을 누르세요',{exact:false})).toHaveCount(0);await expect(page.getByText('특수 행동',{exact:true})).toHaveCount(0);await expect(page.getByLabel('추가 행동',{exact:true})).toBeVisible();
 await workers(page,1);const one=await current(page);await page.clock.runFor(1200);expect(await current(page)).toEqual(one);await expect(prompt(page)).toHaveCount(0);await expect(controls.getByRole('button',{name:'되돌리기',exact:true})).toBeEnabled();
 await page.reload();await expect.poll(()=>current(page)).toEqual(one);await expect(controls.getByRole('button',{name:'되돌리기',exact:true})).toBeEnabled();
 await workers(page,2);const two=await current(page);expect(two.turn.activePlayerId).toBe("seat-1");expect(two.dice.players["seat-1"].every(d=>d.used)).toBe(true);expect(directActions(two,"seat-1").some(a=>a.type==="buy-black-tile")).toBe(true);await expect(guidance(page)).toHaveText("턴을 종료하시겠습니까? (구매 가능)");
 await page.clock.runFor(2400);expect(await current(page)).toEqual(two);await expect(prompt(page)).toHaveCount(0);
 await page.screenshot({path:`.local-data/action-guidance/${test.info().project.name}-${count}p-game.png`});await page.locator('.direct-toolbar').screenshot({path:`.local-data/action-guidance/${test.info().project.name}-${count}p-toolbar.png`});
 await controls.getByRole("button",{name:"이전 행동으로",exact:true}).click();await expect.poll(()=>current(page)).toEqual(one);
 await workers(page,2);await controls.getByRole("button",{name:"되돌리기",exact:true}).click();await expect.poll(()=>current(page)).toEqual(baseline);
 await workers(page,1);await workers(page,2);
 await page.locator('[data-black-depot] .supply-art-tile[aria-disabled="false"]').first().click();const bought=await current(page);expect(bought.turn.blackPurchaseUsed).toBe(true);expect(bought.players[0].silver).toBe(28);await expect(guidance(page)).toHaveText("턴을 종료하시겠습니까?");await expect(prompt(page)).toHaveCount(0);
 await controls.getByRole("button",{name:"턴 종료",exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
 await expect.poll(async()=>(await current(page)).turn.activePlayerId).toBe("seat-2");expect((await current(page)).revision).toBe(bought.revision+1);await expect(controls.getByRole("button",{name:"이전 행동으로",exact:true})).toBeDisabled();await page.clock.runFor(1500);expect((await current(page)).turn.activePlayerId).toBe("seat-2");
 const second=await current(page);await workers(page,1);await expect(controls.getByRole('button',{name:'되돌리기',exact:true})).toBeEnabled();await controls.getByRole('button',{name:'되돌리기',exact:true}).click();await expect.poll(()=>current(page)).toEqual(second);expect(dialogs).toEqual([]);
});

test("insufficient silver: no purchase hint; reload preserves completed turn and full undo",async({page})=>{
 await load(page,initial(2,1));const baseline=await current(page);await workers(page,1);await workers(page,2);await expect(guidance(page)).toHaveText("턴을 종료하시겠습니까?");const before=await current(page);
 await page.reload();await expect.poll(()=>current(page)).toEqual(before);await expect(prompt(page)).toHaveCount(0);await page.clock.runFor(1200);expect(await current(page)).toEqual(before);
 await page.getByLabel('차례 제어',{exact:true}).getByRole('button',{name:'되돌리기',exact:true}).click();await expect.poll(()=>current(page)).toEqual(baseline);await expect(guidance(page)).toHaveText('주사위를 선택하세요.');
});

test("mandatory castle choice overrides completed dice until resolved",async({page})=>{
 let game=placed(setup(),0,{type:"castle",back:"matching-color"});game={...game,dice:{...game.dice,players:{...game.dice.players,"seat-1":[{...game.dice.players["seat-1"][0],used:true},{...game.dice.players["seat-1"][1],used:true}]}}};
 const tileId=game.players[0].duchy.cells.filter(c=>c.tileId&&game.tiles[c.tileId].type==="castle").at(-1)!.tileId!;game=prepareTileEffect(game,"seat-1",tileId);const choice=game.turn.pendingChoice!;expect(choice).toBeTruthy();const option=choice.options.find(o=>(o.payload as {intent?:ActionIntent})?.intent?.kind==="take-workers")!;expect(option).toBeTruthy();
 await load(page,game);await expect(page.getByLabel("타일 효과 선택",{exact:true})).toBeVisible();await page.clock.runFor(1000);await expect(guidance(page)).toHaveText('성의 추가 행동을 선택하세요.');await expect(page.getByRole('button',{name:'턴 종료',exact:true})).toBeDisabled();expect((await current(page)).turn.activePlayerId).toBe("seat-1");
 await page.getByLabel("타일 효과 선택",{exact:true}).getByRole("button",{name:option.label,exact:true}).click();await expect(guidance(page)).toContainText('턴을 종료하시겠습니까?');await expect(prompt(page)).toHaveCount(0);expect((await current(page)).turn.pendingChoice).toBeNull();expect((await current(page)).turn.activePlayerId).toBe("seat-1");await page.screenshot({path:`.local-data/action-guidance/${test.info().project.name}-mandatory-resolved.png`});
});

test('central guidance remains readable at PC 100/160/200 and mobile widths',async({page})=>{
 await load(page,initial());await workers(page,1);await workers(page,2);
 for(const width of [1280,390,375])for(const zoom of [100,160,200]){
  await page.setViewportSize({width,height:900});await page.getByLabel('전체 배율',{exact:true}).evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},zoom);
  await expect.poll(async()=>Number(await page.getByLabel('전체 배율',{exact:true}).inputValue())).toBe(zoom);
  const sizes=await page.locator('.direct-toolbar').evaluate(el=>{const g=el.querySelector('.action-guidance')!.getBoundingClientRect(),b=el.getBoundingClientRect(),r=[...el.querySelectorAll('.turn-controls button')].map(x=>x.getBoundingClientRect());return {center:Math.abs((g.left+g.right-b.left-b.right)/2),inside:g.left>=b.left&&g.right<=b.right&&g.height>0,noOverlap:r.every(x=>x.bottom<=g.top||x.top>=g.bottom||x.right<=g.left||x.left>=g.right),buttons:r.every((x,i)=>x.width>0&&(!i||x.left>=r[i-1].right))};});
  expect(sizes.inside).toBe(true);expect(sizes.center).toBeLessThan(2);expect(sizes.noOverlap).toBe(true);expect(sizes.buttons).toBe(true);await expect(guidance(page)).toHaveText('턴을 종료하시겠습니까? (구매 가능)');await page.locator('.direct-toolbar').screenshot({path:`.local-data/action-guidance/${test.info().project.name}-toolbar-${width}-${zoom}.png`});
 }
});
