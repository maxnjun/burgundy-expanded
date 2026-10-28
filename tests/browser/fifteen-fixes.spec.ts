import {renderedVinePair} from './vineyard-rendered-pair';
import {test,expect,type Page,type Route} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {vineFixture,blackVineFixture} from '../fixtures/vineyards';
import {setup,mount,boundary,placed} from '../fixtures/shields';
import {applyCoreAction,listCoreActionOptions} from '../../src/game/core';
import {VINE_TILES} from '../../src/game/vineyards';
import {beginHistory} from '../../src/game/turn-history';
import {shieldLayout,setShieldLayout} from '../../src/game/shields';
import {serializeSavedGame} from '../../src/game/save';
import type {GameState} from '../../src/game/types';
import type {RoomView} from '../../src/server/rooms';
import {isolatedRooms} from './isolated-rooms';

test.setTimeout(90_000);

async function local(page:Page,game:GameState){await page.addInitScript(s=>{if(!sessionStorage.getItem('fifteen-init')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('fifteen-init','1');}},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.goto('/');}
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game as GameState);

test('15 fixes: slot preview and reversible half-turn match placement grapes and do not rotate estate tiles',async({page},info)=>{
 let game=vineFixture();const list=listCoreActionOptions(game,'seat-1');expect(list.ok).toBeTruthy();if(!list.ok)return;const take=list.value.actions.find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;const applied=applyCoreAction(game,take);expect(applied.ok).toBeTruthy();if(!applied.ok)return;game=applied.value.state;await local(page,game);
 const board=page.getByRole('region',{name:'포도1 포도밭',exact:true}),reserve=board.getByRole('button',{name:/^보관 포도 /});await reserve.click();await page.getByRole('button',{name:/^행동 주사위 2 눈/}).click();
 const art=reserve.locator('.vine-tile-art'),rotate=board.getByRole('button',{name:'돌려서 배치',exact:true});
 await expect(rotate).toBeDisabled();await board.getByRole('button',{name:/^V01 1층 눈4 배치 가능/}).click();
 for(const angle of [0,180,0]){await expect(art).toHaveAttribute('data-rotation',String(angle));await expect(art).toHaveAttribute('viewBox','0 0 100 57');await expect(page.locator('.vine-keyspace.selected .vine-tile-art')).toHaveAttribute('data-rotation',String(angle));await expect(art.locator(':scope>g')).toHaveAttribute('transform',`rotate(${angle} 50 28)`);expect(await state(page)).toEqual(game);await rotate.click();}
 await expect(art).toHaveAttribute('data-rotation','180');await board.screenshot({path:info.outputPath('rotated-preview.png')});
 await board.getByRole('button',{name:'포도 배치 확정',exact:true}).click();await expect(board.locator('[data-vine-slot="V01"]')).toHaveAttribute('data-occupied','true');const current=await state(page),planted=current.vineyards!.players['seat-1'].placed[0];expect(planted.flipped).toBe(true);
 const grapes=VINE_TILES[planted.tileId];expect(await renderedVinePair(board.locator("[data-vine-slot=V01]"))).toEqual([grapes[1],grapes[0]]);
 expect(current.players[0].duchy).toEqual(game.players[0].duchy);await page.reload();await expect(board.locator('[data-vine-slot="V01"]')).toHaveAttribute('data-occupied','true');
});

