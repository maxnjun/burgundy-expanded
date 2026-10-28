import {test,expect} from '@playwright/test';
import {setup} from '../fixtures/shields';
import {serializeSavedGame} from '../../src/game/save';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {tradeFixture,directSale} from '../fixtures/custom-trade';
import {applyCoreAction} from '../../src/game/core';
import goodsAssets from '../../public/assets/goods/manifest.json';
import type {GameState} from '../../src/game/types';

test('personal goods stacks and enlarged controls remain readable and clickable at 100 160 200 percent',async({page},info)=>{
 let g=setup();g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:([1,2,3] as const).map(type=>({type,tiles:Array.from({length:type+1},(_,i)=>({id:`TEST-STACK:${type}:${i}`,type}))}))})};
 await page.addInitScript(saved=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',saved);},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');const inventory=page.locator('.estate-inventory').first(),goods=inventory.locator('.player-goods-storage');
 for(const zoom of [1,1.6,2]){
  await page.evaluate(z=>{document.body.style.zoom=String(z);},zoom);await inventory.scrollIntoViewIfNeeded();
  await expect(goods.locator('[data-goods-layer]')).toHaveCount(9);await expect(goods.locator('button>strong,button>b')).toHaveCount(0);
  const boxes=await goods.locator('[data-goods-slot]').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width};}));
  const bounds=(await inventory.boundingBox())!;for(let i=0;i<boxes.length;i++){expect(boxes[i].x).toBeGreaterThanOrEqual(bounds.x);expect(boxes[i].right).toBeLessThanOrEqual(bounds.x+bounds.width+1);for(let j=0;j<i;j++)expect(boxes[i].x>=boxes[j].right||boxes[j].x>=boxes[i].right||boxes[i].y>=boxes[j].bottom||boxes[j].y>=boxes[i].bottom).toBe(true);}
  const tile=await goods.locator('[data-goods-front]').first().boundingBox();expect(tile!.width).toBeCloseTo(60*zoom,0);
  await inventory.screenshot({path:`.local-data/player-improvements/${info.project.name}-inventory-${zoom*100}.png`});
  await inventory.getByRole('button',{name:/개인 주사위 1 눈/}).click();await goods.locator('[data-goods-type="1"]').click();await expect(goods.locator('[data-goods-layer]')).toHaveCount(7);
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect(goods.locator('[data-goods-layer]')).toHaveCount(9);
 }
});

