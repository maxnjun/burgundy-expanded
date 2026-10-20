import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction} from '../../src/game/core';
import {serializeSavedGame} from '../../src/game/save';
import type {GameState} from '../../src/game/types';

// TEST FIXTURE: real setup/roll; extra resources and fixed dice make both purchases deterministic.
function fixture(count:number):GameState {
 const initial=createPracticeSession({names:Array.from({length:count},(_,i)=>`공급${i+1}`),seed:'vine-supply-layout',boardIds:Array(count).fill('se:base:2'),officialSlots:true,shieldRules:true,vineyards:true,fullEffects:true});
 const rolled=applyCoreAction(initial,{type:'roll-round',playerId:'seat-1'});if(!rolled.ok)throw Error('fixture roll');const g=rolled.value.state;
 return {...g,players:g.players.map(p=>({...p,workers:30,silver:10})),dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],value:1},{...g.dice.players['seat-1'][1],value:4}]}}};
}
async function ready(page:Page,count:number){await expect(page.getByRole('region',{name:'공용 포도 공급처',exact:true})).toBeVisible();await expect(page.locator('[data-shield-slot]')).toHaveCount(count===2?6:count===3?9:12);}
for(const count of [2,3,4])test(`vine supply ${count}p shared occupied/empty frames preserve size, clicks and real shop purchase`,async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','PC 전용 검증; 모바일 정밀 QA는 후속');
 const game=fixture(count),saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:['TEST FIXTURE · 포도 공급 UI'],view:{zoom:1,commonZoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(v=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',v);},saved);await page.goto('/');await ready(page,count);
 const supply=page.getByRole('region',{name:'공용 포도 공급처',exact:true}),depot=supply.locator('[data-vine-supply-kind="depot"] button').first(),shop=supply.locator('[data-vine-supply-kind="store"] button').first();
 await expect(supply.locator('[data-vine-supply-kind="depot"] button')).toHaveCount(count===4?6:3);await expect(supply.locator('[data-vine-supply-kind="store"] button')).toHaveCount(count===2?1:3);
 for(const zoom of [1,1.6,2]){
  await page.evaluate(z=>{const s=JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!);s.view.commonZoom=z;localStorage.setItem('burgundy-expanded:local-v1',JSON.stringify(s));},zoom);await page.reload();await ready(page,count);await expect(page.getByRole('button',{name:'공용 보드 배율 복원',exact:true})).toHaveText(`${zoom*100}%`);
  expect((await page.locator('.common-board-svg').boundingBox())!.width).toBeCloseTo(950*zoom,1);expect((await page.locator('.common-board-panel').boundingBox())!.width).toBeCloseTo(950,1);expect((await supply.boundingBox())!.width).toBeCloseTo(360,1);
  const main=(await page.locator('.common-board-panel').boundingBox())!,side=(await supply.boundingBox())!;expect(side.x-main.x-main.width).toBeCloseTo(18,1);
  for(const button of await supply.locator('.vineyard-depots button').all()){
   const art=(await button.locator('svg').boundingBox())!;expect(art.width).toBeCloseTo(140,1);expect(art.height).toBeCloseTo(79.8,1);
   await button.scrollIntoViewIfNeeded();await button.evaluate(el=>{const b=el.getBoundingClientRect();window.scrollBy(0,b.y+b.height/2-innerHeight/2);});
   expect(await button.evaluate(el=>{const b=el.querySelector('svg')!.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!hit&&el.contains(hit);})).toBe(true);
  }
 }
 const reset=async()=>{await page.evaluate(v=>localStorage.setItem('burgundy-expanded:local-v1',v),saved);await page.reload();await ready(page,count);};await reset();
 const measure=async(locator:typeof depot)=>locator.evaluate(el=>{const b=el.getBoundingClientRect(),svg=el.querySelector('svg')!,s=svg.getBoundingClientRect();return{button:[b.width,b.height],art:[s.width,s.height],path:svg.querySelector('[data-vine-tile-frame]')!.getAttribute('d')};});
 const before=await measure(depot),panelHeight=(await supply.boundingBox())!.height;
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await depot.click();await expect(depot.locator('[data-vine-tile="empty"]')).toBeVisible();
 const empty=await measure(depot);expect(empty).toEqual(before);expect((await supply.boundingBox())!.height).toBeCloseTo(panelHeight,1);
 await page.reload();await ready(page,count);await expect(depot.locator('[data-vine-tile="empty"]')).toBeVisible();expect(await measure(depot)).toEqual(before);
 await reset();const shopBefore=await measure(shop);await expect(shop).toBeEnabled();await shop.click();await expect(shop.locator('[data-vine-tile="empty"]')).toBeVisible();expect(await measure(shop)).toEqual(shopBefore);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(8);
 await page.reload();await ready(page,count);await expect(shop.locator('[data-vine-tile="empty"]')).toBeVisible();expect(await measure(shop)).toEqual(shopBefore);
 mkdirSync('.local-data/common-expanded/followup',{recursive:true});writeFileSync(`.local-data/common-expanded/followup/verified-${count}p-sizes.json`,JSON.stringify({before,empty,shopBefore,shopEmpty:await measure(shop),panelHeight},null,2));
 await page.setViewportSize({width:1440,height:1900});await supply.screenshot({path:`.local-data/common-expanded/followup/verified-${count}p-store-empty.png`});
});
