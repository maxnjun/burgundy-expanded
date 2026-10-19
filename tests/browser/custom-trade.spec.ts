import {test,expect,type Page} from "@playwright/test";
import {tradeFixture,directSale,tradeStep} from "../fixtures/custom-trade";
import {CUSTOM_TRADE_CATALOG,customTradeSpaces} from "../../src/game/custom-trade-routes";
import {serializeSavedGame} from "../../src/game/save";
import type {GameState} from "../../src/game/types";
async function load(page:Page,g:GameState){await page.addInitScript(v=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',v);},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.goto('/');await expect(page.getByRole('region',{name:'무역1 커스텀 무역로',exact:true})).toBeVisible();}
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game as GameState);
test('direct multi-goods sale fills one cell and renders collapsed/expanded, matched reward and reload',async({page})=>{
 const g=tradeFixture('bank');await load(page,g);const panel=page.getByRole('region',{name:'무역1 커스텀 무역로',exact:true});await expect(panel.locator('[data-trade-card]')).toHaveCount(1);await expect(panel.locator('[data-trade-next=true]')).toHaveCount(1);
 await panel.screenshot({path:'.local-data/qa/custom-trade-collapsed.png'});await panel.getByRole('button',{name:'전체 무역로 펼치기'}).click();await expect(panel.locator('[data-trade-card]')).toHaveCount(5);await panel.screenshot({path:'.local-data/qa/custom-trade-expanded.png'});await panel.getByRole('button',{name:'무역로 접기'}).click();
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();const type=g.dice.players['seat-1'][0].value;await page.getByRole('button',{name:`${type}번 상품 3개`,exact:true}).click();
 await expect(panel.locator('[data-trade-status=resolved]')).toHaveCount(1);await expect(panel.locator('[data-trade-cell="1"]')).toHaveAttribute('data-trade-next','true');expect((await state(page)).players[0].silver-g.players[0].silver).toBe(3);await panel.screenshot({path:'.local-data/qa/custom-trade-sale.png'});await page.reload();await expect(panel.getByText(/1\/15칸 완료/)).toBeVisible();
});
test('mismatches show goods back, card transition and final route stay visible with no skipped slots',async({page})=>{
 let g=tradeFixture('bank');const spaces=customTradeSpaces(g.tradeRoutes!.routes['seat-1']);
 const advance=()=>{const index=g.tradeRoutes!.routes['seat-1'].sales.length,type=(spaces[index]?.goodsType===6?1:(spaces[index]?.goodsType??1)+1) as 1|2|3|4|5|6,hand=g.players[0].goods.flatMap(x=>x.tiles);g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:[{type,tiles:hand.length?hand.map(t=>({...t,type})):[{id:`TEST-UI-FILL:${index}`,type}]}]}),dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],value:type,used:false},g.dice.players['seat-1'][1]]}}};g=tradeStep(g,directSale(g));};
 advance();await load(page,g);const panel=page.getByRole('region',{name:'무역1 커스텀 무역로',exact:true});await expect(panel.locator('[data-goods-back]')).toHaveCount(1);await panel.screenshot({path:'.local-data/qa/custom-trade-mismatch.png'});
 advance();advance();const save=(game:GameState)=>serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.evaluate(v=>localStorage.setItem('burgundy-expanded:local-v1',v),save(g));await page.reload();await expect(panel.locator('[data-trade-card]')).toHaveAttribute('data-trade-card',g.tradeRoutes!.routes['seat-1'].tileIds[1]);await panel.screenshot({path:'.local-data/qa/custom-trade-next-card.png'});
 while(g.tradeRoutes!.routes['seat-1'].sales.length<15)advance();await page.evaluate(v=>localStorage.setItem('burgundy-expanded:local-v1',v),save(g));await page.reload();await expect(panel.getByText(/전체 완료/)).toBeVisible();await expect(panel.locator('[data-trade-next=true]')).toHaveCount(0);await expect(panel.locator('[data-goods-back]')).toHaveCount(3);await panel.screenshot({path:'.local-data/qa/custom-trade-complete.png'});
 expect(CUSTOM_TRADE_CATALOG.length).toBe(12);
});
test('white reward uses existing mandatory choice UI and reload preserves pending selection',async({page})=>{
 const g=tradeStep(tradeFixture('white-castle'),directSale(tradeFixture('white-castle')));await load(page,g);await expect(page.getByRole('region',{name:'타일 효과 선택',exact:true})).toBeVisible();await page.reload();
 const choices=page.getByRole('region',{name:'타일 효과 선택',exact:true});await choices.getByRole('button',{name:/일꾼 획득/}).click();await expect(choices).toHaveCount(0);await expect(page.locator('[data-trade-status=resolved]')).toHaveCount(1);expect((await state(page)).tradeRoutes!.routes['seat-1'].sales.length).toBe(1);
});
test('local setup2/3/4 starts custom route option and disables without changing legacy games',async({page})=>{
 await page.goto('/');for(const count of [2,3,4]){await page.getByRole('button',{name:/게임 준비/}).click();await page.getByLabel('플레이어 수',{exact:true}).selectOption(String(count));await page.getByLabel('무역로 확장',{exact:true}).check();await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();await expect.poll(async()=>Object.values((await state(page)).tradeRoutes?.routes??{}).map(r=>r.tileIds.length)).toEqual(Array(count).fill(count===2?5:count===3?4:3));}
 await page.getByRole('button',{name:/게임 준비/}).click();await page.getByLabel('무역로 확장',{exact:true}).uncheck();await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();await expect(page.locator('.trade-route-panel')).toHaveCount(0);
});
