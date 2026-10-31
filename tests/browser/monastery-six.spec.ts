import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {monasterySixFixture} from '../fixtures/monastery-six';
import {serializeSavedGame} from '../../src/game/save';
import {directActions} from '../../src/game/direct-actions';
import {applyCoreAction} from '../../src/game/core';
import {beginHistory} from '../../src/game/turn-history';
import {serializeTurnHistory} from '../../src/game/turn-history-cache';
import {isolatedRooms} from './isolated-rooms';
import type {GameState,GameAction,TileType} from '../../src/game/types';
const current=(p:Page):Promise<GameState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
const press=async(l:Locator)=>{if(await l.page().evaluate(()=>navigator.maxTouchPoints>0))await l.tap();else await l.click();};
function buying(s:GameState,type:TileType='ship') {const a=directActions(s,'seat-1').find(a=>a.type==='use-monastery-six'&&s.tiles[a.tileId].type===type);if(!a||a.type!=='use-monastery-six')throw Error('Fixture purchase');return a;}
function result(s:GameState,a:GameAction){const r=applyCoreAction(s,a);if(!r.ok)throw Error(JSON.stringify(r.issues));return r.value.state;}
async function load(p:Page,s:GameState,hotseat=false){
 await p.goto('/');await expect(p.locator('[data-game-revision]')).toBeVisible();await press(p.getByRole('button',{name:'⚙ 게임 준비',exact:true}));
 await p.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'monastery6.json',mimeType:'application/json',buffer:Buffer.from(serializeSavedGame({...(hotseat?{undo:serializeTurnHistory(s,[],beginHistory(s,[],true))}:{}),format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:s,logs:[],view:{hotseat,zoom:1,focus:false,table:true,boardZooms:{}}}))});
 await expect.poll(()=>current(p)).toEqual(s);await expect(p.getByRole('button',{name:'⚙ 게임 준비',exact:true})).toHaveAttribute('aria-expanded','false');
 await press(p.locator('.in-game-settings>summary'));await p.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();await press(p.locator('.in-game-settings>summary'));
}
async function special(p:Page){if(await p.locator('.direct-special').getAttribute('open')===null)await press(p.locator('.direct-special>summary'));}
async function chooseWorker(p:Page){await special(p);await p.getByLabel('수도원6 일꾼 구매',{exact:true}).check();}
test('all six numbered types use two workers, block both currencies, render logs and undo on PC/touch',async({page},info)=>{
 for(const type of ['building','castle','mine','ship','livestock','monastery'] as const){
  const s=monasterySixFixture(),a=buying(s,type);await load(page,s);await chooseWorker(page);expect(await current(page)).toEqual(s);
  const target=page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`);await expect(target).toHaveAttribute('aria-disabled','false');await press(target);await expect.poll(()=>current(page)).toEqual(result(s,a));
  await special(page);await expect(page.getByLabel('수도원6 일꾼 구매',{exact:true})).toBeDisabled();await expect(page.getByLabel('보드에서 은화 구매 선택',{exact:true})).toBeDisabled();await expect(page.getByText('이번 턴의 타일 구매 기회를 이미 사용했습니다.',{exact:true})).toBeVisible();
  const logs=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).logs);expect(logs.join(' ')).toContain('수도원 6번');expect(logs.join(' ')).toContain('일꾼 2개');
  if(type==='ship')await page.screenshot({path:info.outputPath('worker-purchase-used.png')});await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(s);
 }
});
test('silver-first shares the limit and refresh preserves usage and undo history',async({page})=>{
 const s=monasterySixFixture(),a=directActions(s,'seat-1').find(a=>a.type==='buy-black-tile')!;if(a.type!=='buy-black-tile')throw Error('silver fixture');await load(page,s);await special(page);await page.getByLabel('보드에서 은화 구매 선택',{exact:true}).check();await press(page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`));const expected=result(s,a);await expect.poll(()=>current(page)).toEqual(expected);expect(expected.players[0].silver).toBe(4);expect(expected.players[0].workers).toBe(6);
 await page.reload();await expect.poll(()=>current(page)).toEqual(expected);await special(page);await expect(page.getByLabel('수도원6 일꾼 구매',{exact:true})).toBeDisabled();await expect(page.getByLabel('보드에서 은화 구매 선택',{exact:true})).toBeDisabled();await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(s);
});
test('full storage requires an explicit replacement; cancelling never spends workers or purchase opportunity',async({page})=>{
 const s=monasterySixFixture();for(let i=0;i<3;i++){const pool=s.market.supplyPools.find(p=>p.remainingTileIds.length)!;s.players[0].storage[i]=pool.remainingTileIds.pop()!;}const a=buying(s),old=s.players[0].storage[0]!;await load(page,s);await chooseWorker(page);await press(page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`));expect(await current(page)).toEqual(s);
 await press(page.locator('.estate-panel[data-player-id="seat-1"] .estate-keyspaces button').first());const dialog=page.getByRole('alertdialog',{name:'교체 확인',exact:true});await expect(dialog).toBeVisible();await press(dialog.getByRole('button',{name:'취소',exact:true}));expect(await current(page)).toEqual(s);await press(page.locator('.estate-panel[data-player-id="seat-1"] .estate-keyspaces button').first());await press(dialog.getByRole('button',{name:'교체 확정',exact:true}));await expect.poll(()=>current(page)).toEqual(result(s,{...a,discardTileId:old}));
});
for(const count of [2,3,4] as const)test(`hotseat ${count} preserves the acting player's worker purchase and turn undo`,async({page})=>{
 const s=monasterySixFixture(count),a=buying(s);await load(page,s,true);await expect(page.locator('.estate-panel')).toHaveCount(count);await chooseWorker(page);await press(page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`));await expect.poll(()=>current(page)).toEqual(result(s,a));await press(page.getByRole('button',{name:'되돌리기',exact:true}));await expect.poll(()=>current(page)).toEqual(s);
});
test('two online seats share authoritative purchase state, both undo scopes, reload and reconnect',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});try{
  const owner=await(await fetch(server.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'수도원1',vineyards:true})})).json();const guest=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'수도원2'})})).json();
  const path=join(server.directory,owner.id+'.json'),raw=JSON.parse(await readFile(path,'utf8')),s=monasterySixFixture();raw.game=s;raw.logs=[];raw.history=beginHistory(s,[],true);await writeFile(path,JSON.stringify(raw));
  for(const context of[page.context(),peer]){await context.route('**/api/rooms{,/**}',async route=>{const q=route.request(),r=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});await context.routeWebSocket('**/api/rooms/*/live',()=>{});}
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),{id:owner.id,token:guest.token});const other=await peer.newPage();await page.goto('/online');await other.goto('/online');for(const p of[page,other])await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision));
  await press(page.locator('.in-game-settings>summary'));await page.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();await press(page.locator('.in-game-settings>summary'));const a=buying(s);await page.getByLabel('온라인 수도원6 일꾼 구매',{exact:true}).check();await press(page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`));for(const p of[page,other])await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision+1));
  await expect(page.getByLabel('온라인 수도원6 일꾼 구매',{exact:true})).toBeDisabled();await expect(page.getByLabel('보드에서 은화 구매 선택',{exact:true})).toBeDisabled();expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(result(s,a));await page.screenshot({path:info.outputPath('online-worker-purchase.png')});
  await page.reload();await other.reload();await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision+1));await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).game.turn.blackPurchaseUsed).toBe(false);
  await expect(page.getByLabel('온라인 수도원6 일꾼 구매',{exact:true})).toBeEnabled();await page.getByLabel('온라인 수도원6 일꾼 구매',{exact:true}).check();await press(page.locator(`.common-board-panel [data-tile-id="${a.tileId}"]`));await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeEnabled();await press(page.getByRole('button',{name:'되돌리기',exact:true}));await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).logs.length).toBe(0);
  const final=JSON.parse(await readFile(path,'utf8')).game;expect({...final,revision:0}).toEqual({...s,revision:0});await expect(other.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(final.revision));
 }finally{await page.goto('about:blank');await peer.close();await server.close();}
});
