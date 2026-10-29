import {test,expect,type Page} from '@playwright/test';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction} from '../../src/game/core';
import {serializeSavedGame} from '../../src/game/save';
import {VINE_SLOTS} from '../../src/game/vineyards';
import {CUSTOM_TRADE_CATALOG} from '../../src/game/custom-trade-routes';
import {vineCenter,vinePoints} from '../../src/app/vineyard-board';
import manifest from '../../public/assets/effects/manifest.json';
import {rewardDieOverlaps} from './reward-geometry';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isolatedRooms} from './isolated-rooms';
import {beginHistory} from '../../src/game/turn-history';

function fixture(){
 const setup=createPracticeSession({names:['아이콘1','아이콘2'],seed:'reward-effects',boardIds:['se:base:2','se:base:2'],vineyards:true,tradeRoutes:true,officialSlots:true});
 const result=applyCoreAction(setup,{type:'roll-round',playerId:'seat-1'});if(!result.ok)throw Error('fixture');
 const g=result.value.state;
 return {...g,tradeRoutes:{...g.tradeRoutes!,routes:{'seat-1':{tileIds:['8','7','1','2','3'],sales:[]},'seat-2':{tileIds:['4','5','6','9','10'],sales:[]}},unusedTileIds:['11','12']}};
}
async function load(page:Page){
 const game=fixture(),saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{if(!sessionStorage.getItem('reward-fixture')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('reward-fixture','1');}},saved);
 await page.goto('/');await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 return game;
}
const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);

test('approved reward files are shared by all 24 vineyard cells and the unchanged trade catalog',async({page},info)=>{
 const game=await load(page),estate=page.locator('.estate-panel').first(),vine=estate.locator('.vineyard-personal'),trade=estate.locator('.trade-route-panel');
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await trade.getByRole('button',{name:'전체 무역로 펼치기',exact:true}).click();
 await expect(trade.locator('[data-trade-card]')).toHaveCount(5);await expect(trade.locator('[data-trade-cell]')).toHaveCount(15);
 expect(CUSTOM_TRADE_CATALOG).toHaveLength(12);expect(CUSTOM_TRADE_CATALOG.every(c=>c.spaces.length===3)).toBe(true);
 await expect(vine.locator('[data-reward-effect]')).toHaveCount(24);await expect(vine.locator('.vineyard-bonus')).toHaveCount(0);
 for(const slot of VINE_SLOTS){
  const s=vine.locator(`[data-vine-slot="${slot.id}"]`),[a,b]=slot.cells.map(c=>vineCenter(c.q,c.r));
  await expect(s.locator('[data-white-die]')).toHaveCount(1);
  await expect(s.locator('[data-white-die]')).toHaveAttribute('data-white-die',String(slot.value));
  await expect(s.locator('[data-white-die] circle')).toHaveCount(slot.value);
  await expect(s.locator('[data-white-die]')).toHaveAttribute('transform',`translate(${(a.x+b.x)/2} ${(a.y+b.y)/2}) scale(${16/28})`);
  for(const [i,c]of slot.cells.entries()){
   const cell=s.locator('[data-vine-cell]').nth(i);await expect(cell.locator('.vineyard-cell')).toHaveAttribute('points',vinePoints(c.q,c.r));
   await expect(cell.locator('[data-reward-effect]')).toHaveAttribute('data-reward-effect',c.bonus);
  }
 }
 const keys=new Set<string>();
 for(const cell of await trade.locator('[data-trade-cell]').all()){
  const index=Number(await cell.getAttribute('data-trade-cell')),card=CUSTOM_TRADE_CATALOG.find(c=>c.id===game.tradeRoutes.routes['seat-1'].tileIds[Math.floor(index/3)])!,reward=card.spaces[index%3].bonusId as keyof typeof manifest.rewardMap;
  keys.add(reward);await expect(cell.locator('[data-reward-effect]')).toHaveAttribute('data-effect-asset',`${manifest.rewardMap[reward]}.png`);
  await expect(cell.locator('[data-goods-value]')).toHaveAttribute('data-goods-value',String(card.spaces[index%3].goodsType));
  const size=await cell.boundingBox();expect(size!.width).toBe(101);
  const overflow=await cell.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('[data-reward-effect]')!.getBoundingClientRect();return b.left<a.left||b.right>a.right||b.top<a.top||b.bottom>a.bottom;});expect(overflow).toBe(false);
 }
 expect(keys.size).toBe(9);
 // The actual opaque artwork, rather than its intentionally padded PNG canvas, must clear the die.
 expect(await rewardDieOverlaps(vine)).toEqual([]);
 for(const a of Object.values(manifest.assets)){const r=await page.request.get(`/assets/effects/${a.file}`);expect(r.ok()).toBe(true);expect((await r.body()).length).toBeGreaterThan(100);}
 const urls=await page.locator('[data-reward-effect] image').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 for(const design of [false,true]){
  await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await page.getByRole('switch',{name:'디자인 1',exact:true}).setChecked(design);await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
  expect(await page.locator('[data-reward-effect] image').evaluateAll(es=>es.map(e=>e.getAttribute('href')))).toEqual(urls);
  for(const zoom of [1,1.6,2]){
   await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
   await vine.screenshot({path:info.outputPath(`vineyard-${design?'on':'off'}-${zoom}.png`)});
   await trade.screenshot({path:info.outputPath(`trade-${design?'on':'off'}-${zoom}.png`)});
  }
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 if(info.project.name==='desktop-1280'){
  const viewport=page.viewportSize()!;await page.setViewportSize({width:1884,height:1080});
  await trade.screenshot({path:info.outputPath('trade-all-five.png')});await page.setViewportSize(viewport);
 }
 await trade.getByRole('button',{name:'무역로 접기',exact:true}).click();await expect(trade.locator('[data-trade-card]')).toHaveCount(1);
 expect(await current(page)).toEqual(game);await page.reload();expect(await current(page)).toEqual(game);
 await expect(vine.locator('[data-reward-effect]')).toHaveCount(24);expect(failures).toEqual([]);
});

