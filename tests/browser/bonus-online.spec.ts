import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isolatedRooms} from './isolated-rooms';
import {setup,placed,mount} from '../fixtures/shields';
import {prepareTileEffect} from '../../src/game/core/effects';
import type {RoomView} from '../../src/server/rooms';
test('online direct castle action and real die preserve both sources through refresh',async({page},info)=>{
 const isolated=await isolatedRooms();try{
  const create=await fetch(isolated.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A',shieldRules:true})});const owner=await create.json();
  await fetch(`${isolated.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'B'})});
  const path=join(isolated.directory,`${owner.id}.json`),room=JSON.parse(await readFile(path,'utf8'));let g=placed(setup(),0,{type:'castle',back:'matching-color'});const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='castle').at(-1)!.tileId!;g={...prepareTileEffect(g,'seat-1',id),revision:g.revision+1};room.game=g;await writeFile(path,JSON.stringify(room));
  await page.route('**/api/rooms{,/**}',async route=>{const q=route.request(),res=await fetch(isolated.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:q.postData()??undefined});await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});
  await page.addInitScript(owner=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(owner)),owner);await page.goto('/online');await expect(page.getByLabel('온라인 일꾼 획득',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'온라인 주사위 1',exact:true}).click();await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();await expect(page.getByRole('button',{name:'온라인 주사위 1',exact:true})).toBeDisabled();await page.reload();await expect(page.getByLabel('온라인 일꾼 획득',{exact:true})).toBeEnabled();await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();
  const view=async()=>{const r=await fetch(`${isolated.url}/api/rooms/${owner.id}`,{headers:{Authorization:`Bearer ${owner.token}`}});return await r.json() as RoomView;};
  await expect.poll(async()=>(await view()).players[0].workers).toBe(g.players[0].workers+4);const after=await view();expect(after.castleAction).toBe(false);expect(after.dice.players['seat-1'].filter(d=>d.used).length).toBe(1);
  let shieldGame=placed(mount(setup(),11),0,{type:'castle',back:'matching-color'});const castleId=shieldGame.players[0].duchy.cells.filter(c=>c.tileId&&shieldGame.tiles[c.tileId].type==='castle').at(-1)!.tileId!;shieldGame={...prepareTileEffect(shieldGame,'seat-1',castleId),revision:after.revision+1};const stored=JSON.parse(await readFile(path,'utf8'));stored.game=shieldGame;await writeFile(path,JSON.stringify(stored));await page.reload();
  const fresh=await view(),free=fresh.actions.find(a=>a.target.shield?.replaceShieldNumber===null)!;expect(free).toBeTruthy();await page.locator(`[data-shield-slot="${free.target.shield!.slotId}"]`).click();await page.getByRole('button',{name:new RegExp(`^온라인 규칙A 칸 ${free.target.shield!.castleCellId} `)}).click();await expect.poll(async()=>(await view()).castleAction).toBe(false);expect((await view()).dice).toEqual(shieldGame.dice);await expect(page.locator('[data-mounted-shield]')).toHaveCount(2);await page.screenshot({path:info.outputPath('online-direct-castle.png'),fullPage:true});
 }finally{await isolated.close();}
});
