import {readFileSync,mkdirSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {vineyardPhases,vineyardSave} from '../fixtures/android-vineyard';
import {vineFixture} from '../fixtures/vineyards';
import {applyCoreAction} from '../../src/game/core';
import {directActions,boardTarget} from '../../src/game/direct-actions';
import type {GameState} from '../../src/game/types';
import {isolatedRooms} from './isolated-rooms';
import {startLobbyHttp} from './starting-castles';

const nativeCss=readFileSync('mobile/native.css','utf8');
async function nativeStyle(page:Page){const style=await page.addStyleTag({content:nativeCss});await style.evaluate(e=>document.head.prepend(e));}
async function load(page:Page,g:GameState,zoom=1){
 await page.goto('/');
 const settings=page.getByRole('button',{name:'⚙ 게임 준비',exact:true});await settings.click();
 await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'vineyard.json',mimeType:'application/json',buffer:Buffer.from(vineyardSave(g,zoom))});
 await expect(page.locator('.vineyard-supply')).toBeVisible();
 if(await settings.getAttribute('aria-expanded')!=='true')await settings.click();
 await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await settings.click();
 await nativeStyle(page);
 await expect(page.locator('.vineyard-supply')).toBeVisible();
}
async function withinRow(page:Page){
 const row=page.locator('.common-vineyard-row'),supply=row.locator('.vineyard-supply');
 const metrics=await row.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('.vineyard-supply')!.getBoundingClientRect();return{left:s.left-r.left,right:s.right-r.right,overflow:e.scrollWidth-e.clientWidth,viewport:innerWidth,supplyRight:s.right};});
 expect(metrics.left).toBeGreaterThanOrEqual(-1);expect(metrics.right).toBeLessThanOrEqual(1);expect(metrics.overflow).toBeLessThanOrEqual(1);expect(metrics.supplyRight).toBeLessThanOrEqual(metrics.viewport);
 await supply.locator('[data-vine-supply-kind="depot"] button').first().scrollIntoViewIfNeeded();
 expect(await supply.locator('[data-vine-supply-kind="depot"] button').first().evaluate(e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
}
test('Android landscape A–E, finished and empty supply stay reachable at all zooms/designs',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','One explicit Android landscape matrix');
 await page.setViewportSize({width:866,height:364});
 for(const design of ['off','on'])for(const zoom of [.75,1,1.6,2])for(const game of vineyardPhases()){
  await load(page,game,zoom);await page.evaluate(d=>localStorage.setItem('burgundy-expanded:design-1-v1',d),design);await page.reload();await nativeStyle(page);
  await withinRow(page);await expect(page.locator('[data-vine-supply-kind="depot"] button')).toHaveCount(3);await expect(page.locator('[data-vine-supply-kind="store"] button')).toHaveCount(1);
  const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.vineyards);expect(actual).toEqual(game.vineyards);
 }
 const g=vineyardPhases().at(-1)!,v=g.vineyards!,removed=[...v.depots.flatMap(d=>d.tileId?[d.tileId]:[]),...v.store.filter((x):x is string=>!!x)];
 await load(page,{...g,vineyards:{...v,depots:v.depots.map(d=>({...d,tileId:null})),store:v.store.map(()=>null),removed:[...v.removed,...removed]}});
 await withinRow(page);await expect(page.locator('.vineyard-supply [data-vine-tile="empty"]')).toHaveCount(4);
 for(const width of [390,740,866,1280,1600]){await page.setViewportSize({width,height:500});await withinRow(page);}
 mkdirSync('.local-data/android-vineyard-fix/browser',{recursive:true});await page.screenshot({path:'.local-data/android-vineyard-fix/browser/empty-supply.png'});
});
test('two online seats retain Android supply, acquisition and reconnect',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop-1280','Two landscape contexts');await page.setViewportSize({width:866,height:364});
 const isolated=await isolatedRooms(),other=await browser.newContext({viewport:{width:866,height:364},hasTouch:true});
 try{
  for(const ctx of [page.context(),other]){await ctx.route('**/api/rooms{,/**}',async route=>{const q=route.request(),res=await fetch(isolated.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:q.postData()??undefined});await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});await ctx.routeWebSocket('**/api/rooms/*/live',()=>{});}
  const guest=await other.newPage();await page.goto('/online');await page.getByLabel('온라인 포도밭 확장',{exact:true}).check();await page.getByRole('button',{name:'2인 방 만들기',exact:true}).click();
  const code=await page.getByLabel('공유할 방 코드',{exact:true}).inputValue();await guest.goto(`/online?room=${code}`);await guest.getByLabel('온라인 이름',{exact:true}).fill('공급 참가자');await guest.getByRole('button',{name:'방 참가',exact:true}).click();await expect(guest.getByLabel('공유할 방 코드',{exact:true})).toHaveValue(code);
  const seat=(peer:Page)=>peer.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-online-seat-v1')!));await startLobbyHttp(isolated.url,await seat(page),await seat(guest));
  for(const peer of [page,guest]){await nativeStyle(peer);const cell=peer.locator('[data-can-start="true"]').first();await expect(cell).toBeVisible();await cell.click();await expect(peer.locator('[data-starting-preview="true"]')).toHaveCount(1);await peer.getByRole('button',{name:'턴 종료',exact:true}).click();await expect(peer.locator('[data-can-start="true"]')).toHaveCount(0);}
  await page.getByRole('button',{name:'주사위 굴리기',exact:true}).click();await page.getByLabel('온라인 주사위 1',{exact:true}).click();
  const target=page.locator('[data-vine-supply-kind="depot"] button:enabled').first(),id=await target.locator('.vine-tile-art').getAttribute('data-vine-tile');await target.click();
  const state=async(peer:Page)=>peer.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('burgundy-online-seat-v1')!);return(await fetch(`/api/rooms/${s.id}`,{headers:{Authorization:`Bearer ${s.token}`}})).json();});
  await expect.poll(async()=>(await state(page)).players[0].vineyardReserve?.[0]?.tileId).toBe(id);await expect(guest.locator('[data-vine-supply-kind="depot"] [data-vine-tile="empty"]')).toHaveCount(1);
  for(const peer of [page,guest]){
   expect((await state(peer)).players[0].vineyardReserve[0].tileId).toBe(id);await peer.reload();await nativeStyle(peer);await expect(peer.locator('.vineyard-supply')).toBeVisible();
   const row=peer.locator('.online-common-board-row');expect(await row.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('.vineyard-supply')!.getBoundingClientRect();return s.left>=r.left-1&&s.right<=r.right+1;})).toBe(true);
   await expect(peer.locator('[data-vine-supply-kind="depot"] [data-vine-tile="empty"]')).toHaveCount(1);
  }
 }finally{await other.close();await isolated.close();}
});
test('Android CSS preserves actual vineyard take, placement, rewards, Undo and reload',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Explicit landscape touch geometry');await page.setViewportSize({width:866,height:364});
 const initial=vineFixture();await load(page,initial);
 const take=directActions(initial,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;
 if(take.type!=='use-die'||take.intent.kind!=='vineyard')throw Error('take fixture');
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await page.locator(`.vineyard-supply [data-vine-tile="${take.intent.tileId}"]`).first().click();
 const taken=applyCoreAction(initial,take);if(!taken.ok)throw Error('take failed');
 const game=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
 await expect.poll(async()=>(await game()).players[0].vineyardReserve).toEqual(taken.value.state.players[0].vineyardReserve);
 await page.getByRole('button',{name:/^행동 주사위 2 눈/}).click();await page.locator('.estate-keyspaces .vine-keyspace').first().click();
 await page.locator('.vineyard-personal').first().locator('[data-vine-slot="V01"]').click();await page.getByRole('button',{name:'포도 배치 확정',exact:true}).click();
 await expect(page.locator('.vineyard-personal').first().locator('[data-occupied="true"]')).toHaveCount(1);
 // Resolve the existing mandatory rewards through their real engine choices.
 for(let guard=0;(await game()).turn.pendingChoice;guard++){
  if(guard>20)throw Error('reward did not finish');const g=await game(),a=directActions(g,'seat-1').find(a=>a.type==='resolve-choice');if(!a||a.type!=='resolve-choice')throw Error('reward unavailable');
  const target=boardTarget(g,a);
  if(target.intent?.kind==='take-tile')await page.locator(`.common-board-panel [data-tile-id="${target.intent.tileId}"]`).first().click();
  else{const choice=g.turn.pendingChoice.options.find((o:{id:string})=>o.id===a.optionId);await page.getByRole('region',{name:'타일 효과 선택',exact:true}).getByRole('button',{name:choice.label,exact:true}).click();}
 }
 const placed=await game();expect(placed.vineyards.players['seat-1'].placed[0].used).toHaveLength(2);expect(placed.players[0].workers).toBeGreaterThan(initial.players[0].workers);
 await page.reload();await nativeStyle(page);await expect.poll(game).toEqual(placed);await withinRow(page);
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(async()=>(await game()).players[0].vineyardReserve).toEqual(taken.value.state.players[0].vineyardReserve);
});