test('15 fixes: fitted personal boards, independent score pages, bright tiles and visible depot5 pips',async({page},info)=>{
 let game=vineFixture();const source=game.market.numberedDepots.flatMap(d=>d.goods);game={...game,market:{...game.market,numberedDepots:game.market.numberedDepots.map(d=>d.number===5?{...d,goods:source}:{...d,goods:[]})}};await local(page,game);
 const row=page.locator('.estate-vineyard-row').first(),estate=row.locator('.estate-original-board'),vine=row.locator('.vineyard-personal'),scores=estate.locator('.personal-score-pages');await expect(vine).toBeVisible();
 const bounds=await row.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+1);const a=await estate.boundingBox(),b=await vine.boundingBox(),score=await scores.boundingBox(),svg=await estate.locator('.live-estate-svg').boundingBox();expect(b!.x).toBeGreaterThan(a!.x);expect(score!.y).toBeGreaterThanOrEqual(svg!.y+svg!.height);expect(b!.x+b!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
 await scores.getByRole('button',{name:'포도1 점수판 다음 페이지'}).click();await expect(scores.locator('[data-score-page]')).toHaveAttribute('data-score-page','2');await expect(page.locator('[data-region-score-panel] [data-score-page]')).toHaveAttribute('data-score-page','1');
 const common=page.locator('.common-board-panel');await expect(common).not.toContainText('검은 공급처 · 은화');expect(await common.locator('.supply-art-tile').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');await expect(common.locator('[data-market-price="black"] image')).toHaveCount(2);
 await expect(common.locator('[data-round-supply] [data-goods-value]')).toHaveCount(4);await expect(common.locator('[data-region-score-panel]')).toContainText('10칸');await expect(common.locator('[data-region-score-panel]')).toContainText('A 10');
 for(const zoom of [1,1.6,2]){await common.locator('.common-board-svg').evaluate((el,z)=>(el as SVGElement).style.width=`${940*z}px`,zoom);const depot=common.locator('[data-depot="5"]');const badge=await depot.locator(':scope>[data-white-die]').boundingBox();const faces=depot.locator('[data-goods-value] [data-white-die]');expect(await faces.count()).toBeGreaterThan(0);for(const face of await faces.all()){const f=await face.boundingBox();expect(Math.max(0,Math.min(badge!.x+badge!.width,f!.x+f!.width)-Math.max(badge!.x,f!.x))*Math.max(0,Math.min(badge!.y+badge!.height,f!.y+f!.height)-Math.max(badge!.y,f!.y))).toBe(0);const value=await face.getAttribute('data-white-die');expect(await face.locator('circle').count()).toBe(Number(value));}}
 await common.locator('.common-board-svg').evaluate(el=>(el as SVGElement).style.removeProperty('width'));const viewport=page.viewportSize()!;await page.setViewportSize({...viewport,height:2000});await common.scrollIntoViewIfNeeded();await common.screenshot({path:info.outputPath('common-five-goods.png')});await row.scrollIntoViewIfNeeded();await row.screenshot({path:info.outputPath('personal-fit.png')});await page.setViewportSize(viewport);await page.screenshot({path:info.outputPath('mobile-or-pc.png')});expect(await state(page)).toEqual(game);
});

test('15 fixes: legacy upkeep presents keep/remove, returns without a silver fee and survives reload',async({page})=>{
 let g=mount(setup(),3);const l=shieldLayout(g)!;g=setShieldLayout(g,{...l,mounted:l.mounted.map(({sourceDepot,...m})=>{expect(sourceDepot).toBeTruthy();return m;})});g=boundary(g);const a=applyCoreAction(g,{type:'advance-phase',playerId:'seat-1'});expect(a.ok).toBeTruthy();if(!a.ok)return;g=a.value.state;await local(page,g);
 const panel=page.getByLabel('방패 유지 또는 제거');await expect(panel.getByRole('button',{name:'방패 유지',exact:true})).toBeVisible();await panel.getByRole('button',{name:'방패 제거',exact:true}).click();await panel.getByRole('button',{name:'6번 공급처로 반환',exact:true}).click();
 const restored=await state(page);expect(restored.players[0].silver).toBe(g.players[0].silver);expect(shieldLayout(restored)!.mounted).toHaveLength(0);expect(shieldLayout(restored)!.slots.some(s=>s.depot===6&&s.shieldNumber===3)).toBeTruthy();await page.reload();await expect(page.locator('[data-shield-depot="6"] [data-empty="false"]')).toHaveCount(2);
});

test('15 fixes: two online seats retain dice selection, sticky guidance, public goods, Undo and one-click return',async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile});
 const proxy=async(r:Route)=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 await page.context().route('**/api/rooms{,/**}',proxy);await peer.route('**/api/rooms{,/**}',proxy);await page.context().routeWebSocket('**/api/rooms/*/live',ws=>ws.close());await peer.routeWebSocket('**/api/rooms/*/live',ws=>ws.close());
 try{
  const owner=await(await fetch(`${server.url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A',vineyards:true})})).json(),other=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'B'})})).json();const path=join(server.directory,`${owner.id}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game=vineFixture();room.history=beginHistory(room.game,room.logs,true);await writeFile(path,JSON.stringify(room));
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),other);await page.goto('/online');const guest=await peer.newPage();await guest.goto('/online');
  const current=async()=>await(await fetch(`${server.url}/api/rooms/${owner.id}`,{headers:{Authorization:`Bearer ${owner.token}`}})).json() as RoomView;await expect(page.getByLabel('온라인 주사위 1',{exact:true})).toBeEnabled();
  const mini=page.getByRole('button',{name:/^포도1 개인 주사위 1 눈/});await mini.click();await expect(mini).toHaveAttribute('aria-pressed','true');expect(await mini.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');await expect(page.getByLabel('온라인 주사위 1',{exact:true})).toHaveAttribute('aria-pressed','true');
  for(const p of [page,guest]){await expect(p.locator('[data-round-supply] [data-goods-value]')).toHaveCount(4);await expect(p.locator('.estate-heading').first()).toContainText('비공식 연습 보드');}
  const before=await current();await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();await expect.poll(async()=>(await current()).players[0].workers).toBe(before.players[0].workers+2);await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(async()=>(await current()).players[0].workers).toBe(before.players[0].workers);
  await page.getByLabel('온라인 주사위 1',{exact:true}).click();await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();await expect.poll(async()=>(await current()).players[0].workers).toBe(before.players[0].workers+2);const committed=await current();
  await page.locator('.online-estates').scrollIntoViewIfNeeded();const sticky=await page.locator('.online-controls').boundingBox();expect(sticky!.y).toBeGreaterThanOrEqual(-1);expect(sticky!.y).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath('online-sticky.png')});
  await page.getByRole('button',{name:'다른 방 선택',exact:true}).click();await page.getByRole('button',{name:'기존 게임으로 돌아가기',exact:true}).click();await expect(page.getByLabel('공유할 방 코드')).toHaveValue(owner.id);await expect(page.getByLabel('온라인 주사위 1',{exact:true})).toBeDisabled();expect((await current()).revision).toBe(committed.revision);
  await page.reload();await guest.reload();await expect(page.getByLabel('공유할 방 코드')).toHaveValue(owner.id);await expect(guest.getByLabel('공유할 방 코드')).toHaveValue(owner.id);await expect.poll(async()=>guest.locator('.online-player').first().textContent()).toContain(`일꾼${committed.players[0].workers}`);expect((await current()).players).toEqual(committed.players);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect.poll(async()=>(await current()).players[0].workers).toBe(before.players[0].workers);await page.locator('.online-estates').first().screenshot({path:info.outputPath('online-boards.png')});
 }finally{await peer.close();await server.close();}
});

