import {test,expect,type Page,type Locator} from '@playwright/test';
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import manifest from '../../public/assets/vineyards/manifest.json';
import {vineFixture,layeredVineFixture} from '../fixtures/vineyards';
import {serializeSavedGame} from '../../src/game/save';
import {vineScore,type Grape} from '../../src/game/vineyards';
import {beginHistory} from '../../src/game/turn-history';
import type {GameState} from '../../src/game/types';
import {isolatedRooms} from './isolated-rooms';

async function press(target:Locator){if(await target.page().evaluate(()=>navigator.maxTouchPoints>0))await target.tap();else await target.click();}
async function unpin(page:Page){await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));}
const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game as GameState);
async function local(page:Page,game:GameState){
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{if(!sessionStorage.getItem('approved-vine-installed')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('approved-vine-installed','1');}},saved);
 await page.goto('/');await expect(page.locator('main')).toHaveAttribute('data-game-revision',String(game.revision));
}
// Conserves the existing 51 IDs; only their initial location is arranged for six-art visual QA.
function galleryFixture(){const g=vineFixture(),v=g.vineyards!,ids=['B-Y:1','G-O:1','K-R:1'],reserve='B-O:1';const pool=[...v.bag,...v.depots.map(d=>d.tileId!),...v.store].filter((id):id is string=>!!id&&!ids.includes(id)&&id!==reserve);return {...g,vineyards:{...v,depots:v.depots.map((d,i)=>({...d,tileId:ids[i]})),store:[pool[0]],bag:pool.slice(1)},players:g.players.map((p,i)=>i?p:{...p,vineyardReserve:[{tileId:reserve,keys:[0,1]}]})} as GameState;}

for(const zoom of [100,160,200])test(`approved vineyard fruit and candy assets, stable slots at ${zoom}%`,async({page},info)=>{
 const g=galleryFixture();await local(page,g);await unpin(page);await page.evaluate(z=>{document.documentElement.style.zoom=String(z/100);},zoom);
 const supply=page.getByRole('region',{name:'공용 포도 공급처',exact:true}),tiles=supply.locator('[data-vine-supply-kind=depot] .vine-tile-art');
 await expect(tiles).toHaveCount(3);await expect(tiles.locator('[data-white-die],text')).toHaveCount(0);await expect(supply.locator('.vineyard-depot-values [data-white-die]')).toHaveCount(6);
 for(const a of manifest.assets){
  const fruit=supply.locator(`[data-vineyard-fruit="${a.grape}"]`).first(),candy=supply.locator(`img[data-candy-token="${a.grape}"]`);
  await expect(fruit).toHaveAttribute('href',new RegExp(`${a.fruit.file}\\?v=${a.fruit.sha256.slice(0,12)}$`));await expect(candy).toHaveAttribute('src',new RegExp(a.candy.file));
  expect(await candy.evaluate(e=>(e as HTMLImageElement).complete&&(e as HTMLImageElement).naturalWidth===512)).toBe(true);
  expect(await fruit.evaluate(async e=>{const img=new Image();img.src=e.getAttribute('href')!;await img.decode();return img.naturalWidth;})).toBe(768);
  const f=(await fruit.boundingBox())!,c=(await candy.boundingBox())!;expect(c.width*480/512).toBeLessThan(f.width*(a.fruit.alphaBounds[2]-a.fruit.alphaBounds[0])/768);
  await expect(fruit).toHaveAttribute('data-fruit-illustration','true');await expect(fruit).toHaveAttribute('mask',/^url\(#.+\)$/);
 }
 const frames=await tiles.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width/e.getBoundingClientRect().height));for(const ratio of frames)expect(ratio).toBeCloseTo(100/57,2);
 await expect(tiles.first().locator('[data-vine-tile-frame]')).toHaveAttribute('stroke','#806d46');await expect(tiles.first().locator('path')).toHaveCount(1);
 const shape=await tiles.first().evaluate(svg=>{const b=(svg.querySelector('path') as SVGPathElement).getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height,centers:[...svg.querySelectorAll('[data-vineyard-fruit]')].map(e=>{const i=e as SVGImageElement;return i.x.baseVal.value+i.width.baseVal.value/2;})};});
 expect(shape.x+shape.width/2).toBeCloseTo(50,3);expect(shape.y+shape.height/2).toBeCloseTo(28.5,3);expect(shape.width/2).toBeCloseTo(48,3);expect(shape.centers[0]).toBeCloseTo(26,3);expect(shape.centers[1]).toBeCloseTo(74,3);
 const screenshot=await tiles.first().screenshot(),metadata=await sharp(screenshot).metadata();const pixel=await sharp(screenshot).extract({left:Math.round(metadata.width!*.49),top:Math.round(metadata.height!*.5),width:1,height:1}).removeAlpha().raw().toBuffer();
 for(const [i,value] of [216,224,187].entries())expect(Math.abs(pixel[i]-value)).toBeLessThanOrEqual(3);
 expect(await current(page)).toEqual(g);await supply.scrollIntoViewIfNeeded();await supply.screenshot({path:info.outputPath(`six-fruit-six-candy-${zoom}.png`)});
 if(zoom===100){const board=page.locator('.estate-panel').first();await board.screenshot({path:info.outputPath('storage-and-personal-board.png')});}
});

