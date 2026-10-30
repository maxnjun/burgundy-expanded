import {test,expect,type Page,type Browser,type TestInfo,type Route} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isolatedRooms} from './isolated-rooms';
import {vineFixture,blackVineFixture,townHallVineFixture} from '../fixtures/vineyards';
import {setup,mount,boundary,placed} from '../fixtures/shields';
import {beginHistory} from '../../src/game/turn-history';
import {shieldLayout,setShieldLayout} from '../../src/game/shields';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction,listCoreActionOptions} from '../../src/game/core';
import {serializeSavedGame} from '../../src/game/save';
import type {GameState} from '../../src/game/types';
import type {RoomView} from '../../src/server/rooms';
import {townHallReserveFixture} from '../fixtures/ver2';
import {prepareTileEffect} from '../../src/game/core/effects';

test.setTimeout(90_000);
for(const ordinaryFirst of [false,true])test(`online vine preview spends the selected die or castle action separately ordinaryFirst=${ordinaryFirst}`,async({page,browser},info)=>{
 let game=townHallReserveFixture();const old=new Set(game.players[0].duchy.cells.map(c=>c.tileId));game=placed(game,0,{type:'castle',back:'matching-color'});const castle=game.players[0].duchy.cells.find(c=>c.tileId&&!old.has(c.tileId))!.tileId!;game=prepareTileEffect(game,'seat-1',castle);const f=await online(page,browser,info,game);
 try{
  if(ordinaryFirst)await page.getByLabel('온라인 주사위 1',{exact:true}).click();const board=page.getByRole('region',{name:'포도1 포도밭',exact:true});await board.getByRole('button',{name:/^보관 포도 /}).click();await board.locator('[data-vine-slot][aria-disabled="false"]').first().click();expect((await f.view()).revision).toBe(game.revision);await board.getByRole('button',{name:'포도 배치 확정',exact:true}).click();await expect.poll(async()=>(await f.view()).vineyards!.players['seat-1'].placed.length).toBe(1);
  let v=await f.view();expect(v.dice.players['seat-1'].map(d=>d.used)).toEqual([ordinaryFirst,false]);
  for(let guard=0;v.actions.some(a=>a.action.type==='resolve-choice')&&!v.castleAction;guard++){expect(guard).toBeLessThan(8);await page.getByRole('button',{name:'건물 효과 사용하지 않기',exact:true}).click();await expect.poll(async()=>(await f.view()).revision).toBeGreaterThan(v.revision);v=await f.view();}
  expect(v.castleAction).toBe(ordinaryFirst);if(!ordinaryFirst)await page.getByLabel('온라인 주사위 1',{exact:true}).click();await page.getByRole('button',{name:'포도1 일꾼 자원',exact:true}).click();await expect.poll(async()=>(await f.view()).dice.players['seat-1'][0].used).toBe(true);await expect.poll(async()=>(await f.view()).castleAction).toBe(false);await expect(f.guest.locator('[data-vine-slot][data-occupied=true]')).toHaveCount(1);
  if(!ordinaryFirst){await page.getByText('⚙ 게임 설정',{exact:true}).click();const setting=page.getByRole('checkbox',{name:'상단 턴 안내 따라오기',exact:true}),settingsBox=(await setting.locator('..').boundingBox())!;expect(settingsBox.x).toBeGreaterThanOrEqual(0);expect(settingsBox.x+settingsBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);await page.screenshot({path:info.outputPath('online-guidance-setting.png')});await setting.uncheck();await expect(page.getByLabel('온라인 합법 행동',{exact:true})).toHaveCSS('position','static');await page.reload();await expect(page.locator('main')).toHaveAttribute('data-guidance-pinned','false');}
  await board.screenshot({path:info.outputPath(`vine-${ordinaryFirst?'real-die':'castle'}-first.png`)});
 }finally{await f.close();}
});

