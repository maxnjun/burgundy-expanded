import {clickChoice} from "../fixtures/direct-choice";
import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { setup, mount, placed } from "../fixtures/shields";
import { serializeSavedGame } from "../../src/game/save";
import { prepareTileEffect } from "../../src/game/core/effects";
import { shieldLayout } from "../../src/game/shields";
import type { GameState } from "../../src/game/types";

async function load(page:Page,g:GameState){await page.clock.install();const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:g,logs:["TEST FIXTURE · castle attachment"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);await page.goto("/");await expect(page.locator(`[data-mounted-shield="${shieldLayout(g)!.mounted[0].shieldNumber}"]`)).toHaveCount(1);}
async function current(page:Page):Promise<GameState>{return page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);}
async function press(locator:Locator,info:TestInfo){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function selectShield(page:Page,info:TestInfo){await press(page.getByRole("button",{name:/^행동 주사위 1 눈/}),info);const slot=page.locator('[data-shield-slot][data-empty="false"][aria-disabled="false"]').first();const id=await slot.getAttribute("data-shield-slot");await press(slot,info);return id;}

test("mounted shield stays on its physical castle through touch, zoom, pan and reload",async({page},info)=>{
 const g=placed(mount(setup(),8),0,{type:"castle",back:"matching-color"});await load(page,g);
 const overlay=page.locator('[data-mounted-shield="8"]'),tile=shieldLayout(g)!.mounted[0].castleTileId!;
 await expect(overlay).toHaveAttribute("data-castle-tile",tile);
 await press(overlay.locator(".."),info);await expect(page.getByRole("dialog",{name:"방패 상세",exact:true})).toContainText("광산 은화 두 배");await page.getByRole("button",{name:"방패 상세 닫기",exact:true}).click();
 const slot=await selectShield(page,info);const empty=g.players[0].duchy.cells.find(c=>c.tileId&&g.tiles[c.tileId].type==="castle"&&c.tileId!==tile)!;
 const target=page.getByRole("button",{name:new RegExp(`^규칙A ${empty.id} .*배치 가능`)});await press(target,info);
 await expect(page.locator(`[data-shield-slot="${slot}"]`)).toHaveAttribute("data-empty","true");await expect(page.locator("[data-mounted-shield]")).toHaveCount(2);
 await expect(page.getByRole("alertdialog",{name:"턴 종료 확인",exact:true})).toHaveCount(0);
 const before=(await overlay.boundingBox())!;await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();expect((await overlay.boundingBox())!.width).toBeGreaterThan(before.width);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});await board.scrollIntoViewIfNeeded();const bounds=(await board.boundingBox())!;await page.mouse.move(bounds.x+80,bounds.y+80);await page.mouse.down();await page.mouse.move(bounds.x+110,bounds.y+100,{steps:5});await page.mouse.up();
 const next=await current(page);expect(shieldLayout(next)!.mounted).toHaveLength(2);await page.reload();await expect(page.locator("[data-mounted-shield]")).toHaveCount(2);await expect(overlay).toHaveAttribute("data-castle-tile",tile);
 const centered=await overlay.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement!.querySelector("polygon")!.getBoundingClientRect();return Math.abs((a.left+a.width/2)-(b.left+b.width/2))<2&&a.top>=b.top&&a.bottom<=b.bottom;});expect(centered).toBe(true);
 if(info.project.name==="mobile-390")await page.screenshot({path:info.outputPath("castle-mounted-shields.png"),fullPage:true});
});

test("occupied castle replacement requires confirmation and cancellation spends nothing",async({page},info)=>{
 const g=mount(setup(),8);await load(page,g);const slot=await selectShield(page,info);
 const castle=page.getByRole("button",{name:/^규칙A .*배치 가능.*장착 방패 8/});await press(castle,info);
 await expect(page.getByRole("alertdialog",{name:"교체 확인",exact:true})).toBeVisible();expect((await current(page)).revision).toBe(g.revision);
 await page.getByRole("button",{name:"취소",exact:true}).click();expect((await current(page)).players[0].workers).toBe(g.players[0].workers);await expect(page.locator('[data-mounted-shield="8"]')).toHaveCount(1);
 await press(castle,info);await page.getByRole("button",{name:"교체 확정",exact:true}).click();await expect(page.locator('[data-mounted-shield="8"]')).toHaveCount(0);await expect(page.locator("[data-mounted-shield]")).toHaveCount(1);await expect(page.locator(`[data-shield-slot="${slot}"]`)).toHaveAttribute("data-empty","true");
 const next=await current(page);expect(shieldLayout(next)!.removed).toContain(8);expect(shieldLayout(next)!.mounted[0].castleTileId).toBe(shieldLayout(g)!.mounted[0].castleTileId);await page.reload();await expect(page.locator("[data-mounted-shield]")).toHaveCount(1);
});

test("castle11 free replacement also waits for confirmation before acquiring",async({page})=>{
 let g=placed(mount(setup(),11),0,{type:"castle",back:"matching-color"});const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==="castle").at(-1)!.tileId!;g=prepareTileEffect(g,"seat-1",id);await load(page,g);
 const option=g.turn.pendingChoice!.options.find(o=>(o.payload as {shield?:{replaceShieldNumber:number|null}}|null)?.shield?.replaceShieldNumber===11)!;
 await clickChoice(page,g,option);await expect(page.getByRole("alertdialog",{name:"교체 확인",exact:true})).toBeVisible();expect((await current(page)).revision).toBe(g.revision);await page.getByRole("button",{name:"교체 확정",exact:true}).click();await expect(page.locator('[data-mounted-shield="11"]')).toHaveCount(0);const next=await current(page);expect(shieldLayout(next)!.removed).toContain(11);expect(next.players[0].workers).toBe(g.players[0].workers);expect(next.dice).toEqual(g.dice);await expect(page.locator("[data-mounted-shield]")).toHaveCount(1);
});