test('approved vineyard art follows preview, half-turn, reward, score, undo and reload',async({page},info)=>{
 const g=galleryFixture();await local(page,g);const board=page.getByRole('region',{name:'포도1 포도밭',exact:true});
 await press(page.getByRole('button',{name:/^행동 주사위 2 눈/}));await press(board.getByRole('button',{name:'보관 포도 B-O:1',exact:true}));const slot=board.locator('[data-vine-slot=V01]');await press(slot);
 const pair=async()=>slot.locator('[data-vineyard-fruit]').evaluateAll(es=>es.map(e=>e.getAttribute('data-vineyard-fruit')));
 expect(await pair()).toEqual(['B','O']);expect(await current(page)).toEqual(g);await press(board.getByRole('button',{name:'돌려서 배치',exact:true}));expect(await pair()).toEqual(['O','B']);expect(await current(page)).toEqual(g);
 await board.screenshot({path:info.outputPath('fruit-half-turn-preview.png')});await press(board.getByRole('button',{name:'포도 배치 확정',exact:true}));await expect(slot).toHaveAttribute('data-occupied','true');expect(await pair()).toEqual(['O','B']);
 await expect(slot.locator('[data-white-die],text')).toHaveCount(0);expect((await current(page)).players[0].vineyardReserve).toHaveLength(0);await page.reload();await expect(slot).toHaveAttribute('data-occupied','true');expect(await pair()).toEqual(['O','B']);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect(slot).not.toHaveAttribute('data-occupied','true');expect((await current(page)).players).toEqual(g.players);
});

test('approved candy reward and connected score use saved IDs without changing rules',async({page},info)=>{
 const g=layeredVineFixture(true,4);await local(page,g);const panel=page.getByRole('region',{name:'타일 효과 선택',exact:true}),choice=panel.locator('button:has([data-candy-token])').first(),grape=await choice.locator('[data-candy-token]').getAttribute('data-candy-token');
 await expect(choice).toBeVisible();await panel.screenshot({path:info.outputPath('candy-reward.png')});await press(choice);await expect.poll(async()=>(await current(page)).vineyards!.players['seat-1'].tokens.length).toBe(g.vineyards!.players['seat-1'].tokens.length+1);
 const after=await current(page);expect(after.vineyards!.players['seat-1'].tokens.at(-1)).toBe(grape);await expect(page.locator(`[data-candy-stock="${grape}"] b`)).toHaveText(`×${after.vineyards!.pool[grape as Grape]}`);const board=page.locator('.estate-panel').first();await press(board.getByRole('button',{name:'포도1 점수판 다음 페이지',exact:true}));
 await expect(board.locator('[data-vine-score]')).toHaveAttribute('data-vine-score',String(vineScore(after.vineyards!,'seat-1')));await expect(board.locator('.score-pages [data-candy-token]')).toHaveCount(6);await expect(board.locator('.vineyard-personal [data-vineyard-fruit]')).toHaveCount(after.vineyards!.players['seat-1'].placed.length*2);
 const fruit=board.locator('.vineyard-personal [data-vineyard-fruit]').first(),id=await fruit.getAttribute('data-vineyard-fruit'),asset=manifest.assets.find(a=>a.grape===id)!;
 const width=(await fruit.boundingBox())!.width*(asset.fruit.alphaBounds[2]-asset.fruit.alphaBounds[0])/768;for(const token of await board.locator('.vineyard-personal img[data-candy-token]').all())expect((await token.boundingBox())!.width*480/512).toBeLessThan(width);
 await unpin(page);
 await board.screenshot({path:info.outputPath('planted-fruit-and-candy-score.png')});await page.reload();expect((await current(page)).vineyards).toEqual(after.vineyards);
});

test('vineyard encyclopedia and storage reuse approved artwork without overprinted labels',async({page})=>{
 const g=galleryFixture();await local(page,g);const storage=page.getByRole('button',{name:'보관 포도 B-O:1',exact:true});await expect(storage.locator('[data-vineyard-fruit=B]')).toHaveCount(1);await expect(storage.locator('[data-vineyard-fruit=O]')).toHaveCount(1);
 await expect(storage.locator('[data-fruit-illustration]')).toHaveCount(0);await expect(storage.locator('[data-vine-tile-frame]')).toHaveAttribute('stroke','none');
 await press(page.getByRole('button',{name:'포도밭 카테고리',exact:true}));const detail=page.locator('.tile-encyclopedia [data-help-content=vineyard]');await expect(detail.locator('[data-vineyard-fruit]')).toHaveCount(2);await expect(detail.locator('[data-fruit-illustration]')).toHaveCount(0);await expect(detail.locator('.vine-tile-art text,.vine-tile-art [data-white-die]')).toHaveCount(0);expect(await current(page)).toEqual(g);
});