test('goods size, angled stack and small counts fit unchanged inventory and route slots',async({page},info)=>{
 const initial=tradeFixture(),game:GameState={...initial,players:initial.players.map((p,i)=>i?p:{...p,goods:([1,4,6] as const).map((type,k)=>({type,tiles:Array.from({length:[1,3,7][k]},(_,i)=>({id:`TEST-FAN:${type}:${i}`,type}))}))}),dice:{...initial.dice,players:{...initial.dice.players,'seat-1':[{...initial.dice.players['seat-1'][0],value:4},initial.dice.players['seat-1'][1]]}}};
 await page.addInitScript(saved=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',saved);localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off');},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
 const inventory=page.locator('.estate-inventory').first(),goods=inventory.locator('.player-goods-storage'),route=page.locator('.trade-route-panel').first(),before=!!process.env.GOODS_STACK_BEFORE;
 const geometry=await page.evaluate(()=>{const inventory=document.querySelector('.estate-inventory')!,route=document.querySelector('.trade-route-panel')!;return [inventory,route].map(parent=>{const base=parent.getBoundingClientRect();return [...parent.querySelectorAll(parent===inventory?'[data-goods-slot]':'[data-trade-cell]')].map(el=>{const r=el.getBoundingClientRect();return [r.x-base.x,r.y-base.y,r.width,r.height];});});});
 await mkdir('.local-data/goods-stack',{recursive:true});const baseline=`.local-data/goods-stack/${info.project.name}-geometry.json`;
 await inventory.screenshot({path:info.outputPath('inventory.png')});await route.screenshot({path:info.outputPath('trade.png')});
 if(before){await writeFile(baseline,JSON.stringify(geometry));return;}
 const old=JSON.parse(await readFile(baseline,'utf8').catch(()=>JSON.stringify(geometry))) as number[][][];
 for(let i=0;i<geometry.length;i++)for(let j=0;j<geometry[i].length;j++)for(let k=0;k<4;k++)expect(Math.abs(geometry[i][j][k]-old[i][j][k])).toBeLessThanOrEqual(1);
 expect(geometry[0].map(b=>b.slice(2))).toEqual([[74,68],[74,68],[74,80]]);expect(geometry[1].map(b=>b.slice(2))).toEqual([[101,154],[101,154],[101,154]]);
 await inventory.evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-70));const view=(await inventory.boundingBox())!;await page.screenshot({path:info.outputPath('inventory-context.png'),clip:{x:view.x,y:Math.max(0,view.y-26),width:view.width,height:view.height+26}});
 await expect(goods.locator('[data-goods-layer]')).toHaveCount(11);await expect(goods.locator('[data-goods-slot="0"] [data-goods-count]')).toHaveCount(0);
 await expect(goods.locator('[data-goods-slot="1"] [data-goods-count]')).toHaveText('×3');await expect(goods.locator('[data-goods-slot="2"] [data-goods-count]')).toHaveText('×7');
 for(const zoom of [1,1.6,2]){
  await page.evaluate(z=>document.body.style.zoom=String(z),zoom);await inventory.scrollIntoViewIfNeeded();
  const front=goods.locator('[data-goods-front]').first();expect((await front.boundingBox())!.width).toBeCloseTo(60*zoom,0);expect((await front.boundingBox())!.height).toBeCloseTo(60*zoom,0);
  const checks=await goods.evaluate((node,assets)=>[...node.querySelectorAll('[data-goods-slot]')].map(slot=>{
   const button=slot.getBoundingClientRect(),badge=slot.querySelector('[data-goods-count]')?.getBoundingClientRect();
   return [...slot.querySelectorAll<SVGSVGElement>('[data-goods-layer]')].map(svg=>{
    const a=assets.find(a=>'value' in a&&a.value===Number(svg.dataset.goodsValue))!,bounds=a.alphaBounds,points=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]].map(([x,y])=>new DOMPoint(x/768*40,y/768*40).matrixTransform(svg.getScreenCTM()!)),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y)),depth=Number(svg.dataset.goodsDepth);
    return {depth,offset:[svg.style.left,svg.style.top],transform:svg.style.transform,overhang:Math.max(button.left-left,right-button.right,button.top-top,bottom-button.bottom,0),badgeOverlap:badge?Math.max(0,Math.min(right,badge.right)-Math.max(left,badge.left))*Math.max(0,Math.min(bottom,badge.bottom)-Math.max(top,badge.top)):0};
   });
  }),goodsAssets.assets);
  for(const layers of checks)for(const c of layers){expect(c.offset).toEqual([`${Math.min(c.depth,2)*4}px`,`${Math.min(c.depth,2)*4}px`]);expect(c.transform).toBe(c.depth?`rotate(${3+c.depth%2}deg)`:'');expect(c.overhang).toBeLessThanOrEqual(zoom);expect(c.badgeOverlap).toBe(0);}
  const routeArt=await route.locator('[data-trade-cell]>[data-goods-value]').first().boundingBox();expect(routeArt!.width).toBeCloseTo(50*zoom,0);expect(routeArt!.height).toBeCloseTo(50*zoom,0);
  await inventory.screenshot({path:info.outputPath(`inventory-${zoom*100}.png`)});await route.screenshot({path:info.outputPath(`trade-${zoom*100}.png`)});
 }
 await page.evaluate(()=>document.body.style.zoom='1');
 const expected=applyCoreAction(game,directSale(game));expect(expected.ok).toBe(true);if(!expected.ok)throw Error('sale fixture');
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await goods.locator('[data-goods-type="4"]').click();
 const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
 await expect.poll(current).toEqual(JSON.parse(JSON.stringify(expected.value.state)));await expect(goods.locator('[data-goods-count]')).toHaveCount(1);
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(current).toEqual(JSON.parse(JSON.stringify(game)));await page.reload();await expect(goods.locator('[data-goods-count]')).toHaveCount(2);
});