test('occupied supply outlines stay solid only on interaction; empty slots and take undo survive',async({page},info)=>{
 const game=await load(page),board=page.getByRole('region',{name:'공용 공급처 보드',exact:true}),svg=board.locator('.common-board-svg');
 await page.mouse.move(0,0);
 const outlines=await board.locator('.supply-art-tile .supply-selection').evaluateAll(es=>es.map(e=>({stroke:getComputedStyle(e).stroke,dash:getComputedStyle(e).strokeDasharray})));
 expect(outlines.length).toBeGreaterThan(0);expect(outlines.every(s=>s.dash==='none'&&s.stroke==='rgba(0, 0, 0, 0)')).toBe(true);
 await expect(svg).toHaveAttribute('viewBox','0 0 950 1030');
 await expect(svg.locator('[data-board-flourish]')).toHaveAttribute('transform','scale(1.484375 1.609375)');
 const positions=await board.locator('[data-supply-hit]').evaluateAll(es=>es.map(e=>e.getAttribute('points')));
 for(const zoom of [1,1.6,2]){await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await board.screenshot({path:info.outputPath(`common-${zoom}.png`)});}
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 const tile=board.locator('.supply-art-tile.direct-legal').first(),id=await tile.getAttribute('data-tile-id');expect(id).toBeTruthy();
 await expect(tile.locator('.supply-selection')).toHaveCSS('stroke-dasharray','none');
 await tile.focus();await expect(tile.locator('.supply-selection')).not.toHaveCSS('stroke','rgba(0, 0, 0, 0)');
 if(info.project.use.hasTouch)await tile.tap();else await tile.click();
 await expect.poll(async()=>(await current(page)).players[0].storage).toContain(id);
 await expect(board.locator(`[data-tile-id="${id}"]`)).toHaveCount(0);
 expect(await board.locator('polygon[stroke-dasharray="3 3"]').count()).toBeGreaterThan(0);
 await board.screenshot({path:info.outputPath('common-empty-slot.png')});
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();expect(await current(page)).toEqual(game);
 expect(await board.locator('[data-supply-hit]').evaluateAll(es=>es.map(e=>e.getAttribute('points')))).toEqual(positions);
 await expect(board.locator(`[data-tile-id="${id}"] .supply-selection`)).toHaveCSS('stroke-dasharray','none');
});