test('remaining candy tray keeps six actual stocks on one row down to 320px',async({page},info)=>{
 const g=galleryFixture();await local(page,g);await unpin(page);const supply=page.getByRole('region',{name:'공용 포도 공급처',exact:true}),tray=supply.getByRole('group',{name:'남은 사탕',exact:true});
 await expect(tray.locator('legend')).toHaveText('남은 사탕');expect(await tray.locator('[data-candy-stock]').evaluateAll(es=>es.map(e=>e.getAttribute('data-candy-stock')))).toEqual(['B','G','O','R','Y','K']);
 for(const [id,count] of Object.entries(g.vineyards!.pool))await expect(tray.locator(`[data-candy-stock="${id}"] b`)).toHaveText(`×${count}`);
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:844});await supply.scrollIntoViewIfNeeded();const box=(await supply.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+.5);
  expect(await supply.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);expect(await tray.evaluate(e=>getComputedStyle(e).borderTopStyle)).toBe('dashed');
  const bounds=await tray.locator('[data-candy-stock]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));expect(Math.max(...bounds)-Math.min(...bounds)).toBeLessThan(1);
  const [a,b,c]=await supply.locator('[data-vine-supply-kind=depot] button').all();const [ab,bb,cb]=await Promise.all([a.boundingBox(),b.boundingBox(),c.boundingBox()]);expect(ab!.y).toBeCloseTo(bb!.y,0);expect(cb!.y).toBeGreaterThan(ab!.y);await page.mouse.move(0,0);await press(supply.locator("header strong"));await expect(page.locator(".tile-effect-tooltip")).toHaveCount(0);await supply.screenshot({path:info.outputPath(`connected-supply-${width}.png`)});
 }expect(await current(page)).toEqual(g);
});

test('online two seats see the same approved fruit, placement and authenticated reload/undo',async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL:'http://127.0.0.1:3000'});
 try{
  const owner=await(await fetch(server.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'과일A',vineyards:true})})).json();const guest=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'과일B'})})).json();
  const file=join(server.directory,owner.id+'.json'),raw=JSON.parse(await readFile(file,'utf8'));const g={...galleryFixture(),revision:raw.game.revision+10};raw.game=g;raw.history=beginHistory(g,[],true);raw.logs=[];await writeFile(file,JSON.stringify(raw));
  for(const context of [page.context(),peer])await context.route('**/api/rooms{,/**}',async r=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),{id:owner.id,token:guest.token});const other=await peer.newPage();await page.goto('/online');await other.goto('/online');
  const board=page.locator('.vineyard-personal').first(),slot=board.locator('[data-vine-slot=V01]');await press(page.getByLabel('온라인 주사위 2',{exact:true}));await press(board.getByRole('button',{name:'보관 포도 B-O:1',exact:true}));await press(slot);await press(board.getByRole('button',{name:'돌려서 배치',exact:true}));await press(board.getByRole('button',{name:'포도 배치 확정',exact:true}));await expect(slot).toHaveAttribute('data-occupied','true');
  await other.reload();const peerSlot=other.locator('.vineyard-personal').first().locator('[data-vine-slot=V01]');await expect(peerSlot.locator('[data-vineyard-fruit=O]')).toHaveCount(1);await expect(peerSlot.locator('[data-vineyard-fruit=B]')).toHaveCount(1);await page.reload();await expect(slot).toHaveAttribute('data-occupied','true');await page.locator('.online-estates .estate-panel').first().screenshot({path:info.outputPath('online-fruit-sync.png')});
  await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect(slot).not.toHaveAttribute('data-occupied','true');await other.reload();await expect(peerSlot).not.toHaveAttribute('data-occupied','true');expect(JSON.parse(await readFile(file,'utf8')).game.vineyards).toEqual(g.vineyards);
  const rawReward=JSON.parse(await readFile(file,'utf8')),reward={...layeredVineFixture(true,4),revision:rawReward.game.revision+10};rawReward.game=reward;rawReward.history=beginHistory(reward,[],true);rawReward.logs=[];await writeFile(file,JSON.stringify(rawReward));await page.reload();await other.reload();
  const choice=page.getByLabel('필수 효과 및 준비 행동',{exact:true}).locator('button:has([data-candy-token])').first(),grape=await choice.locator('[data-candy-token]').getAttribute('data-candy-token') as Grape;await press(choice);
  for(const p of [page,other])await expect(p.locator(`[data-candy-stock="${grape}"] b`)).toHaveText(`×${reward.vineyards!.pool[grape]-1}`);await other.reload();await expect(other.locator(`[data-candy-stock="${grape}"] b`)).toHaveText(`×${reward.vineyards!.pool[grape]-1}`);
 }finally{await peer.close();await server.close();}
});
