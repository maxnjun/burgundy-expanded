import {test,expect} from "@playwright/test";
import {fortressFixture} from "../fixtures/fortress";
import {serializeSavedGame} from "../../src/game/save";
import {fortressLinesFor} from "../../src/game/boards/fortress-lines";
for(let n=23;n<=30;n++)test(`fortress board${n} outside icons, three zooms and actual completion`,async({page})=>{
 const {game,target}=fortressFixture(n),saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',value);},saved);await page.goto('/');
 const board=page.getByRole('group',{name:'요새A 영지',exact:true});await expect(board.locator('[data-fortress-line]')).toHaveCount(3);await expect(board.locator('[data-fortress-placeholder]')).toHaveCount(3);
 const icons=await board.locator('[data-fortress-hit]').evaluateAll(els=>els.map(el=>{const r=el as SVGRectElement;return {x:r.x.baseVal.value,y:r.y.baseVal.value,w:r.width.baseVal.value,h:r.height.baseVal.value};}));
 // Polygon/rectangle separating-axis test in SVG coordinates, independent of zoom.
 const points=await board.locator('[data-estate-fill]').evaluateAll(els=>els.map(el=>(el as SVGPolygonElement).getAttribute('points')!.split(' ').map(s=>s.split(',').map(Number))));
 for(const icon of icons)for(const p of points){const rect=[[icon.x,icon.y],[icon.x+icon.w,icon.y],[icon.x+icon.w,icon.y+icon.h],[icon.x,icon.y+icon.h]];const axes=[[1,0],[0,1],...p.map((a,i)=>{const b=p[(i+1)%p.length];return [a[1]-b[1],b[0]-a[0]];})];expect(axes.some(([x,y])=>{const a=p.map(([px,py])=>px*x+py*y),b=rect.map(([px,py])=>px*x+py*y);return Math.max(...a)<Math.min(...b)||Math.max(...b)<Math.min(...a);})).toBe(true);}
 for(const zoom of [100,160,200]){
   while(Number(await page.getByLabel('요새A 영지 확대',{exact:true}).locator('..').locator('span').textContent().then(s=>s!.replace('%','')))<zoom)await page.getByLabel('요새A 영지 확대',{exact:true}).click();
   await board.screenshot({style:".direct-toolbar,.intro{visibility:hidden!important}",path:`.local-data/qa/fortress-${n}-${zoom}.png`});
 }
 await board.getByRole('button',{name:/요새 상단 가로줄/}).focus();await page.keyboard.press('Enter');await expect(board.locator('[data-fortress-highlight="horizontal"] polygon')).toHaveCount(5);
 expect(fortressLinesFor(game.players[0].duchy.boardId)[0].cellIds).toContain(target);
 await page.getByRole('button',{name:/^요새A 개인 보관 1 /}).click();await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 await board.locator(`[data-estate-cell="${target}"]`).click();await expect(board.locator('[data-fortress-line="horizontal"]')).toHaveAttribute('data-status','awarded');
 await board.screenshot({style:".direct-toolbar,.intro{visibility:hidden!important}",path:`.local-data/qa/fortress-${n}-awarded.png`});
 await page.reload();await expect(board.locator('[data-fortress-line="horizontal"]')).toHaveAttribute('data-status','awarded');
});
test("fortress missing PNG uses the temporary icon",async({page})=>{
 const game=fortressFixture().game;await page.route('**/tiles/fortress.png',route=>route.fulfill({status:404,body:''}));
 await page.addInitScript(value=>localStorage.setItem('burgundy-expanded:local-v1',value),serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');await expect(page.getByRole('group',{name:'요새A 영지',exact:true}).locator('[data-fortress-placeholder]')).toHaveCount(3);
});
test("future PNG replaces only artwork without changing icon geometry or game state",async({page})=>{
 const game=fortressFixture().game;
 // TEST ASSET ONLY: stand-in PNG served at the reserved path, never a new fortress illustration.
 await page.route('**/tiles/fortress.png',route=>route.fulfill({path:'public/tiles/castle.png',contentType:'image/png'}));
 await page.addInitScript(value=>localStorage.setItem('burgundy-expanded:local-v1',value),serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');const board=page.getByRole('group',{name:'요새A 영지',exact:true});await expect(board.locator('image[href="/tiles/fortress.png"]')).toHaveCount(3);await expect(board.locator('[data-fortress-placeholder]')).toHaveCount(0);
 expect(await board.locator('[data-fortress-hit]').evaluateAll(els=>els.map(el=>[el.getAttribute('x'),el.getAttribute('y')]))).toEqual([['50','118'],['290','570'],['530','118']]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.revision)).toBe(game.revision);
});