test('15 fixes: vineyard reward clicks never fall through to a paid black purchase',async({page})=>{
 const game=blackVineFixture();await local(page,game);const black=game.market.blackDepot.find(Boolean)!;
 const target=page.locator(`[data-black-depot] [data-tile-id="${black}"]`);await expect(target).toHaveAttribute('aria-disabled','false');await target.click();
 await expect.poll(async()=>(await state(page)).players[0].storage).toContain(black);const after=await state(page);expect(after.players[0].silver).toBe(game.players[0].silver);expect(after.turn.blackPurchaseUsed).toBe(game.turn.blackPurchaseUsed);expect(after.market.blackDepot).not.toContain(black);
});
test('15 fixes: a typed vineyard reward disables unrelated black tiles while explicit buying remains available',async({page})=>{
 let game=vineFixture();const id=game.vineyards!.bag[0];game={...game,vineyards:{...game.vineyards!,bag:game.vineyards!.bag.slice(1)},players:game.players.map((p,i)=>i?p:{...p,vineyardReserve:[{tileId:id,keys:[0,1]}]})};
 const options=listCoreActionOptions(game,'seat-1');expect(options.ok).toBeTruthy();if(!options.ok)return;const placed=applyCoreAction(game,options.value.actions.find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.slotId==='V02')!);expect(placed.ok).toBeTruthy();if(!placed.ok)return;game=placed.value.state;await local(page,game);
 const target=page.locator(`[data-black-depot] [data-tile-id="${game.market.blackDepot.find(Boolean)!}"]`);await expect(target).toHaveAttribute('aria-disabled','true');await target.dispatchEvent('click');expect(await state(page)).toEqual(game);
 await page.getByLabel('추가 행동',{exact:true}).click();await page.getByText('보드에서 은화 구매 선택',{exact:true}).click();await expect(target).toHaveAttribute('aria-disabled','false');await expect(page.getByLabel('현재 행동 안내',{exact:true})).toContainText('은화 2개');await target.click();await expect.poll(async()=>(await state(page)).players[0].silver).toBe(game.players[0].silver-2);expect((await state(page)).turn.pendingChoice).not.toBeNull();
});

