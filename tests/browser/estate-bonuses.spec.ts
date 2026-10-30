import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import manifest from '../../public/assets/tokens/estate/manifest.json';
import {completionReady,completionAction} from '../fixtures/estate-bonuses';
import {serializeSavedGame} from '../../src/game/save';
import {beginHistory} from '../../src/game/turn-history';
import {isolatedRooms} from './isolated-rooms';
import type {GameState} from '../../src/game/types';

const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game as GameState);
// Rasterize the actual SVG layers in isolation, avoiding unrelated GPU repaint dithering.
async function bonusPixels(panel:Locator){
 const url=await panel.evaluate(async node=>{
  const box=(node as SVGGraphicsElement).getBBox(),bounds=node.getBoundingClientRect(),clone=node.cloneNode(true) as SVGElement;
  clone.removeAttribute('transform');
  await Promise.all([...clone.querySelectorAll('image')].map(async image=>{
   const response=await fetch(image.getAttribute('href')!);if(!response.ok)throw Error('Bonus image unavailable');
   const blob=await response.blob(),data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=reject;reader.readAsDataURL(blob);});image.setAttribute('href',data);
  }));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width',String(Math.ceil(bounds.width)));svg.setAttribute('height',String(Math.ceil(bounds.height)));svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);svg.appendChild(clone);
  const source=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(source);}
 });
 return Buffer.from(url.split(',')[1],'base64');
}
async function press(target:Locator){if(await target.page().evaluate(()=>navigator.maxTouchPoints>0))await target.tap();else await target.click();}
async function local(page:Page,g:GameState){
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{if(!sessionStorage.getItem('bonus-installed')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('bonus-installed','1');}},saved);
 await page.goto('/');await expect(page.locator('main')).toHaveAttribute('data-game-revision',String(g.revision));
 await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));
}
async function claim(page:Page,g:GameState,online=false){
 const action=completionAction(g);if(action.type!=='use-die'||action.intent.kind!=='place-tile')throw Error('completion placement');
 const player=g.players.find(p=>p.id===action.playerId)!;
 const index=g.dice.players[player.id].findIndex(d=>d.id===action.dieId);
 await press(online?page.getByLabel(`온라인 주사위 ${index+1}`,{exact:true}):page.getByRole('button',{name:new RegExp(`^행동 주사위 ${index+1} 눈`)}));
 await press(page.getByRole('button',{name:new RegExp(`^${player.name} 개인 보관 1 `)}));
 await press(page.locator('.estate-panel').nth(player.seat).locator(`[data-estate-cell="${action.intent.cellId}"]`));
}

test('all 36 bonus assets have correct number, transparent alpha and common silhouette',async({page})=>{
 await page.goto('/');expect(manifest.assets).toHaveLength(36);let reference:Buffer|undefined;
 for(const a of manifest.assets){
  const response=await page.request.get(`/assets/tokens/estate/${a.file}`);expect(response.ok()).toBe(true);const bytes=await response.body();
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(a.sha256);
  const image=sharp(bytes),meta=await image.metadata();expect([meta.width,meta.height,meta.hasAlpha]).toEqual([1024,1024,true]);
  const alpha=await image.extractChannel('alpha').raw().toBuffer();expect(alpha[0]).toBe(0);
  if(reference)expect(alpha.equals(reference)).toBe(true);else reference=alpha;
  expect(a.file).toBe(`${a.color}-${a.points}.png`);
 }
});