test('two online seats keep reward art and the real vineyard placement/reload/undo state in sync',async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile});
 try{
  const seat=await(await fetch(`${server.url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'보상A',vineyards:true,tradeRoutes:true})})).json();
  const other=await(await fetch(`${server.url}/api/rooms/${seat.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'보상B'})})).json();
  const file=join(server.directory,`${seat.id}.json`),room=JSON.parse(await readFile(file,'utf8')),base=fixture();
  const g={...base,revision:room.game.revision+10,dice:{...base.dice,players:{...base.dice.players,'seat-1':[{...base.dice.players['seat-1'][0],value:1 as const},{...base.dice.players['seat-1'][1],value:4 as const}] as const}}};
  room.game=g;room.history=beginHistory(g,[],true);room.logs=[];await writeFile(file,JSON.stringify(room));
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async r=>{const q=r.request(),response=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
   await context.routeWebSocket('**/api/rooms/*/live',ws=>ws.close());
  }
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),seat);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),other);
  const guest=await peer.newPage();await page.goto('/online');await guest.goto(page.url());
  const vine=page.locator('.vineyard-personal').first(),peerVine=guest.locator('.vineyard-personal').first(),supply=page.getByRole('region',{name:'공용 포도 공급처',exact:true});
  await expect(vine.locator('[data-reward-effect]')).toHaveCount(24);await expect(peerVine.locator('[data-reward-effect]')).toHaveCount(24);
  await page.getByLabel('온라인 주사위 1',{exact:true}).click();await supply.locator('[data-vine-supply-kind="depot"] button:enabled').first().click();
  const state=()=>readFile(file,'utf8').then(s=>JSON.parse(s).game);
  await expect.poll(async()=>(await state()).players[0].vineyardReserve?.length).toBe(1);
  const taken=await state(),tile=taken.players[0].vineyardReserve[0].tileId;
  await page.getByLabel('온라인 주사위 2',{exact:true}).click();await vine.getByRole('button',{name:`보관 포도 ${tile}`,exact:true}).click();await vine.locator('[data-vine-slot=V01]').click();
  await expect(vine.locator('[data-vine-slot=V01] [data-reward-effect]')).toHaveCount(0);expect(await state()).toEqual(taken);
  await vine.getByRole('button',{name:'돌려서 배치',exact:true}).click();expect(await state()).toEqual(taken);
  await vine.getByRole('button',{name:'포도 배치 확정',exact:true}).click();await expect(vine.locator('[data-vine-slot=V01]')).toHaveAttribute('data-occupied','true');
  await expect(peerVine.locator('[data-vine-slot=V01]')).toHaveAttribute('data-occupied','true');
  await page.reload();await guest.reload();await expect(vine.locator('[data-reward-effect]')).toHaveCount(22);await expect(peerVine.locator('[data-reward-effect]')).toHaveCount(22);
  await vine.screenshot({path:info.outputPath('online-vineyard.png')});await page.locator('.trade-route-panel').first().screenshot({path:info.outputPath('online-trade.png')});
  const placed=await state();
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(state).toEqual({...taken,revision:placed.revision+1});await expect(peerVine.locator('[data-reward-effect]')).toHaveCount(24);
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(state).toEqual({...g,revision:placed.revision+2});await guest.reload();await expect(peerVine.locator('[data-reward-effect]')).toHaveCount(24);
  const restored=await state();for(let i=0;i<4;i++)await vine.getByRole('button',{name:'아이콘1 포도밭 확대',exact:true}).click();
  await expect(vine.locator('.vineyard-svg')).toHaveAttribute('style',/width:\s*200%/);
  await vine.screenshot({path:info.outputPath('online-vineyard-zoom-200-left.png')});
  await vine.locator('.live-board-scroll').evaluate(e=>e.scrollLeft=e.scrollWidth);
  await vine.screenshot({path:info.outputPath('online-vineyard-zoom-200-right.png')});expect(await state()).toEqual(restored);
 }finally{await peer.close();await server.close();}
});
