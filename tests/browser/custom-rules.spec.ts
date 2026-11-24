import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serializeSavedGame} from '../../src/game/save';
import {beginHistory} from '../../src/game/turn-history';
import {serializeTurnHistory} from '../../src/game/turn-history-cache';
import {boardTarget,directActions} from '../../src/game/direct-actions';
import {settleShieldState} from '../../src/game/core/shield-effects';
import {shieldLayout} from '../../src/game/shields';
import {boundary,choose,step} from '../fixtures/shields';
import {customGame,customMount,moveTile,officialTerritory} from '../fixtures/custom-rules';
import {isolatedRooms} from './isolated-rooms';
import type {GameState,GameAction} from '../../src/game/types';

const active=()=>'.estate-panel[data-player-id="seat-1"]';
const current=(p:Page):Promise<GameState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
async function press(target:Locator){if(await target.page().evaluate(()=>navigator.maxTouchPoints>0))await target.tap();else await target.click();}
async function load(page:Page,game:GameState){
 await page.goto('/');
 await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));
 const save=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{hotseat:true,zoom:1,focus:false,table:true,boardZooms:{}},undo:serializeTurnHistory(game,[],beginHistory(game,[],true))});
 await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'custom-rules.json',mimeType:'application/json',buffer:Buffer.from(save)});
 await expect.poll(()=>current(page)).toEqual(game);
}
function nextPhase(game:GameState){
 const a:GameAction={type:'advance-phase',playerId:'seat-1'};
 let n=step(boundary(game),a);
 for(let i=0;i<30&&n.turn.pendingChoice;i++){
  const options=n.turn.pendingChoice.options;
  const first=options.find(o=>o.id.startsWith('remove:'))??options.find(o=>o.id==='skip')??options[0];
  n=choose(n,o=>o.id===first.id);
 }
 return n.turn.stage==='phase-end'?step(n,a):n;
}

test('monastery 31 previews the historical refund, cancels, persists and undoes',async({page},info)=>{
 const {game,a,target,region}=officialTerritory();await load(page,game);
 await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
 await press(page.getByRole('button',{name:'영지에서 빈 칸 선택',exact:true}));
 await press(page.locator(`${active()} [data-estate-cell="${target.id}"]`));
 await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
 await expect(page.getByText(/기존 지역 완성 점수 13점 반납/)).toBeVisible();
 if(info.project.name==='desktop-1280')await page.locator('.custom-board-actions').screenshot({path:info.outputPath('monastery-31-refund.png')});
 await press(page.getByRole('button',{name:'색상 변경 취소',exact:true}));
 expect(await current(page)).toEqual(game);
 if(!await page.getByLabel('변경할 빈 영지 칸',{exact:true}).isVisible())await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
 await page.getByLabel('변경할 빈 영지 칸',{exact:true}).selectOption(target.id);
 await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
 await press(page.getByRole('button',{name:'색상 변경 확정',exact:true}));
 const after=step(game,a);
 await expect.poll(()=>current(page)).toEqual(after);
 await page.reload();
 await expect.poll(()=>current(page)).toEqual(after);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));
 await expect.poll(()=>current(page)).toEqual(game);
});

test('the added slot stays beside the original with one backdrop and both empty silhouettes',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off'));
 const a=customGame(),b=nextPhase(a),slot=shieldLayout(b)!.slots.find(s=>s.index===1)!;
 const group=page.locator(`[data-shield-depot="${slot.depot}"]`),j=(n:number)=>group.locator(`[data-shield-slot="shield:depot:${slot.depot}:${n}"]`);
 await load(page,a);
 await expect(group.locator('[data-shield-slot]')).toHaveCount(1);
 const start=await j(0).getAttribute('transform');
 const n0=shieldLayout(b)!.slots.find(s=>s.depot===slot.depot&&s.index===0)!.shieldNumber!;
 const started=step(b,{type:'roll-round',playerId:'seat-1'});
 for(const [name,game,empty] of [
  ['initial-empty',customMount(a,n0),1],
  ['expanded',started,0],
  ['empty-and-new',customMount(started,n0),1],
  ['both-empty',customMount(customMount(started,n0),slot.shieldNumber!),2],
 ] as const){
  await load(page,game);
  await expect(group.locator('[data-shield-zone]')).toHaveCount(1);
  await expect(group.locator('[data-empty=true]')).toHaveCount(empty);
  await expect(j(0)).toHaveAttribute('transform',start!);
  if(name!=='initial-empty'){
   await expect(group.locator('[data-shield-horizontal=true]')).toHaveCount(1);
   const [left,right]=await Promise.all([j(0).locator('.shield-outline').boundingBox(),j(1).locator('.shield-outline').boundingBox()]);
   expect(Math.abs(left!.x-right!.x)).toBeGreaterThan(left!.width);
   const translateY=async(slot:Locator)=>(await slot.getAttribute('transform'))?.match(/translate\([^ ]+ ([^ )]+)/)?.[1];
   expect(await translateY(j(0))).toBe(await translateY(j(1)));
  }
  await group.scrollIntoViewIfNeeded();
  await group.screenshot({path:info.outputPath(`shields-${name}.png`)});
  if(name==='expanded'&&info.project.name==='desktop-1280')await page.locator('.common-board-svg').screenshot({path:info.outputPath('common-board-phase-b.png')});
 }
});

