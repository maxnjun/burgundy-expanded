import {test,expect} from "@playwright/test";
import {createPracticeSession} from "../../src/game/practice";
import {supplyInn,INN_PHASES} from "../../src/game/inns";
import {applyCoreAction} from "../../src/game/core";
import {serializeSavedGame} from "../../src/game/save";
import {directActions} from "../../src/game/direct-actions";

function setup(count:number,zoom=1,seats:2|4=2){
 let g=createPracticeSession({names:Array.from({length:seats},(_,i)=>`여관${i+1}`),seed:"inn-browser",inns:true,officialSlots:true,boardIds:Array(seats).fill("se:base:2")});
 for(const phase of INN_PHASES.slice(1,count))g={...supplyInn(g,phase),turn:{...g.turn,phase},market:{...supplyInn(g,phase).market,roundGoods:g.market.phaseGoods[phase],phaseGoods:{...g.market.phaseGoods,[phase]:[]}}};
 const rolled=applyCoreAction(g,{type:"roll-round",playerId:"seat-1"});if(!rolled.ok)throw new Error(JSON.stringify(rolled));g={...rolled.value.state,players:rolled.value.state.players.map(p=>({...p,silver:4,workers:10}))};
 return {game:g,saved:serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:g,logs:[],view:{zoom:1,focus:false,table:true,commonZoom:zoom,boardZooms:{}}})};
}
for(let n=1;n<=5;n++)test(`inn stack${n} at100/160/200 preserves supply hits and purchases top only`,async({page})=>{
 for(const zoom of [1,1.6,2]){
  const {saved}=setup(n,zoom);await page.goto('/');await page.evaluate(v=>localStorage.setItem('burgundy-expanded:local-v1',v),saved);await page.reload();
  const board=page.getByRole('region',{name:'공용 공급처 보드',exact:true}),stack=board.locator('[data-inn-stack]');await expect(board.getByText('여관1 ◀',{exact:true})).toBeVisible();
  await expect(stack.locator('[data-inn-layer]')).toHaveCount(n);await expect(stack.locator('[data-inn-image]')).toHaveCount(n);await expect(stack).toHaveAttribute('aria-disabled','false');
  await expect(stack.locator('[data-resource-icon="silver"]')).toHaveCount(1);
  await expect.poll(()=>stack.locator('image').evaluateAll(els=>Promise.all(els.map(el=>new Promise<boolean>(resolve=>{const im=new Image();im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=el.getAttribute('href')!;}))))).toEqual(Array(n+1).fill(true));
  await board.screenshot({path:`.local-data/qa/inn-stack-${n}-${zoom*100}.png`});
  await stack.screenshot({path:`.local-data/qa/inn-stack-detail-${n}-${zoom*100}.png`});
  for(const hit of [stack.locator('[data-inn-hit]'),board.locator('[data-black-depot] [data-supply-hit]').first()]){
   await hit.scrollIntoViewIfNeeded();expect(await hit.evaluate(el=>{const b=el.getBoundingClientRect();return el===document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);})).toBe(true);
  }
  await stack.locator('[data-inn-hit]').click();await expect(stack.locator('[data-inn-layer]')).toHaveCount(n-1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).logs[0])).toContain('여관 구매');
  await board.screenshot({path:`.local-data/qa/inn-acquired-${n}-${zoom*100}.png`});
 }
});
test('inn storage, direct placement, saved estate, missing PNG fallback and disabled extension',async({page})=>{
 const {game}=setup(1),buy=directActions(game,'seat-1').find(a=>a.type==='buy-black-tile'&&a.tileId===game.market.inns!.stack[0])!;
 const bought=applyCoreAction(game,buy);expect(bought.ok).toBe(true);if(!bought.ok)return;
 let next=bought.value.state;const put=directActions(next,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='place-tile'&&a.intent.tileId===game.market.inns!.stack[0]);expect(put).toBeTruthy();if(!put||put.type!=='use-die'||put.intent.kind!=='place-tile')return;
 // TEST FIXTURE: fill the other cells of the target's real printed region.
 const targetId=put.intent.cellId,target=next.players[0].duchy.cells.find(c=>c.id===targetId)!,tiles={...next.tiles};
 next={...next,tiles,players:next.players.map((p,i)=>i?p:{...p,duchy:{...p.duchy,cells:p.duchy.cells.map(c=>{if(c.regionId!==target.regionId||c.id===targetId||c.tileId)return c;const prototype=Object.values(tiles).find(t=>t.type===c.terrain)!;const id=`TEST-INN-REGION:${c.id}`;tiles[id]={...prototype,id};return {...c,tileId:id};})}})};
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:next,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(v=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',v);},saved);await page.goto('/');
 const storage=page.getByRole('button',{name:/^여관1 개인 보관 1 여관/});await expect(storage).toBeVisible();await storage.screenshot({path:'.local-data/qa/inn-storage.png'});await storage.click();
 const dieIndex=next.dice.players['seat-1'].findIndex(d=>d.id===put.dieId)+1;await page.getByRole('button',{name:new RegExp(`^행동 주사위 ${dieIndex} 눈`)}).click();
 const cell=page.locator(`[data-estate-cell="${put.intent.cellId}"]`).first();await cell.click();await expect(cell.locator('[data-inn-art]')).toHaveCount(1);await cell.screenshot({path:'.local-data/qa/inn-estate.png'});await page.locator('.estate-panel').first().screenshot({path:'.local-data/qa/inn-completed-estate.png'});
 const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.scoreLedger['seat-1']);expect(ledger.some((e:{category:string})=>e.category==='region-size')).toBe(true);
 await page.reload();await expect(page.locator('[data-estate-tile] [data-inn-art]')).toHaveCount(1);
 await page.route('**/tiles/illustrations/inn.png*',r=>r.abort());await page.reload();await expect(page.locator('[data-estate-tile] [data-inn-fallback]')).toHaveCount(1);
 const off=createPracticeSession({names:['off1','off2'],seed:'inn-off'});await page.evaluate(v=>localStorage.setItem('burgundy-expanded:local-v1',v),serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:off,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.reload();await expect(page.locator('[data-inn-stack]')).toHaveCount(0);
});
test('four seat market retains distinct inn and every existing tile hit',async({page})=>{
 const {saved}=setup(5,1,4);await page.addInitScript(v=>localStorage.setItem('burgundy-expanded:local-v1',v),saved);await page.goto('/');const board=page.getByRole('region',{name:'공용 공급처 보드',exact:true});await expect(board.getByText('여관1 ◀',{exact:true})).toBeVisible();
 for(const hit of await board.locator('[data-supply-hit],[data-inn-hit]').all()){await hit.scrollIntoViewIfNeeded();expect(await hit.evaluate(el=>{const b=el.getBoundingClientRect();return el===document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);})).toBe(true);}
 expect(await board.evaluate(root=>{
  const screen=(el:SVGGraphicsElement,points:number[][])=>points.map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM()!);return [p.x,p.y];});
  const overlaps=(a:number[][],b:number[][])=>[a,b].every(poly=>poly.every((p,i)=>{const n=poly[(i+1)%poly.length],axis=[n[1]-p[1],p[0]-n[0]],project=(shape:number[][])=>shape.map(v=>v[0]*axis[0]+v[1]*axis[1]),pa=project(a),pb=project(b);return Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))>.01;}));
  const tiles=[...root.querySelectorAll<SVGPolygonElement>('[data-supply-hit]')].map(el=>screen(el,[...el.points].map(p=>[p.x,p.y])));
  const goods=[...root.querySelectorAll<SVGRectElement>('[data-goods-space]')].map(el=>{const b=el.getBBox();return screen(el,[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]);});
  const badges=[...root.querySelectorAll<SVGGraphicsElement>('[data-inn-stack]>g>text,[data-inn-stack]>g>circle')].map(el=>{const b=el.getBBox();return screen(el,[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]);});
  return badges.every(b=>[...tiles,...goods].every(other=>!overlaps(b,other)))&&[...root.querySelectorAll<SVGSVGElement>('[data-inn-layer]>svg')].every(el=>{const h=el.viewBox.baseVal.height,hex=screen(el,[[50,0],[100,h/4],[100,h*3/4],[50,h],[0,h*3/4],[0,h/4]]);return [...tiles,...goods].every(other=>!overlaps(hex,other));});
 })).toBe(true);
 await board.screenshot({path:'.local-data/qa/inn-four-seats.png'});
});
test('local setup starts2/3/4 seats with the selected inn extension',async({page})=>{
 await page.goto('/');
 for(const count of [2,3,4]){
  await page.getByRole('button',{name:/게임 준비/}).click();await page.getByLabel('플레이어 수',{exact:true}).selectOption(String(count));await page.getByLabel('플레이 방식',{exact:true}).selectOption('local');await page.getByLabel('여관 확장',{exact:true}).check();
  await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{const g=JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game;return {count:g.config.playerCount,enabled:g.config.extensions.some((e:{id:string})=>e.id==='inns'),supply:g.market.inns?.stack.length};})).toEqual({count,enabled:true,supply:1});
  await expect(page.locator('[data-inn-stack]')).toHaveCount(1);
 }
});
