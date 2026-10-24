import {test,expect} from '@playwright/test';
import {setup} from '../fixtures/shields';
import {serializeSavedGame} from '../../src/game/save';

test('personal goods stacks and enlarged controls remain readable and clickable at 100 160 200 percent',async({page},info)=>{
 let g=setup();g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:([1,2,3] as const).map(type=>({type,tiles:Array.from({length:type+1},(_,i)=>({id:`TEST-STACK:${type}:${i}`,type}))}))})};
 await page.addInitScript(saved=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',saved);},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');const inventory=page.locator('.estate-inventory').first(),goods=inventory.locator('.player-goods-storage');
 for(const zoom of [1,1.6,2]){
  await page.evaluate(z=>{document.body.style.zoom=String(z);},zoom);await inventory.scrollIntoViewIfNeeded();
  await expect(goods.locator('[data-goods-layer]')).toHaveCount(9);await expect(goods.locator('button>strong,button>b')).toHaveCount(0);
  const boxes=await goods.locator('[data-goods-slot]').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width};}));
  const bounds=(await inventory.boundingBox())!;for(let i=0;i<boxes.length;i++){expect(boxes[i].x).toBeGreaterThanOrEqual(bounds.x);expect(boxes[i].right).toBeLessThanOrEqual(bounds.x+bounds.width+1);for(let j=0;j<i;j++)expect(boxes[i].x>=boxes[j].right||boxes[j].x>=boxes[i].right||boxes[i].y>=boxes[j].bottom||boxes[j].y>=boxes[i].bottom).toBe(true);}
  const tile=await goods.locator('[data-goods-layer]').first().boundingBox();expect(tile!.width).toBeCloseTo(52*zoom,0);
  await inventory.screenshot({path:`.local-data/player-improvements/${info.project.name}-inventory-${zoom*100}.png`});
  await inventory.getByRole('button',{name:/개인 주사위 1 눈/}).click();await goods.locator('[data-goods-type="1"]').click();await expect(goods.locator('[data-goods-layer]')).toHaveCount(7);
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect(goods.locator('[data-goods-layer]')).toHaveCount(9);
 }
});