async function online(page:Page,browser:Browser,info:TestInfo,game:GameState){
 const server=await isolatedRooms(),context=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile});
 const proxy=async(r:Route)=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 await page.context().route('**/api/rooms{,/**}',proxy);await context.route('**/api/rooms{,/**}',proxy);await page.context().routeWebSocket('**/api/rooms/*/live',ws=>ws.close());await context.routeWebSocket('**/api/rooms/*/live',ws=>ws.close());
 const owner=await(await fetch(`${server.url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A'})})).json(),other=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'B'})})).json();const path=join(server.directory,`${owner.id}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game=game;room.history=beginHistory(game,room.logs,true);await writeFile(path,JSON.stringify(room));
 await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await context.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),other);await page.goto('/online');const guest=await context.newPage();await guest.goto('/online');
 return {guest,view:async()=>await(await fetch(`${server.url}/api/rooms/${owner.id}`,{headers:{Authorization:`Bearer ${owner.token}`}})).json() as RoomView,close:async()=>{await context.close();await server.close();}};
}

test('online vineyard rotates actual preview, syncs both seats, restores the entire reward chain and keeps manual turns',async({page,browser},info)=>{
 const game=vineFixture(),f=await online(page,browser,info,game);
 try{
  await page.getByLabel('온라인 주사위 1',{exact:true}).click();await page.getByRole('button',{name:/^포도 공급 1\/4 /}).click();const board=page.getByRole('region',{name:'포도1 포도밭',exact:true}),reserve=board.getByRole('button',{name:/^보관 포도 /});await expect(reserve).toHaveCount(1);await reserve.click();await page.getByLabel('온라인 주사위 2',{exact:true}).click();await board.getByRole('button',{name:/^V01 1층 눈4 배치 가능/}).click();await board.getByRole('button',{name:'돌려서 배치',exact:true}).click();await expect(reserve.locator('.vine-tile-art')).toHaveAttribute('data-rotation','180');await expect(page.locator('.vine-keyspace.selected .vine-tile-art')).toHaveAttribute('data-rotation','180');await board.screenshot({path:info.outputPath('online-rotation.png')});await board.getByRole('button',{name:'포도 배치 확정',exact:true}).click();
  await page.getByRole('button',{name:'건물 효과 사용하지 않기',exact:true}).click();await expect.poll(async()=>(await f.view()).vineyards!.players['seat-1'].placed[0]?.used).toHaveLength(2);await expect.poll(async()=>(await f.view()).vineyards!.stack).toHaveLength(0);const committed=await f.view();expect(committed.vineyards!.players['seat-1'].placed[0].flipped).toBe(true);expect(committed.activePlayerId).toBe('seat-1');await expect(page.getByRole('button',{name:'턴 종료',exact:true})).toBeEnabled();await expect(f.guest.locator('[data-vine-slot="V01"][data-occupied="true"]')).toHaveCount(1);
  await page.reload();await f.guest.reload();await expect(board.locator('[data-vine-slot="V01"]')).toHaveAttribute('data-occupied','true');await expect(f.guest.locator('[data-vine-slot="V01"][data-occupied="true"]')).toHaveCount(1);expect((await f.view()).vineyards).toEqual(committed.vineyards);
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(async()=>(await f.view()).vineyards!.players['seat-1'].placed.length).toBe(0);expect((await f.view()).players[0].vineyardReserve).toHaveLength(1);await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect.poll(async()=>(await f.view()).players[0].vineyardReserve?.length??0).toBe(0);const restored=await f.view();expect(restored.players).toEqual(game.players);expect(restored.vineyards).toEqual({...game.vineyards,bag:[]});
  if(info.project.use.hasTouch)await page.setViewportSize({width:844,height:390});await page.locator('.online-estates').scrollIntoViewIfNeeded();expect((await page.locator('.online-controls').boundingBox())!.y).toBeGreaterThanOrEqual(-1);await page.screenshot({path:info.outputPath('online-landscape-or-pc.png')});
 }finally{await f.close();}
});

