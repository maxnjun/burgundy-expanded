import {test,expect,type Page} from "@playwright/test";
import {createPracticeSession} from "../../src/game/practice";
import {serializeSavedGame} from "../../src/game/save";
import {directActions} from "../../src/game/direct-actions";
import {prepareTileEffect} from "../../src/game/core/effects";
import {setup,placed} from "../fixtures/shields";
import type {GameState,ActionIntent} from "../../src/game/types";

const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game as GameState);
const prompt=(page:Page)=>page.getByRole("alertdialog",{name:"턴 종료 확인",exact:true});
async function load(page:Page,game:GameState){
 await page.clock.install();await page.addInitScript(value=>localStorage.setItem("burgundy-expanded:local-v1",value),serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.goto("/");
 await expect.poll(async()=>(await current(page)).turn.stage).toBe("player-turn");
}
function initial(count=2,silver=30){const g=createPracticeSession({names:["턴A","턴B","턴C","턴D"].slice(0,count),seed:"manual-turn",officialSlots:true,fullEffects:true,inns:true,vineyards:true,tradeRoutes:true,shieldRules:true,whiteCastles:true,boardIds:Array(count).fill("se:base:2")});return {...g,players:g.players.map(p=>({...p,silver,workers:30}))};}
async function workers(page:Page,i:number){await page.getByRole("button",{name:new RegExp(`^행동 주사위 ${i} 눈`)}).click();await page.getByRole("button",{name:"일꾼 자원",exact:true}).click();}
async function cancel(page:Page){await expect(prompt(page)).toBeVisible();await prompt(page).getByRole("button",{name:"취소",exact:true}).click();await expect(prompt(page)).not.toBeVisible();}

for(const count of [2,3,4])test(`human ${count}p both dice wait for confirmation, cancel keeps undo, purchases and explicit end`,async({page})=>{
 await load(page,initial(count));const baseline=await current(page),controls=page.getByLabel("차례 제어",{exact:true});
 await workers(page,1);const one=await current(page);await page.clock.runFor(1200);expect(await current(page)).toEqual(one);await expect(prompt(page)).not.toBeVisible();
 await workers(page,2);await expect(prompt(page)).toBeVisible();const two=await current(page);expect(two.turn.activePlayerId).toBe("seat-1");expect(two.dice.players["seat-1"].every(d=>d.used)).toBe(true);expect(directActions(two,"seat-1").some(a=>a.type==="buy-black-tile")).toBe(true);await expect(prompt(page)).toContainText("턴을 종료하시겠습니까? (은화 구매 가능)");
 await page.screenshot({path:`.local-data/manual-turn/confirm-${count}p.png`});await cancel(page);await page.clock.runFor(2400);expect(await current(page)).toEqual(two);await expect(prompt(page)).not.toBeVisible();
 await controls.getByRole("button",{name:"이전 행동으로",exact:true}).click();await expect.poll(()=>current(page)).toEqual(one);
 await workers(page,2);await cancel(page);page.once("dialog",d=>d.accept());await controls.getByRole("button",{name:"되돌리기",exact:true}).click();await expect.poll(()=>current(page)).toEqual(baseline);
 await workers(page,1);await workers(page,2);await cancel(page);
 await page.locator('[data-black-depot] .supply-art-tile[aria-disabled="false"]').first().click();await expect(prompt(page)).toBeVisible();const bought=await current(page);expect(bought.turn.blackPurchaseUsed).toBe(true);expect(bought.players[0].silver).toBe(28);await expect(prompt(page).locator("p")).toHaveText("턴을 종료하시겠습니까?");await cancel(page);
 if(count===2){await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();await controls.getByRole("button",{name:"턴 종료",exact:true}).click();await cancel(page);await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();}
 await controls.getByRole("button",{name:"턴 종료",exact:true}).click();await expect(prompt(page)).toBeVisible();
 await prompt(page).getByRole("button",{name:"턴 종료",exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
 await expect.poll(async()=>(await current(page)).turn.activePlayerId).toBe("seat-2");expect((await current(page)).revision).toBe(bought.revision+1);await expect(controls.getByRole("button",{name:"이전 행동으로",exact:true})).toBeDisabled();await page.clock.runFor(1500);expect((await current(page)).turn.activePlayerId).toBe("seat-2");
});

test("insufficient silver offers no purchase hint and reload keeps the completed human turn",async({page})=>{
 await load(page,initial(2,1));await workers(page,1);await workers(page,2);await expect(prompt(page).locator("p")).toHaveText("턴을 종료하시겠습니까?");await cancel(page);const before=await current(page);
 // Preserve this checkpoint on reload rather than the fixture's initial state.
 await page.evaluate(()=>sessionStorage.setItem("manual-checkpoint",localStorage.getItem("burgundy-expanded:local-v1")!));await page.addInitScript(()=>{const s=sessionStorage.getItem("manual-checkpoint");if(s)localStorage.setItem("burgundy-expanded:local-v1",s);});await page.reload();await expect(prompt(page)).toBeVisible();expect(await current(page)).toEqual(before);await cancel(page);await page.clock.runFor(1200);await expect(prompt(page)).not.toBeVisible();expect(await current(page)).toEqual(before);
});

test("mandatory castle choice finishes before the end confirmation",async({page})=>{
 let game=placed(setup(),0,{type:"castle",back:"matching-color"});game={...game,dice:{...game.dice,players:{...game.dice.players,"seat-1":[{...game.dice.players["seat-1"][0],used:true},{...game.dice.players["seat-1"][1],used:true}]}}};
 const tileId=game.players[0].duchy.cells.filter(c=>c.tileId&&game.tiles[c.tileId].type==="castle").at(-1)!.tileId!;game=prepareTileEffect(game,"seat-1",tileId);const choice=game.turn.pendingChoice!;expect(choice).toBeTruthy();const option=choice.options.find(o=>(o.payload as {intent?:ActionIntent})?.intent?.kind==="take-workers")!;expect(option).toBeTruthy();
 await load(page,game);await expect(page.getByLabel("타일 효과 선택",{exact:true})).toBeVisible();await page.clock.runFor(1000);await expect(prompt(page)).not.toBeVisible();expect((await current(page)).turn.activePlayerId).toBe("seat-1");
 await page.getByLabel("타일 효과 선택",{exact:true}).getByRole("button",{name:option.label,exact:true}).click();await expect(prompt(page)).toBeVisible();expect((await current(page)).turn.pendingChoice).toBeNull();expect((await current(page)).turn.activePlayerId).toBe("seat-1");await page.screenshot({path:".local-data/manual-turn/mandatory-resolved.png"});
});