test('monastery6 explicit selection preserves its numbered-building restriction and worker cost',async({page})=>{
 const monastery={type:'monastery',number:6,back:'matching-color'} as const;const g=placed(vineFixture(),0,monastery);await local(page,g);await page.getByLabel('추가 행동',{exact:true}).click();await page.getByText('수도원6 · 일꾼2 건물 획득',{exact:true}).click();
 for(const id of g.market.blackDepot.filter(Boolean))await expect(page.locator(`[data-black-depot] [data-tile-id="${id}"]`)).toHaveAttribute('aria-disabled','true');
 const building=g.market.numberedDepots.flatMap(d=>d.slots).find(s=>s.tileId&&g.tiles[s.tileId].type==='building')!.tileId!;await page.locator(`[data-depot] [data-tile-id="${building}"]`).click();await expect.poll(async()=>(await state(page)).players[0].storage).toContain(building);const after=await state(page);expect(after.players[0].workers).toBe(g.players[0].workers-2);expect(after.players[0].silver).toBe(g.players[0].silver);expect(after.dice).toEqual(g.dice);expect(after.turn.monasterySixUsed).toBe(true);
});

test('vineyard shop distinguishes the free reward from an explicit silver purchase',async({page})=>{
 const g=blackVineFixture(),saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 for(const paid of [false,true]){
  if(!paid)await local(page,g);else{await page.evaluate(s=>localStorage.setItem('burgundy-expanded:local-v1',s),saved);await page.reload();await page.getByLabel('추가 행동',{exact:true}).click();await page.getByText('보드에서 은화 구매 선택',{exact:true}).click();}
  await page.getByRole('button',{name:`포도 상점 ${g.vineyards!.store[0]}`,exact:true}).click();await expect.poll(async()=>(await state(page)).players[0].vineyardReserve?.length??0).toBe(1);const after=await state(page);expect(after.players[0].silver).toBe(g.players[0].silver-(paid?2:0));expect(after.turn.blackPurchaseUsed).toBe(paid);expect(after.dice).toEqual(g.dice);if(paid)expect(after.turn.pendingChoice!.id).toBe(g.turn.pendingChoice!.id);else expect(after.turn.pendingChoice?.id).not.toBe(g.turn.pendingChoice!.id);
 }
});