test('online legacy shield returns have two choices, zero removal fee, capacity paging and persisted peer sync',async({page,browser},info)=>{
 let g=mount(mount(setup(),3),8);const l=shieldLayout(g)!,depot=l.slots.find(s=>s.shieldNumber!==null)!.depot;g=setShieldLayout(g,{...l,mounted:l.mounted.map(({sourceDepot,...m})=>{expect(sourceDepot).toBeTruthy();return m;})});g=boundary({...g,players:g.players.map(p=>({...p,silver:0,workers:0}))});const f=await online(page,browser,info,g);
 try{
  if(info.project.use.hasTouch)await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'단계 진행',exact:true}).click();
  for(const number of [3,8]){const item=page.locator('.shield-upkeep-item').filter({has:page.getByText(`방패 ${number}`,{exact:true})});await expect(item.getByRole('button',{name:'방패 유지',exact:true})).toBeDisabled();await item.getByRole('button',{name:'방패 제거',exact:true}).click();await item.getByRole('button',{name:`${depot}번 공급처로 반환`,exact:true}).click();await expect.poll(async()=>(await f.view()).shields!.mounted.some(m=>m.shieldNumber===number)).toBe(false);}
  const v=await f.view();expect(v.players[0].silver).toBe(0);expect(v.players[0].workers).toBe(0);expect(v.shields!.slots.filter(s=>s.depot===depot&&s.shieldNumber!==null)).toHaveLength(3);await page.getByRole('button',{name:`${depot}번 방패 다음 묶음`,exact:true}).click();await expect(page.locator(`[data-shield-depot="${depot}"] [data-empty="false"]`)).toHaveCount(1);await page.reload();await f.guest.reload();await expect(f.guest.getByRole('button',{name:`${depot}번 방패 다음 묶음`,exact:true})).toBeVisible();expect((await f.view()).shields).toEqual(v.shields);await page.locator('.online-controls').screenshot({path:info.outputPath('online-shield-controls.png')});
 }finally{await f.close();}
});