for(const count of [2,3,4])test(`${count}p first completely covers smaller second; board bounds at 100/160/200 percent`,async({page},info)=>{
 const g=completionReady(count);await local(page,g);const panel=page.locator('[data-color-bonuses]');
 await expect(panel.locator('[data-estate-bonus-art]')).toHaveCount(12);
 await expect(panel.locator('text')).toHaveCount(0);
 for(const stack of await panel.locator('[data-bonus-stack]').all()){
  const first=stack.locator('[data-bonus-rank=first]'),second=stack.locator('[data-bonus-rank=second]');
  await expect(first).toHaveAttribute('data-estate-bonus-art',new RegExp(`:${count+3}$`));await expect(second).toHaveAttribute('data-estate-bonus-art',new RegExp(`:${count}$`));
  const [a,b]=await Promise.all([first.boundingBox(),second.boundingBox()]);expect(b!.width/a!.width).toBeCloseTo(.75,5);expect(b!.height/a!.height).toBeCloseTo(.75,5);
  expect(a!.x+a!.width/2).toBeCloseTo(b!.x+b!.width/2,3);expect(a!.y+a!.height/2).toBeCloseTo(b!.y+b!.height/2,3);
 }
 await panel.evaluate(async p=>{await Promise.all([...p.querySelectorAll('image')].map(async e=>{const image=new Image();image.src=e.getAttribute('href')!;await image.decode();}));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));});
 const before=await bonusPixels(panel);await panel.locator('[data-bonus-rank=second]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.visibility='hidden'));
 const hidden=await bonusPixels(panel);const identical=(await sharp(before).raw().toBuffer()).equals(await sharp(hidden).raw().toBuffer());
 if(!identical){await writeFile(info.outputPath('occlusion-before.png'),before);await writeFile(info.outputPath('occlusion-second-hidden.png'),hidden);}
 expect(identical).toBe(true);
 await panel.locator('[data-bonus-rank=second]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.visibility=''));
 // Negative control: the same pixel check must detect an exposed second tile.
 await panel.locator('[data-bonus-rank=first]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.opacity='.5'));const exposed=await bonusPixels(panel);
 await panel.locator('[data-bonus-rank=second]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.visibility='hidden'));const uncovered=await bonusPixels(panel);
 expect((await sharp(exposed).raw().toBuffer()).equals(await sharp(uncovered).raw().toBuffer())).toBe(false);
 await panel.locator('[data-bonus-rank=first]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.opacity=''));
 await panel.locator('[data-bonus-rank=second]').evaluateAll(es=>es.forEach(e=>(e as SVGElement).style.visibility=''));
 for(const zoom of [1,1.6,2]){
  await page.evaluate(z=>{document.documentElement.style.zoom=String(z);},zoom);
  const inside=await panel.evaluate(p=>{const svg=(p as SVGElement).ownerSVGElement!,bounds=svg.querySelector('[data-info-panel="color-bonuses"]')!.getBoundingClientRect();return [...p.querySelectorAll('[data-estate-bonus-art]')].every(el=>{const r=el.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right&&r.top>=bounds.top&&r.bottom<=bounds.bottom;});});expect(inside).toBe(true);
  await panel.screenshot({path:info.outputPath(`${count}p-stack-${zoom}.png`)});
 }
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});expect(await current(page)).toEqual(g);
 await page.locator('.common-board-panel').screenshot({path:info.outputPath(`${count}p-common-board.png`)});
});

test('real local completions reveal second, exhaust supply, persist personal art and undo both awards',async({page},info)=>{
 const initial=completionReady();await local(page,initial);await claim(page,initial);
 const stack=page.locator('[data-bonus-stack=mine]');await expect(stack.locator('[data-bonus-rank=first]')).toHaveCount(0);await expect(stack.locator('[data-bonus-rank=second]')).toHaveCount(1);
 const owner=page.locator('.estate-panel').first();await expect(owner.locator('.earned-bonuses [data-estate-bonus-art="mine:5"]')).toHaveCount(1);
 await owner.screenshot({path:info.outputPath('first-mine-earned.png')});await stack.screenshot({path:info.outputPath('second-mine-revealed.png')});
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(initial);await expect(stack.locator('[data-estate-bonus-art]')).toHaveCount(2);
 await claim(page,initial);const afterFirst=await current(page),unused=afterFirst.dice.players['seat-1'].findIndex(d=>!d.used);
 await press(page.getByRole('button',{name:new RegExp(`^행동 주사위 ${unused+1} 눈`)}));await press(page.getByRole('button',{name:'규칙A 일꾼 자원',exact:true}));await press(page.getByRole('button',{name:'턴 종료',exact:true}));
 const secondStart=await current(page);await claim(page,secondStart);await expect(stack.locator('[data-estate-bonus-art]')).toHaveCount(0);await expect(stack.locator('text')).toHaveCount(0);
 await expect(page.locator('.estate-panel').nth(1).locator('.earned-bonuses [data-estate-bonus-art="mine:2"]')).toHaveCount(1);
 await expect(page.locator('.earned-bonuses b,.earned-bonuses text')).toHaveCount(0);
 for(const [rank,size] of [['first',60],['second',45]] as const)await expect(page.locator(`.earned-bonuses [data-bonus-rank="${rank}"]`)).toHaveAttribute('width',String(size));
 const committed=await current(page);expect(committed.players.map(p=>p.bonuses[0].points)).toEqual([5,2]);await page.reload();await expect(page.locator('main')).toHaveAttribute('data-game-revision',String(committed.revision));
 await expect(page.locator('.earned-bonuses [data-estate-bonus-art]')).toHaveCount(2);await expect(stack.locator('[data-estate-bonus-art]')).toHaveCount(0);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));await expect.poll(()=>current(page)).toEqual(secondStart);await expect(stack.locator('[data-bonus-rank=second]')).toHaveCount(1);
});

