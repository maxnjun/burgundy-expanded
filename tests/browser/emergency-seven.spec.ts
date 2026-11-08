import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {monasterySixFixture} from '../fixtures/monastery-six';
import {tradeFixture,directSale,tradeStep} from '../fixtures/custom-trade';
import {setup,mount,startPhase} from '../fixtures/shields';
import {serializeSavedGame} from '../../src/game/save';
import {directActions} from '../../src/game/direct-actions';
import {applyCoreAction} from '../../src/game/core';
import {beginHistory} from '../../src/game/turn-history';
import {serializeTurnHistory} from '../../src/game/turn-history-cache';
import {shieldLayout} from '../../src/game/shields';
import {isolatedRooms} from './isolated-rooms';
import type {GameState,GameAction} from '../../src/game/types';

const current=(p:Page):Promise<GameState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
const press=async(l:Locator)=>{if(await l.page().evaluate(()=>navigator.maxTouchPoints>0))await l.tap();else await l.click();};
const step=(s:GameState,a:GameAction)=>{const r=applyCoreAction(s,a);if(!r.ok)throw Error(JSON.stringify(r.issues));return r.value.state;};
const target=(p:Page,id:string)=>p.locator(`.common-board-panel [data-tile-id="${id}"]`);
async function load(p:Page,s:GameState,hotseat=false){
 const save=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:s,logs:[],...(hotseat?{undo:serializeTurnHistory(s,[],beginHistory(s,[],true))}:{}),view:{hotseat,zoom:1,focus:false,table:true,boardZooms:{}}});
 await p.addInitScript(save=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',save);},save);
 await p.goto('/');await expect.poll(()=>current(p)).toEqual(s);
 await press(p.locator('.in-game-settings>summary'));await p.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();await press(p.locator('.in-game-settings>summary'));
}

test('single selects, double buys once, purchase panel stays open and undo restores resources',async({page},info)=>{
 const s=monasterySixFixture(),a=directActions(s,'seat-1').find(a=>a.type==='buy-black-tile')!;if(a.type!=='buy-black-tile')throw Error('silver fixture');await load(page,s);
 await expect(page.locator('.direct-special')).toHaveAttribute('open','');await press(target(page,a.tileId));expect(await current(page)).toEqual(s);
 await expect(page.getByRole('dialog',{name:'구매 방법 선택',exact:true})).toBeVisible();await page.getByRole('dialog',{name:'구매 방법 선택',exact:true}).getByRole('button',{name:'취소',exact:true}).click();
 await target(page,a.tileId).scrollIntoViewIfNeeded();await press(target(page,a.tileId));await press(target(page,a.tileId));await expect.poll(()=>current(page)).toEqual(step(s,a));
 await expect(page.locator('.direct-special')).toHaveAttribute('open','');await page.screenshot({path:info.outputPath('purchase-and-scores.png')});await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(s);
 await press(page.locator('.direct-special>summary'));await page.getByLabel('행동 주사위 1 눈',{exact:false}).click();await page.getByLabel('일꾼 자원',{exact:true}).click();await expect(page.locator('.direct-special')).not.toHaveAttribute('open','');
});

test('different tiles and scrolling never form a double purchase; monastery6 method uses exact workers',async({page})=>{
 const s=monasterySixFixture(),actions=directActions(s,'seat-1'),worker=actions.find(a=>a.type==='use-monastery-six'&&s.tiles[a.tileId].type==='ship')!;if(worker.type!=='use-monastery-six')throw Error('worker fixture');await load(page,s);
 const numbered=s.market.numberedDepots.flatMap(d=>d.slots.flatMap(x=>x.tileId?[x.tileId]:[])),other=numbered.find(id=>id!==worker.tileId)!;
 await press(target(page,other));await press(target(page,worker.tileId));expect(await current(page)).toEqual(s);
 const dialog=page.getByRole('dialog',{name:'구매 방법 선택',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:/일반 주사위/})).toBeVisible();await expect(dialog.getByRole('button',{name:/수도원 6번/})).toBeVisible();
 await press(dialog.getByRole('button',{name:/수도원 6번/}));await expect.poll(()=>current(page)).toEqual(step(s,worker));expect((await current(page)).players[0].workers).toBe(4);expect((await current(page)).dice).toEqual(s.dice);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(s);
 const silver=actions.find(a=>a.type==='buy-black-tile')!;if(silver.type!=='buy-black-tile')throw Error('silver');await target(page,silver.tileId).scrollIntoViewIfNeeded();await press(target(page,silver.tileId));await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));await press(target(page,silver.tileId));expect(await current(page)).toEqual(s);
});