test('three-seat side additions clear numbered tiles at regular and larger zooms',async({page},info)=>{
 let game=customGame(3);
 for(let i=0;i<3;i++)game=nextPhase(game);
 game=step(game,{type:'roll-round',playerId:'seat-1'});
 await load(page,game);
 for(const zoom of [100,160,200]){
  const panel=page.locator('.common-board-panel');
  const displayed=panel.locator('.common-board-toolbar button').filter({hasText:/^\d+%$/});
  for(let i=0;i<6&&Number((await displayed.textContent())?.trim().slice(0,-1))<zoom;i++)
   await press(panel.getByRole('button',{name:'공용 보드 확대',exact:true}));
  await expect(displayed).toHaveText(`${zoom}%`);
  for(const depot of [3,5]){
   const shield=panel.locator(`[data-shield-slot="shield:depot:${depot}:1"] .shield-outline`);
   await expect(shield).toBeVisible();
   const bounds=(await shield.boundingBox())!;
   const hits=await panel.locator(`[data-depot="${depot}"] [data-supply-hit]`).evaluateAll(list=>list.map(e=>{
    const {x,y,width,height}=e.getBoundingClientRect();return {x,y,width,height};
   }));
   expect(hits.every(hit=>bounds.x+bounds.width<=hit.x||hit.x+hit.width<=bounds.x||bounds.y+bounds.height<=hit.y||hit.y+hit.height<=bounds.y)).toBe(true);
  }
  if(info.project.name==='android-landscape'){
   const group=panel.locator('[data-shield-depot="3"]');
   await group.scrollIntoViewIfNeeded();await group.screenshot({path:info.outputPath(`three-seat-shields-${zoom}.png`)});
  }
 }
});

test('shield 20 reserves a board tile and 21 purchases a chosen rival tile',async({page},info)=>{
 let game=customMount(customMount(customGame(),20),21);
 const rival=moveTile(game,t=>t.type==='mine',undefined,1);game=rival.game;
 const tile=game.market.blackDepot.find(Boolean)!;
 await load(page,game);
 await press(page.getByRole('button',{name:'방패 20번 · 공용 타일 찜',exact:true}));
 const mark=page.locator(`.common-board-panel [data-tile-id="${tile}"]`);
 await press(mark);await expect(mark.locator('[data-reserved-by="seat-1"]')).toHaveCount(1);
 if(info.project.name==='desktop-1280')await mark.screenshot({path:info.outputPath('reserved-tile.png')});
 await press(page.getByText('방패 21번 · 상대 저장고 구매',{exact:true}));
 await press(page.getByRole('button',{name:/왕실B의 광산 선택/}));
 await press(page.getByRole('button',{name:'구매 확정',exact:true}));
 await expect.poll(async()=>(await current(page)).players[0].storage).toContain(rival.tileId);
 expect((await current(page)).players[1].silver).toBe(game.players[1].silver+2);
});

test('three action dice, six goods stacks and four storage keys render together',async({page},info)=>{
 let game=customMount(customMount(customGame(),22),23);
 const p=game.players[0],cellId=p.duchy.cells.find(c=>c.terrain==='monastery')!.id;
 game=settleShieldState(moveTile(game,t=>t.type==='monastery'&&t.number===32,cellId).game);
 game={...game,players:game.players.map((p,i)=>i?p:{...p,goods:([1,2,3,4,5,6] as const).map(type=>({type,tiles:[{id:'browser-goods:'+type,type}]}))}),
  dice:{...game.dice,players:{...game.dice.players,[p.id]:[game.dice.players[p.id][0],game.dice.players[p.id][1],{id:p.id+':c',value:4,used:false}]}}};
 await load(page,game);
 const estate=page.locator(active());
 await expect(estate.locator('.estate-dice button')).toHaveCount(3);
 await expect(estate.locator('.goods-storage-slot')).toHaveCount(6);
 await expect(estate.locator('.estate-keyspaces button')).toHaveCount(4);
 if(info.project.name==='desktop-1280')await estate.screenshot({path:info.outputPath('expanded-player-inventory.png')});
});

test('both online seats see only committed province changes and Undo restores the same region',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});
 const other=await peer.newPage();
 try{
  const req=(body:object)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const owner=await (await fetch(server.url+'/api/rooms',req({name:'왕실A'}))).json();
  const guest=await (await fetch(`${server.url}/api/rooms/${owner.id}/join`,req({name:'왕실B'}))).json();
  const {game,a,target,region}=officialTerritory(),path=join(server.directory,owner.id+'.json');
  const room=JSON.parse(await readFile(path,'utf8'));room.game=game;room.logs=[];room.history=beginHistory(game,[],true);await writeFile(path,JSON.stringify(room));
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async route=>{
    const q=route.request();const r=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});
    await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
   });
   await context.routeWebSocket('**/api/rooms/*/live',()=>{});
  }
  for(const [p,seat] of [[page,owner],[other,{id:owner.id,token:guest.token}]] as const){
   await p.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),seat);
   await p.goto('/online');
   await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
  }
  expect(directActions(game,'seat-1').some(x=>boardTarget(game,x).recolor?.refund===13)).toBe(true);
  await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
  await page.getByLabel('변경할 빈 영지 칸',{exact:true}).selectOption(target.id);
  await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
  await expect(page.getByText(/13점 반납/)).toBeVisible();
  expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(game);
  await press(page.getByRole('button',{name:'색상 변경 확정',exact:true}));
  const expected=step(game,a);
  await expect(other.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(expected.revision));
  expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(expected);
  await page.reload();
  await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));
  await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).game.players[0].duchy).toEqual(game.players[0].duchy);
  await expect(other.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(expected.revision+1));
 }finally{
  try{await Promise.all([page.goto('about:blank'),other.goto('about:blank')]);await peer.close();}
  finally{await server.close();}
 }
});