test('online both seats share bonus art, refresh and authenticated undo restores pool',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});
 try{
  const owner=await(await fetch(server.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'보상A'})})).json();
  const guest=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'보상B'})})).json();
  const file=join(server.directory,owner.id+'.json'),raw=JSON.parse(await readFile(file,'utf8'));const g={...completionReady(),revision:raw.game.revision+10};raw.game=g;raw.history=beginHistory(g,[],true);raw.logs=[];await writeFile(file,JSON.stringify(raw));
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async r=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});
   await context.routeWebSocket('**/api/rooms/*/live',ws=>ws.close());
  }
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),{id:owner.id,token:guest.token});
  const other=await peer.newPage();await page.goto('/online');await other.goto('/online');await expect(page.locator('main')).toHaveAttribute('data-game-revision',String(g.revision));
  await page.locator('.online-game-settings>summary').click();await page.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();await page.locator('.online-game-settings>summary').click();
  await claim(page,g,true);
  for(const p of [page,other]){await expect(p.locator('.earned-bonuses [data-estate-bonus-art="mine:5"]')).toHaveCount(1);await expect(p.locator('[data-bonus-stack=mine] [data-bonus-rank=first]')).toHaveCount(0);}
  await page.reload();await other.reload();for(const p of [page,other])await expect(p.locator('.earned-bonuses [data-estate-bonus-art="mine:5"]')).toHaveCount(1);
  await page.locator('.estate-panel').first().screenshot({path:info.outputPath('online-first-bonus-reconnected.png')});await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));
  for(const p of [page,other]){await expect(p.locator('.earned-bonuses [data-estate-bonus-art]')).toHaveCount(0);await expect(p.locator('[data-bonus-stack=mine] [data-estate-bonus-art]')).toHaveCount(2);}
  expect(JSON.parse(await readFile(file,'utf8')).game.market.bonusTiles).toEqual(g.market.bonusTiles);
  await claim(page,g,true);await expect(page.locator('.earned-bonuses [data-estate-bonus-art="mine:5"]')).toHaveCount(1);
  const afterFirst=JSON.parse(await readFile(file,'utf8')).game as GameState,unused=afterFirst.dice.players['seat-1'].findIndex(d=>!d.used);
  await press(page.getByLabel(`온라인 주사위 ${unused+1}`,{exact:true}));await press(page.getByLabel('온라인 일꾼 획득',{exact:true}));await expect(page.getByRole('button',{name:'턴 종료',exact:true})).toBeEnabled();await press(page.getByRole('button',{name:'턴 종료',exact:true}));
  await expect(other.getByLabel('온라인 주사위 1',{exact:true})).toBeEnabled();const secondStart=JSON.parse(await readFile(file,'utf8')).game as GameState;await claim(other,secondStart,true);
  for(const p of [page,other]){await expect(p.locator('.earned-bonuses [data-estate-bonus-art]')).toHaveCount(2);await expect(p.locator('[data-bonus-stack=mine] [data-estate-bonus-art]')).toHaveCount(0);await p.reload();await expect(p.locator('.earned-bonuses [data-estate-bonus-art="mine:2"]')).toHaveCount(1);}
  await page.locator('[data-color-bonuses]').screenshot({path:info.outputPath('online-bonus-exhausted.png')});
  await press(other.getByRole('button',{name:'이전 행동으로',exact:true}));
  for(const p of [page,other]){await expect(p.locator('.earned-bonuses [data-estate-bonus-art]')).toHaveCount(1);await expect(p.locator('[data-bonus-stack=mine] [data-bonus-rank=second]')).toHaveCount(1);}
 }finally{await peer.close();await server.close();}
});
