import {test,expect,type Page} from '@playwright/test';
import {vineFixture,plantedVineFixture} from '../fixtures/vineyards';
import {serializeSavedGame} from '../../src/game/save';
import {estatePoints} from '../../src/app/estate-geometry';
import {vinePoints} from '../../src/app/vineyard-board';
import {VINE_SLOTS} from '../../src/game/vineyards';
import manifest from '../../public/assets/textures/manifest.json';
import type {GameState} from '../../src/game/types';

async function local(page:Page,game:GameState){
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{if(!sessionStorage.getItem('surfaces-installed')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('surfaces-installed','1');}},saved);
 await page.goto('/');await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
 // Keep the sticky action bar outside full-board screenshots without altering game state.
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await page.getByRole('switch',{name:'디자인 1',exact:true}).check();
 await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
}
const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);

test('six empty terrains and four actual vineyard layers keep coordinates, dice and input',async({page},info)=>{
 const g=vineFixture();await local(page,g);const estate=page.locator('.estate-panel').first(),vine=estate.locator('.vineyard-personal');
 const before=!!process.env.TEXTURE_BEFORE,prefix=before?'before':'after';
 if(!before)await page.locator('[data-terrain-surface] image,[data-vine-surface] image').evaluateAll(async images=>{
  await Promise.all(images.map(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();}));
 });
 for(const zoom of before?[1]:[1,1.6,2]){
  await page.evaluate(z=>{document.documentElement.style.zoom=String(z);},zoom);
  await estate.screenshot({path:info.outputPath(`${prefix}-estate-${zoom}.png`)});
  await vine.screenshot({path:info.outputPath(`${prefix}-vineyard-${zoom}.png`)});
  if(zoom===1)await page.locator('.common-board-panel').screenshot({path:info.outputPath(`${prefix}-common.png`)});
 }
 if(before)return;
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 for(const cell of g.players[0].duchy.cells){
  const c=estate.locator(`[data-estate-cell="${cell.id}"]`);
  await expect(c.locator('[data-estate-fill]')).toHaveAttribute('points',estatePoints(cell.coord));
  await expect(c.locator('[data-terrain-surface]')).toHaveCount(cell.tileId?0:1);
  if(cell.tileId)continue;
  await expect(c.locator('[data-terrain-surface]')).toHaveAttribute('data-terrain-surface',cell.terrain);
  const die=c.locator('[data-white-die]');await expect(die).toHaveAttribute('data-white-die',String(cell.number));
  await expect(die.locator('circle')).toHaveCount(cell.number);await expect(die).toHaveAttribute('data-die-raised','true');
  const contrast=await die.evaluate(d=>{
   const luminance=(hex:string)=>hex.match(/\w\w/g)!.map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const a=luminance(d.querySelector('rect')!.getAttribute('fill')!.slice(1)),b=luminance(d.querySelector('circle')!.getAttribute('fill')!.slice(1));
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });expect(contrast).toBeGreaterThanOrEqual(4.5);
 }
 for(const type of ['livestock','castle','building','monastery','mine','ship'])await expect(estate.locator(`[data-terrain-surface="${type}"]`).first()).toBeVisible();
 for(const slot of VINE_SLOTS){
  const s=vine.locator(`[data-vine-slot="${slot.id}"]`);await expect(s).toHaveAttribute('data-layer',String(slot.layer));
  await expect(s.locator('[data-vine-surface]')).toHaveCount(2);
  await expect(s.locator('[data-white-die]')).toHaveCount(1);
  await expect(s.locator('[data-white-die] rect')).toHaveAttribute('fill','#fffbea');
  for(const [i,cell] of slot.cells.entries()){
   const c=s.locator('[data-vine-cell]').nth(i);await expect(c.locator('.vineyard-cell')).toHaveAttribute('points',vinePoints(cell.q,cell.r));
   await expect(c.locator('[data-vine-surface]')).toHaveAttribute('data-vine-surface',String(slot.layer));
   await expect(c.locator('[data-reward-effect]')).toHaveAttribute('data-reward-effect',cell.bonus);
   await expect(c.locator('[data-reward-effect]')).toHaveAccessibleName(/.+/);
  }
 }
 const hit=await estate.locator('[data-terrain-surface]').first().evaluate(e=>getComputedStyle(e).pointerEvents);expect(hit).toBe('none');
 expect(await current(page)).toEqual(g);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 await estate.getByRole('button',{name:'포도1 일꾼 자원',exact:true}).click();
 await expect.poll(async()=>(await current(page)).players[0].workers).toBe(g.players[0].workers+2);
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();expect(await current(page)).toEqual(g);
 await vine.getByRole('button',{name:'포도1 포도밭 확대',exact:true}).click();
 await vine.getByRole('button',{name:'포도1 포도밭 확대',exact:true}).click();
 await expect(vine.locator('.vineyard-svg')).toHaveAttribute('style',/width:\s*150%/);
 expect(await vine.locator('.live-board-scroll').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
 expect(await current(page)).toEqual(g);
});

test('placed artwork stays above quiet surfaces across reload; local assets are small and complete',async({page})=>{
 const g=plantedVineFixture();await local(page,g);
 const occupied=page.locator('[data-vine-slot][data-occupied=true]');await expect(occupied).toHaveCount(1);
 await expect(occupied.locator('[data-vine-surface]')).toHaveCount(0);await expect(occupied.locator('[data-connected-vine=true]')).toHaveCount(1);
 await expect(page.locator('[data-estate-tile] [data-terrain-surface]')).toHaveCount(0);
 expect(manifest.assets).toHaveLength(16);expect(manifest.assets.reduce((n,a)=>n+a.bytes,0)).toBeLessThan(150000);
 for(const a of manifest.assets){const r=await page.request.get(`/assets/textures/${a.file}`);expect(r.ok()).toBe(true);expect((await r.body()).length).toBe(a.bytes);}
 await page.reload();await expect(occupied).toHaveCount(1);expect(await current(page)).toEqual(g);
});
