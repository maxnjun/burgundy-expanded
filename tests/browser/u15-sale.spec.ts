import { test, expect, type Page } from "@playwright/test";
import { setup, mount, placed } from "../fixtures/shields";
import { prepareTileEffect } from "../../src/game/core/effects";
import { serializeSavedGame } from "../../src/game/save";
import type { GameState, Tile } from "../../src/game/types";

async function current(page:Page):Promise<GameState>{return page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);}
for(const immediate of [false,true])test(`U15 ${immediate?"warehouse":"die"} sale: resources, log and reload`,async({page},info)=>{
 let g=mount(mount(mount(setup(),9),12),2,1);
 for(const number of [3,4])g=placed(g,0,{type:"monastery",number,back:"matching-color"} as Tile);
 g={...g,players:g.players.map((p,i)=>i===0?{...p,goods:[{type:1,tiles:[1,2,3].map(n=>({id:`u15-browser:${n}`,type:1 as const}))}]}:p),dice:{...g.dice,players:{...g.dice.players,"seat-1":[{...g.dice.players["seat-1"][0],value:1},{...g.dice.players["seat-1"][1],value:1}]}}};
 if(immediate){g=placed(g,0,{type:"building",building:"warehouse",back:"matching-color"} as Tile);const tile=g.players[0].duchy.cells.find(c=>c.tileId&&g.tiles[c.tileId].type==="building")!.tileId!;g=prepareTileEffect(g,"seat-1",tile);}
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/");
 await expect(page.getByText(/사용자 확정 프로젝트 규칙: 방패9/)).toBeVisible();
 if(!immediate)await page.getByRole("button",{name:/^행동 주사위 1 눈/}).click();
 const button=immediate?page.getByLabel("타일 효과 선택",{exact:true}).getByRole("button",{name:"1번 상품 3개 판매",exact:true}):page.getByRole("button",{name:"1번 상품 3개 판매",exact:true});
 await expect(button).toBeEnabled();await button.click();await expect(page.getByLabel("현재 은화",{exact:true})).toHaveText("34");await expect(page.getByLabel("현재 일꾼",{exact:true})).toHaveText("31");
 const after=await current(page);expect(after.players[0].victoryPoints-g.players[0].victoryPoints).toBe(12);expect(after.players[1].workers-g.players[1].workers).toBe(1);expect(after.players[0].soldGoods.length-g.players[0].soldGoods.length).toBe(3);expect(after.players[0].goods).toEqual([]);
 if(immediate)expect(after.dice).toEqual(g.dice);else expect(after.dice.players["seat-1"][0].used).toBe(true);
 await page.locator(".compact-log summary").click();
 await expect(page.locator(".live-logs p").filter({hasText:"은화 +4"})).toHaveCount(1);
 await page.reload();await page.locator(".compact-log summary").click();await expect(page.getByLabel("현재 은화",{exact:true})).toHaveText("34");await expect(page.locator(".live-logs p").filter({hasText:"은화 +4"})).toHaveCount(1);expect(await current(page)).toEqual(after);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath("u15-sale.png"),fullPage:true});
});
