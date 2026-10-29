import {test,expect} from "@playwright/test";
import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction} from "../../src/game/core";
import {serializeSavedGame} from "../../src/game/save";
import {VINE_SLOTS} from "../../src/game/vineyards";
import {rewardDieOverlaps} from "./reward-geometry";

// Imported mid-turn fixture has action undo, but deliberately no earlier turn-start checkpoint.
test("white requirements, larger layered goods and trade rewards keep game state and board input",async({page},info)=>{
 let game=createPracticeSession({names:["가독성1","가독성2"],seed:"dice-readability",boardIds:["se:base:2","se:base:2"],vineyards:true,tradeRoutes:true,officialSlots:true});
 const rolled=applyCoreAction(game,{type:"roll-round",playerId:"seat-1"});if(!rolled.ok)throw Error("fixture");game=rolled.value.state;
 const held=game.players[0].goods.flatMap(g=>g.tiles),value=held[0].type;
 game={...game,players:game.players.map((p,i)=>i?p:{...p,goods:[{type:value,tiles:held.map(g=>({...g,type:value}))}]}),dice:{...game.dice,players:{...game.dice.players,"seat-1":[{...game.dice.players['seat-1'][0],value},game.dice.players['seat-1'][1]]}}};
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>localStorage.setItem("burgundy-expanded:local-v1",s),saved);await page.goto("/");
 await expect(page.locator("[data-game-revision]")).toHaveAttribute("data-game-revision",String(game.revision));
 const estate=page.locator(".estate-panel").first(),route=estate.locator(".trade-route-panel"),vine=estate.locator(".vineyard-personal"),board=page.getByRole("region",{name:"공용 공급처 보드",exact:true});
 const prefix=process.env.DICE_READABILITY_BEFORE?"before":"after";
 await estate.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`${prefix}-estate.png`)});await route.screenshot({path:info.outputPath(`${prefix}-trade.png`)});await board.screenshot({path:info.outputPath(`${prefix}-common.png`)});
 if(process.env.DICE_READABILITY_BEFORE)return;
 await vine.screenshot({path:info.outputPath("after-vineyard.png")});await estate.locator(".estate-inventory").screenshot({path:info.outputPath("after-inventory.png")});
 const cells=estate.locator('[data-estate-cell]');
 for(const value of [1,2,3,4,5,6]){const d=cells.locator(`[data-white-die="${value}"]`).first();await expect(d).toBeAttached();await expect(d.locator("circle")).toHaveCount(value);await expect(d.locator("text")).toHaveCount(0);await expect(d).toHaveAttribute("pointer-events","none");}
 await expect(cells.filter({has:page.locator('[data-estate-tile]')}).locator('[data-white-die]')).toHaveCount(0);
 for(const slot of VINE_SLOTS){const d=vine.locator(`[data-vine-slot="${slot.id}"] [data-white-die]`);await expect(d).toHaveCount(1);for(const face of await d.all()){await expect(face).toHaveAttribute("data-white-die",String(slot.value));await expect(face.locator("circle")).toHaveCount(slot.value);}}
 expect(await rewardDieOverlaps(vine)).toEqual([]);
 await expect(estate.locator('[data-goods-layer]')).toHaveCount(held.length);const goods=estate.locator('[data-goods-front]'),size=await goods.boundingBox();expect(size!.width).toBe(60);expect(size!.height).toBe(60);
 // Approved faces bake in the die; source pip counts are checked by prepare-goods-assets.py.
 await expect(goods.locator('image')).toHaveAttribute('data-goods-image',`goods_${value}.png`);
 await expect(goods.locator('[data-white-die]')).toHaveCount(0);
 const tradeSize=await route.locator('[data-trade-cell]').first().boundingBox();expect(tradeSize!.width).toBe(101);const artSize=await route.locator('[data-goods-value]').first().boundingBox();expect(artSize!.width).toBe(50);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);expect(before).toEqual(game);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await estate.getByRole('button',{name:new RegExp(`${value}번 상품 ${held.length}개 판매$`)}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.players[0].soldGoods.length)).toBe(held.length);
 await expect(route.locator('[data-trade-cell="1"]')).toHaveAttribute("data-trade-next","true");
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.players[0].goods)).toEqual(game.players[0].goods);
});