test('trade extra action restores after reload, updates earned points and never spends another die',async({page})=>{
 const before=tradeFixture('castle'),s=tradeStep(before,directSale(before));await load(page,before,true);await press(page.getByRole('button',{name:/^행동 주사위 1 눈/}));await press(page.getByRole('button',{name:new RegExp(` ${before.dice.players['seat-1'][0].value}번 상품 3개 판매$`)}));await expect.poll(()=>current(page)).toEqual(s);await page.reload();
 await expect(page.getByRole('region',{name:'현재 누적 점수'}).locator('[data-score-player="seat-1"]')).toContainText(`${s.players[0].victoryPoints}점`);
 await press(page.getByLabel('일꾼 자원',{exact:true}));const after=await current(page);expect(after.players[0].workers).toBe(s.players[0].workers+2);expect(after.dice).toEqual(s.dice);expect(after.tradeRoutes!.routes['seat-1'].sales).toHaveLength(1);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(before);
});

for(const count of [2,3,4])test(`hotseat ${count}: visible shield upkeep, exact cost/return, all scores and reload`,async({page},info)=>{
 const s=startPhase(mount(setup(count),3)),choice=s.turn.pendingChoice!;await load(page,s,true);
 await expect(page.locator('.direct-toolbar .shield-upkeep')).toBeVisible();await expect(page.getByRole('region',{name:'현재 누적 점수'}).locator('[data-score-player]')).toHaveCount(count);
 const old=s.players.find(p=>p.id===choice.playerId)!;await press(page.getByRole('button',{name:'방패 유지',exact:true}));await press(page.getByRole('button',{name:'일꾼 1개 (방패3)',exact:true}));
 await expect.poll(async()=>(await current(page)).players.find(p=>p.id===old.id)!.workers).toBe(old.workers-1);
 await page.evaluate(save=>localStorage.setItem('burgundy-expanded:local-v1',save),serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:s,logs:[],view:{hotseat:true,zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.reload();await expect(page.locator('.direct-toolbar .shield-upkeep')).toBeVisible();await page.screenshot({path:info.outputPath(`shield-${count}.png`)});await press(page.getByRole('button',{name:'방패 제거',exact:true}));
 await expect.poll(async()=>shieldLayout(await current(page))!.mounted.length).toBe(0);expect(shieldLayout(await current(page))!.slots.some(x=>x.shieldNumber===3)).toBe(true);
});

test('create response lost: one persisted room, same identity retry, peer sync and reconnect',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL}),requests:unknown[]=[];let lose=true;
 try{
  for(const c of [page.context(),peer]){await c.route('**/api/rooms{,/**}',async route=>{const q=route.request(),path=new URL(q.url()).pathname,r=await fetch(server.url+path,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});if(path==='/api/rooms'&&q.method()==='POST'){requests.push(q.postDataJSON());if(lose){lose=false;await route.abort('timedout');return;}}await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});await c.routeWebSocket('**/api/rooms/*/live',()=>{});}
  await page.goto('/online');await press(page.getByRole('button',{name:'2인 방 만들기',exact:true}));await expect(page.getByLabel('초대 링크',{exact:true})).toBeVisible();expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
  const files=(await readdir(server.directory)).filter(x=>/^[a-f0-9]{24}\.json$/.test(x));expect(files).toHaveLength(1);const id=files[0].slice(0,-5),guest=await(await fetch(`${server.url}/api/rooms/${id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'친구'})})).json();
  const path=join(server.directory,files[0]),raw=JSON.parse(await readFile(path,'utf8')),s=monasterySixFixture();raw.game=s;raw.lobby=undefined;raw.logs=[];raw.history=beginHistory(s,[],true);await writeFile(path,JSON.stringify(raw));
  await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),{id,token:guest.token});const other=await peer.newPage();await page.reload();await other.goto('/online');for(const p of [page,other]){await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision));await expect(p.getByRole('region',{name:'현재 누적 점수'})).toContainText('상대 점수');}
  const a=directActions(s,'seat-1').find(a=>a.type==='buy-black-tile')!;if(a.type!=='buy-black-tile')throw Error('silver');await press(page.locator('.in-game-settings>summary'));await page.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();await press(page.locator('.in-game-settings>summary'));
  await target(page,a.tileId).scrollIntoViewIfNeeded();await press(target(page,a.tileId));await press(target(page,a.tileId));for(const p of [page,other])await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision+1));
  expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(step(s,a));await expect(page.getByLabel('되돌리기 가능 범위')).toHaveCount(0);await page.reload();await other.reload();await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(s.revision+1));await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).game.turn.blackPurchaseUsed).toBe(false);
 }finally{await page.goto('about:blank');await peer.close();await server.close();}
});

test('failed create has bounded retry and Korean message; reload reuses saved identity',async({page})=>{
 const requests:unknown[]=[];await page.route('**/api/rooms',async route=>{requests.push(route.request().postDataJSON());await route.abort('timedout');});await page.goto('/online');await press(page.getByRole('button',{name:'2인 방 만들기',exact:true}));
 await expect(page.getByRole('button',{name:'중단된 방 연결 다시 시도',exact:true})).toBeEnabled();expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);await expect(page.getByText(/네트워크 연결을 확인/).first()).toBeVisible();
 await page.reload();await expect.poll(()=>requests.length).toBe(4);expect(requests.every(r=>JSON.stringify(r)===JSON.stringify(requests[0]))).toBe(true);await expect(page.getByRole('button',{name:'중단된 방 연결 다시 시도',exact:true})).toBeEnabled();
});

test('an unresponsive server stops create after two bounded attempts without raw signal errors',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','One real timeout measurement for the shared client');
 const requests:unknown[]=[];await page.route('**/api/rooms',route=>{requests.push(route.request().postDataJSON());});await page.goto('/online');await press(page.getByRole('button',{name:'2인 방 만들기',exact:true}));
 await expect(page.getByLabel('방 연결 진행',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'중단된 방 연결 다시 시도',exact:true})).toBeEnabled({timeout:35000});
 expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);await expect(page.getByText(/서버 응답이 지연됩니다/).first()).toBeVisible();await expect(page.getByText('signal timed out',{exact:true})).toHaveCount(0);
});

test('quick monastery purchase at full storage requires explicit replacement; cancel spends nothing',async({page})=>{
 const s=monasterySixFixture();for(let i=0;i<3;i++)s.players[0].storage[i]=s.market.supplyPools.find(p=>p.remainingTileIds.length)!.remainingTileIds.pop()!;
 const a=directActions(s,'seat-1').find(a=>a.type==='use-monastery-six'&&s.tiles[a.tileId].type==='ship')!;if(a.type!=='use-monastery-six')throw Error('worker fixture');await load(page,s);
 await press(target(page,a.tileId));const methods=page.getByRole('dialog',{name:'구매 방법 선택',exact:true});await press(methods.getByRole('button',{name:/수도원 6번/}));expect(await current(page)).toEqual(s);
 const stored=page.locator('.estate-panel[data-player-id="seat-1"] .estate-keyspaces button').first();await press(stored);const confirm=page.getByRole('alertdialog',{name:'교체 확인',exact:true});await press(confirm.getByRole('button',{name:'취소',exact:true}));expect(await current(page)).toEqual(s);
 await press(stored);await press(confirm.getByRole('button',{name:'교체 확정',exact:true}));await expect.poll(()=>current(page)).toEqual(step(s,{...a,discardTileId:s.players[0].storage[0]!}));
});

test('landscape touch help leaves the purchase tile uncovered for the second tap',async({page},info)=>{
 test.skip(!info.project.use.hasTouch,'Touch hit testing');await page.setViewportSize({width:866,height:364});const s=monasterySixFixture(),a=directActions(s,'seat-1').find(a=>a.type==='buy-black-tile')!;if(a.type!=='buy-black-tile')throw Error('silver');await load(page,s);
 const tile=target(page,a.tileId);await press(tile);await expect(page.getByRole('dialog',{name:'타일 효과 설명',exact:true})).toBeVisible();
 expect(await tile.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await press(page.getByRole('dialog',{name:'구매 방법 선택',exact:true}).getByRole('button',{name:'취소',exact:true}));await tile.scrollIntoViewIfNeeded();await press(tile);await press(tile);await expect.poll(()=>current(page)).toEqual(step(s,a));
});

test('choosing ordinary die at full storage never switches to monastery6',async({page})=>{
 const s=monasterySixFixture();for(let i=0;i<3;i++)s.players[0].storage[i]=s.market.supplyPools.find(p=>p.remainingTileIds.length)!.remainingTileIds.pop()!;
 const a=directActions(s,'seat-1').find(a=>a.type==='use-die'&&a.dieId===s.dice.players['seat-1'][0].id&&a.intent.kind==='take-tile')!;if(a.type!=='use-die'||a.intent.kind!=='take-tile')throw Error('ordinary fixture');await load(page,s);
 await press(target(page,a.intent.tileId));await press(page.getByRole('dialog',{name:'구매 방법 선택',exact:true}).getByRole('button',{name:/일반 주사위/}));await press(page.locator('.estate-panel[data-player-id="seat-1"] .estate-keyspaces button').first());await press(page.getByRole('alertdialog',{name:'교체 확인',exact:true}).getByRole('button',{name:'교체 확정',exact:true}));
 const expected=step(s,{...a,intent:{...a.intent,discardTileId:s.players[0].storage[0]!}});await expect.poll(()=>current(page)).toEqual(expected);expect(expected.turn.blackPurchaseUsed).toBe(false);
});
