import { test, expect } from "@playwright/test";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction } from "../../src/game/core";
import { serializeSavedGame } from "../../src/game/save";

for (const [count,shields] of [[2,false],[3,false],[4,false],[2,true],[3,true],[4,true]] as const) test(`common board ${count} seats shields=${shields} preserves market and fitted hit targets`,async({page},info)=>{
 const setup=createPracticeSession({names:Array.from({length:count},(_,i)=>`배치${i+1}`),seed:"common-layout",shieldRules:shields,officialSlots:true,boardIds:Array(count).fill("se:base:2")});
 const rolled=applyCoreAction(setup,{type:"roll-round",playerId:"seat-1"});expect(rolled.ok).toBe(true);if(!rolled.ok)return;
 const game={...rolled.value.state,players:rolled.value.state.players.map(p=>({...p,silver:4}))};
 await page.addInitScript(value=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',value);},serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');const board=page.getByRole('region',{name:'공용 공급처 보드',exact:true});await expect(board).toBeVisible();await expect(board.getByText('배치1 ◀',{exact:true})).toBeVisible();
 await expect(board.locator('[data-shield-slot]')).toHaveCount(shields?(count===2?6:count===3?9:12):0);
 await expect(board.locator('[data-depot]')).toHaveCount(6);
 await expect(board.locator('.supply-art-tile')).toHaveCount(game.market.numberedDepots.reduce((n,d)=>n+d.slots.filter(s=>s.tileId).length,0)+game.market.blackDepot.filter(Boolean).length);
 const screenshotViewport=page.viewportSize();
 if(info.project.name==="desktop-1280")await page.setViewportSize({width:1280,height:1900});
 await board.screenshot({path:`.local-data/qa/common-${process.env.LAYOUT_BEFORE?'before':'after'}-${count}${shields?'-shields':''}.png`});
 if(screenshotViewport)await page.setViewportSize(screenshotViewport);
 if(process.env.LAYOUT_BEFORE)return;
 await expect(board.locator('.common-board-svg')).toHaveAttribute('viewBox','0 0 950 1030');
 expect(await board.evaluate(el=>{const panels=[...el.querySelectorAll('[data-info-panel]')].map(e=>e.getBoundingClientRect());const contents=[...el.querySelectorAll('.supply-art-tile,[data-shield-zone],[data-goods-space]')].map(e=>e.getBoundingClientRect());return panels.length===4&&!panels.some(a=>contents.some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));})).toBe(true);
 expect(await board.evaluate(el=>{
  const svg=el.querySelector('.common-board-svg') as SVGSVGElement;
  const box=(selector:string)=>(svg.querySelector(selector) as SVGGraphicsElement).getBBox();
  const panels=[...svg.querySelectorAll('[data-info-panel]')].map(e=>(e as SVGGraphicsElement).getBBox());
  if(panels[0].width!==panels[1].width||panels[2].width!==panels[3].width||panels[0].x!==panels[2].x||panels[1].x!==panels[3].x)return false;
  const spaces=[...svg.querySelectorAll('[data-black-space]')].map(e=>(e as SVGGraphicsElement).getBBox());
  const x=(Math.min(...spaces.map(b=>b.x))+Math.max(...spaces.map(b=>b.x+b.width)))/2;
  const y=(Math.min(...spaces.map(b=>b.y))+Math.max(...spaces.map(b=>b.y+b.height)))/2;
  if(Math.abs(x-475)>.001||Math.abs(y-540)>.001)return false;
  for(const n of [1,4]){
   const goods=box(`[data-goods-space="${n}"]`);
   const tiles=[...svg.querySelectorAll(`[data-depot="${n}"] [data-supply-hit]`)].map(e=>(e as SVGGraphicsElement).getBBox());
   if(Math.abs(goods.x+goods.width/2-475)>.001||!tiles.every(b=>Math.abs(b.y-tiles[0].y)<.001))return false;
   if(n===1?tiles[0].y+tiles[0].height>=goods.y:goods.y+goods.height>=tiles[0].y)return false;
   if(svg.querySelector('[data-shield-zone]')){
    const zone=box(`[data-shield-zone="${n}"]`);
    if(zone.x+zone.width/2!==475||(n===1?zone.y+zone.height>=tiles[0].y:tiles[0].y+tiles[0].height>=zone.y))return false;
   }
  }
  return true;
 })).toBe(true);
 await expect(board.locator('[data-shield-zone]')).toHaveCount(shields?6:0);
 expect(await board.locator('[data-supply-hit]').evaluateAll(els=>els.every(el=>Math.abs((el as SVGGraphicsElement).getBBox().width-60)<.001))).toBe(true);
 expect(await board.evaluate(el=>{const phases=[...el.querySelectorAll('[data-phase-score]')].map(e=>e.getBoundingClientRect());const rounds=[...el.querySelectorAll('[data-round-supply]')].map(e=>e.getBoundingClientRect());return phases.length===5&&rounds.length===5&&rounds.every((r,i)=>r.top>phases[i].bottom&&Math.abs(r.left-phases[i].left)<10);})).toBe(true);
 await expect(board.locator('[data-board-decoration]')).toHaveAttribute('pointer-events','none');
 await expect(board.locator('[data-board-decoration] [role="button"]')).toHaveCount(0);
 await expect(board.locator('[data-board-decoration] image')).toHaveCount(0);
 await expect(board.locator('[data-tile-shadow]')).toHaveCount(await board.locator('.supply-art-tile').count());
 await expect(board.locator('[data-goods-space]')).toHaveCount(6);
 await expect(board.locator('[data-black-depot] > rect')).toHaveCount(0);
 const targets=board.locator('.supply-art-tile');
 for(let i=0;i<await targets.count();i++){
   const item=targets.nth(i);await item.locator('[data-supply-hit]').scrollIntoViewIfNeeded();
   await item.locator('[data-supply-hit]').evaluate(el=>{const b=el.getBoundingClientRect();window.scrollBy(0,b.y+b.height/2-window.innerHeight/2);});
   expect(await item.evaluate(el=>{const c=el.querySelector('[data-supply-hit]')!;const b=c.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!hit&&el.contains(hit);})).toBe(true);
 }
 if(count===2){
  const points=await board.locator('[data-black-space]').evaluateAll(els=>els.map(el=>el.getAttribute('points')!.split(' ').map(p=>p.split(',').map(Number).map(n=>n.toFixed(6)).join(','))));
  let edges=0;for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(points[i].filter(p=>points[j].includes(p)).length===2)edges++;
  expect(edges).toBe(5);
 }
 const blackGeometry=await board.locator('[data-black-space]').evaluateAll(els=>els.map(e=>e.getAttribute('points')));
 const black=board.locator('[data-black-depot] .supply-art-tile').first();await expect(black).toHaveAttribute('aria-disabled','false');await black.click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(2);
 await page.reload();await expect(board.locator('[data-black-depot] .supply-art-tile')).toHaveCount(game.market.blackDepot.filter(Boolean).length-1);
 expect(await board.locator('[data-black-space]').evaluateAll(els=>els.map(e=>e.getAttribute('points')))).toEqual(blackGeometry);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 await expect(board.locator('.direct-cost').first()).toBeVisible();
 await page.getByRole('button',{name:'공용 보드 확대',exact:true}).click();
 await expect(page.getByRole('button',{name:'공용 보드 배율 복원',exact:true})).toHaveText('125%');
 await board.screenshot({path:`.local-data/qa/common-costs-${count}${shields?'-shields':''}.png`});
});
