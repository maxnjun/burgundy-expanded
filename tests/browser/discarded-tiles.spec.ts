import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {discardBoundary,discardStep} from '../fixtures/discarded-tiles';
import {boundary} from '../fixtures/shields';
import {serializeSavedGame} from '../../src/game/save';
import {createPracticeSession} from '../../src/game/practice';
import type {GameState} from '../../src/game/types';
import {isolatedRooms} from './isolated-rooms';

const envelope=(game:GameState)=>({format:'burgundy-local-v1' as const,randomAlgorithm:'counter-v1' as const,game,logs:['폐기 기록 검증'],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game as GameState);
async function load(page:Page,game:GameState){
 await page.addInitScript(s=>{if(!sessionStorage.getItem('discard-fixture')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('discard-fixture','1');}},serializeSavedGame(envelope(game)));
 await page.goto('/');await expect.poll(async()=>(await current(page)).turn.stage).toBe('player-turn');
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
}
const advance=(g:GameState)=>discardStep(g,{type:'advance-phase',playerId:'seat-1'});

test('local phase history uses real images, folds independently and survives export import reload and the next phase',async({page},info)=>{
 const game=advance(discardBoundary());await load(page,game);
 const panel=page.locator('details.discarded-tiles'),log=page.locator('details.compact-log').filter({hasText:'행동과 점수 기록'}),a=game.discardedTiles![0];
 await expect(panel).not.toHaveAttribute('open','');await expect(panel.locator('summary')).toHaveText('버려진 타일 · 총 3개');
 expect(await panel.evaluate(e=>e.previousElementSibling?.classList.contains('compact-log'))).toBe(true);
 await log.locator('summary').click();await panel.locator('summary').click();await log.locator('summary').click();await expect(panel).toHaveAttribute('open','');await expect(log).not.toHaveAttribute('open','');
 await expect(panel.locator('[data-discard-phase]')).toHaveCount(1);await expect(panel.locator('h3')).toHaveText('A 페이즈 — 3개');await expect(panel.locator('[data-discarded-tile]')).toHaveCount(3);
 const before=await current(page);await expect(panel.locator('button,input,[draggable=true]')).toHaveCount(0);
 for(const id of a.tileIds){const tile=game.tiles[id],art=panel.locator(`[data-discarded-tile="${id}"] svg`).first();await expect(art).toBeVisible();if(tile.type==='monastery')await expect(art.locator('image')).toHaveAttribute('href',new RegExp(`monastery-${String(tile.number).padStart(2,'0')}\\.png`));}
 await panel.locator('[data-discarded-tile]').first().click();expect(await current(page)).toEqual(before);
 for(const zoom of [1,1.6,2]){await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await panel.screenshot({path:info.outputPath(`discarded-${zoom}.png`)});}
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 expect(await panel.locator('.discarded-tile-list').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'저장 파일 내보내기',exact:true}).click();const exported=JSON.parse(await readFile((await (await download).path())!,'utf8'));expect(exported.game.discardedTiles).toEqual(game.discardedTiles);
 const endB=boundary(exported.game);await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'next-phase.json',mimeType:'application/json',buffer:Buffer.from(serializeSavedGame(envelope(endB)))});
 await expect.poll(async()=>(await current(page)).discardedTiles?.map(p=>p.phase)).toEqual(['A','B']);expect((await current(page)).discardedTiles![0]).toEqual(a);
 const history=(await current(page)).discardedTiles;await page.reload();await expect(panel).not.toHaveAttribute('open','');await panel.locator('summary').click();await expect(panel.locator('[data-discard-phase]')).toHaveCount(2);expect((await current(page)).discardedTiles).toEqual(history);
 await panel.screenshot({path:info.outputPath('discarded-two-phases.png')});
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();await expect(panel.locator('summary')).toHaveText('버려진 타일 · 총 0개');await expect(panel.locator('[data-discard-phase]')).toHaveCount(0);
});

test('legacy missing history and an empty completed phase show no invented old records',async({page},info)=>{
 const {discardedTiles:ignored,...old}=createPracticeSession({names:['old1','old2'],seed:'old'});void ignored;await load(page,old);
 const panel=page.locator('details.discarded-tiles');await panel.locator('summary').click();await expect(panel).toContainText('아직 버려진 타일이 없습니다.');await expect(panel.locator('[data-discard-phase]')).toHaveCount(0);
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from(serializeSavedGame(envelope(advance(discardBoundary(0)))))});
 await expect(panel.locator('h3')).toHaveText('A 페이즈 — 0개');await expect(panel.locator('[data-discarded-tile]')).toHaveCount(0);await panel.screenshot({path:info.outputPath('discarded-empty.png')});
});

test('both online seats receive public discarded faces and vines, reconnect, and ordinary Undo preserves phase history',async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport,hasTouch:info.project.use.hasTouch,isMobile:info.project.use.isMobile});
 try{
  const owner=await(await fetch(server.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A'})})).json(),other=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'B'})})).json();
  const file=join(server.directory,owner.id+'.json'),room=JSON.parse(await readFile(file,'utf8'));room.game=discardBoundary(3,true);room.logs=[];await writeFile(file,JSON.stringify(room));
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async r=>{const q=r.request(),response=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
   await context.routeWebSocket('**/api/rooms/*/live',ws=>ws.close());
  }
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),other);
  const guest=await peer.newPage();await page.goto('/online');await guest.goto(page.url());
  const panel=page.locator('details.discarded-tiles'),peerPanel=guest.locator('details.discarded-tiles');await expect(panel).not.toHaveAttribute('open','');await expect(panel.locator('[data-discard-phase]')).toHaveCount(0);
  await page.getByRole('button',{name:'단계 진행',exact:true}).click();
  for(const p of [panel,peerPanel]){await p.locator('summary').click();await expect(p.locator('[data-discarded-tile]')).toHaveCount(3);await expect(p.locator('[data-discarded-vine]')).toHaveCount(4);await expect(p.locator('h3')).toHaveText('A 페이즈 — 7개');}
  expect(await panel.locator('image').evaluateAll(es=>es.map(e=>e.getAttribute('href')))).toEqual(await peerPanel.locator('image').evaluateAll(es=>es.map(e=>e.getAttribute('href'))));
  const history=JSON.parse(await readFile(file,'utf8')).game.discardedTiles;await expect(page.getByRole('button',{name:'이전 행동으로',exact:true})).toBeDisabled();
  const log=page.locator('details.compact-log').filter({has:page.locator('.online-logs')});await log.locator('summary').click();await expect(panel).toHaveAttribute('open','');
  await page.getByRole('button',{name:'주사위 굴리기',exact:true}).click();await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();
  expect(JSON.parse(await readFile(file,'utf8')).game.discardedTiles).toEqual(history);await page.reload();await guest.reload();
  for(const p of [panel,peerPanel]){await expect(p).not.toHaveAttribute('open','');await p.locator('summary').click();await expect(p.locator('[data-discarded-tile]')).toHaveCount(3);await expect(p.locator('[data-discarded-vine]')).toHaveCount(4);}
  await panel.screenshot({path:info.outputPath('online-discarded.png')});
 }finally{await peer.close();await server.close();}
});
