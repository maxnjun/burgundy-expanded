import { test, expect } from "@playwright/test";
import { practicePending } from "../fixtures/white-castles";
import { serializeSavedGame } from "../../src/game/save";

test("white-die choice shows worker cost, executes once and persists on reload",async({page})=>{
 const game=practicePending(),saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();
 await page.addInitScript(saved=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',saved);},saved);
 await page.goto('/');const panel=page.getByRole('region',{name:'타일 효과 선택'});
 await expect(panel.getByRole('heading',{name:'흰 성 · 흰 주사위 추가 행동'})).toBeVisible();
 const sale=panel.getByRole('button',{name:/흰 주사위 6 → 1 · 일꾼 1 · 1번 상품/});await expect(sale).toBeVisible();
 await page.screenshot({path:'.local-data/qa/white-castle-choice.png',fullPage:true});await sale.click();
 await expect(panel).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].workers)).toBe(1);
 await page.reload();await expect(page.getByRole('heading',{name:'흰 성 · 흰 주사위 추가 행동'})).toHaveCount(0);
 const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
 expect(current.players[0].silver).toBe(game.players[0].silver+1);expect(current.players[0].goods).toEqual([]);expect(current.dice).toEqual(game.dice);
});

test("local and online preparation expose the optional white-castle set",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/게임 설정|게임 준비/}).click();
 await expect(page.getByRole('checkbox',{name:/흰 성 8개/})).toBeVisible();
 await page.goto('/online');await expect(page.getByRole('checkbox',{name:'온라인 흰 성 확장'})).toBeVisible();
});