test('two three and four real duchy numbers and fitted boards remain usable in portrait and landscape',async({page},info)=>{
 // The previous page may autosave during reload; seed before React initializes.
 await page.addInitScript(()=>{const saved=sessionStorage.getItem('qa-real-duchy-boards');if(saved)localStorage.setItem('burgundy-expanded:local-v1',saved);});
 await page.goto('/');for(const count of [2,3,4]){
  const initial=createPracticeSession({names:Array.from({length:count},(_,i)=>`번호${i+1}`),boardIds:Array.from({length:count},(_,i)=>`se:base:${i+2}`),seed:`number-${count}`,vineyards:true,officialSlots:true}),rolled=applyCoreAction(initial,{type:'roll-round',playerId:'seat-1'});expect(rolled.ok).toBeTruthy();if(!rolled.ok)return;
  const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:rolled.value.state,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.evaluate(s=>sessionStorage.setItem('qa-real-duchy-boards',s),saved);await page.reload();
  const panels=page.locator('.estate-panel');await expect(panels).toHaveCount(count);await expect(panels.first().locator('h2')).toContainText('번호1');for(let i=0;i<count;i++){await expect(panels.nth(i).locator('.board-number')).toHaveText(`영지 보드 ${i+2}번`);const row=panels.nth(i).locator('.estate-vineyard-row');expect(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
  if(count===4&&info.project.use.hasTouch)await page.setViewportSize({width:844,height:390});await panels.first().locator('.estate-vineyard-row').screenshot({path:info.outputPath(`real-boards-${count}.png`)});
 }
});

test('online monastery6 stays separate from a pending free vineyard reward and never buys an unrelated black tile',async({page,browser},info)=>{
 const monastery={type:'monastery',number:6,back:'matching-color'} as const;const game=placed(blackVineFixture(),0,monastery),f=await online(page,browser,info,game);
 try{
  await page.getByLabel('온라인 수도원6 건물 획득',{exact:true}).check();await expect(page.getByLabel('현재 행동 안내',{exact:true})).toContainText('일꾼 2개');for(const id of game.market.blackDepot.filter(Boolean))await expect(page.locator(`[data-black-depot] [data-tile-id="${id}"]`)).toHaveAttribute('aria-disabled','true');
  const id=game.market.numberedDepots.flatMap(d=>d.slots).find(s=>s.tileId&&game.tiles[s.tileId].type==='building')!.tileId!;await page.locator(`[data-depot] [data-tile-id="${id}"]`).click();await expect.poll(async()=>(await f.view()).players[0].storage).toContain(id);const v=await f.view();expect(v.players[0].workers).toBe(game.players[0].workers-2);expect(v.players[0].silver).toBe(game.players[0].silver);expect(v.dice).toEqual(game.dice);expect(v.vineyards).toEqual({...game.vineyards,bag:[]});await expect(f.guest.locator('.online-player').first()).toContainText(`일꾼${v.players[0].workers}`);await page.reload();await expect(page.getByLabel('온라인 수도원6 건물 획득',{exact:true})).toHaveCount(0);
 }finally{await f.close();}
});

test('choosing another room updates the invite URL and refresh restores the currently selected protected seat',async({page,browser},info)=>{
 const f=await online(page,browser,info,vineFixture());try{
  const before=await f.view(),first=await page.getByLabel('공유할 방 코드').inputValue();await expect(page).toHaveURL(new RegExp(`room=${first}$`));await page.getByRole('button',{name:'다른 방 선택',exact:true}).click();await page.getByRole('button',{name:'기존 게임으로 돌아가기',exact:true}).click();await expect(page.getByLabel('공유할 방 코드')).toHaveValue(first);
  await page.getByRole('button',{name:'다른 방 선택',exact:true}).click();await page.getByRole('button',{name:'2인 방 만들기',exact:true}).click();await expect.poll(()=>page.getByLabel('공유할 방 코드').inputValue()).not.toBe(first);const second=await page.getByLabel('공유할 방 코드').inputValue();await expect(page).toHaveURL(new RegExp(`room=${second}$`));await page.reload();await expect(page.getByLabel('공유할 방 코드')).toHaveValue(second);expect((await f.view()).players).toEqual(before.players);await expect(f.guest.getByLabel('공유할 방 코드')).toHaveValue(first);
 }finally{await f.close();}
});

test('online automatic vineyard rewards preserve a purchase that creates a free placement target',async({page,browser},info)=>{
 const game=townHallVineFixture(),options=listCoreActionOptions(game,'seat-1');expect(options.ok).toBe(true);if(!options.ok)throw Error('fixture actions');
 expect(game.turn.pendingChoice!.options.map(o=>o.id)).toEqual(['skip']);
 const buy=options.value.actions.find(a=>{if(a.type!=='buy-black-tile')return false;const r=applyCoreAction(game,a);return r.ok&&r.value.state.turn.pendingChoice?.options.some(o=>(o.payload as {intent?:{kind:string}}|null)?.intent?.kind==='place-tile');});expect(buy?.type).toBe('buy-black-tile');if(buy?.type!=='buy-black-tile')throw Error('fixture purchase');
 const f=await online(page,browser,info,game);try{
  await expect(page.getByRole('button',{name:'건물 효과 사용하지 않기',exact:true})).toBeVisible();await page.getByText('보드에서 은화 구매 선택',{exact:true}).click();await page.locator(`[data-black-depot] [data-tile-id="${buy.tileId}"]`).click();await expect.poll(async()=>(await f.view()).players[0].storage).toContain(buy.tileId);
  await page.locator('.online-player').first().locator('.estate-keyspaces .keyspace').nth(buy.storageSlot).click();const before=await f.view(),placement=before.actions.find(a=>a.target.intent?.kind==='place-tile'&&a.target.intent.tileId===buy.tileId);expect(placement).toBeTruthy();if(placement?.target.intent?.kind!=='place-tile')throw Error('fixture placement');const cellId=placement.target.intent.cellId;await page.locator('.online-player').first().locator(`[data-estate-cell="${cellId}"]`).click();
  await expect.poll(async()=>(await f.view()).players[0].duchy.cells.find(c=>c.id===cellId)?.tileId).toBe(buy.tileId);const after=await f.view();expect(after.players[0].silver).toBe(game.players[0].silver-2);expect(after.dice).toEqual(game.dice);expect(after.activePlayerId).toBe('seat-1');await expect(f.guest.locator('.online-player').first().locator(`[data-estate-cell="${cellId}"]`)).toHaveAttribute('aria-label',/배치됨/);
 }finally{await f.close();}
});
