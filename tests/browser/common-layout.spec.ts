import { test, expect } from "@playwright/test";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction } from "../../src/game/core";
import { serializeSavedGame } from "../../src/game/save";

for (const [count,shields] of [[2,false],[4,false],[2,true],[4,true]] as const) test(`common board ${count} seats shields=${shields} preserves market and fitted hit targets`,async({page})=>{
 const setup=createPracticeSession({names:Array.from({length:count},(_,i)=>`배치${i+1}`),seed:"common-layout",shieldRules:shields,officialSlots:true,boardIds:Array(count).fill("se:base:2")});
 const rolled=applyCoreAction(setup,{type:"roll-round",playerId:"seat-1"});expect(rolled.ok).toBe(true);if(!rolled.ok)return;
 const game={...rolled.value.state,players:rolled.value.state.players.map(p=>({...p,silver:4}))};
 await page.addInitScript(value=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',value);},serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');const board=page.getByRole('region',{name:'공용 공급처 보드',exact:true});await expect(board).toBeVisible();await expect(board.getByText('배치1 ◀',{exact:true})).toBeVisible();
 await expect(board.locator('[data-shield-slot]')).toHaveCount(shields?(count===2?6:12):0);
 await expect(board.locator('[data-depot]')).toHaveCount(6);
 await expect(board.locator('.supply-art-tile')).toHaveCount(game.market.numberedDepots.reduce((n,d)=>n+d.slots.filter(s=>s.tileId).length,0)+game.market.blackDepot.filter(Boolean).length);
 await board.screenshot({path:`.local-data/qa/common-${process.env.LAYOUT_BEFORE?'before':'after'}-${count}${shields?'-shields':''}.png`});
 if(process.env.LAYOUT_BEFORE)return;
 await expect(board.locator('[data-board-decoration]')).toHaveAttribute('pointer-events','none');
 await expect(board.locator('[data-board-decoration] [role="button"]')).toHaveCount(0);
 await expect(board.locator('[data-board-decoration] image')).toHaveCount(0);
 await expect(board.locator('[data-tile-shadow]')).toHaveCount(await board.locator('.supply-art-tile').count());
 await expect(board.locator('[data-goods-space]')).toHaveCount(6);
 await expect(board.locator('[data-black-depot] > rect')).toHaveCount(0);
 const targets=board.locator('.supply-art-tile');
 for(let i=0;i<await targets.count();i++){
   const item=targets.nth(i);await item.scrollIntoViewIfNeeded();
   expect(await item.evaluate(el=>{const c=el.querySelector('[data-supply-hit]')!;const b=c.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!hit&&el.contains(hit);})).toBe(true);
 }
 if(count===2){
  const points=await board.locator('[data-black-space]').evaluateAll(els=>els.map(el=>el.getAttribute('points')!.split(' ').map(p=>p.split(',').map(Number).map(n=>n.toFixed(6)).join(','))));
  let edges=0;for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(points[i].filter(p=>points[j].includes(p)).length===2)edges++;
  expect(edges).toBe(5);
 }
 const black=board.locator('[data-black-depot] .supply-art-tile').first();await expect(black).toHaveAttribute('aria-disabled','false');await black.click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(2);
 await page.reload();await expect(board.locator('[data-black-depot] .supply-art-tile')).toHaveCount(game.market.blackDepot.filter(Boolean).length-1);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 await expect(board.locator('.direct-cost').first()).toBeVisible();
 await page.getByRole('button',{name:'공용 보드 확대',exact:true}).click();
 await expect(page.getByRole('button',{name:'공용 보드 배율 복원',exact:true})).toHaveText('125%');
 await board.screenshot({path:`.local-data/qa/common-costs-${count}${shields?'-shields':''}.png`});
});
