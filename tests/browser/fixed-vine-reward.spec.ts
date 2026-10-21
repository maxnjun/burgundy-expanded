import {test,expect,type Route} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {vineFixture} from '../fixtures/vineyards';
import {applyCoreAction} from '../../src/game/core';
import {directActions} from '../../src/game/direct-actions';
import {refreshVineChoice} from '../../src/game/core/vineyard-effects';
import {serializeSavedGame} from '../../src/game/save';
import {isolatedRooms} from './isolated-rooms';

function legacyReward(){
 let g=vineFixture();for(const command of ['take','place']){const a=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command===command&&(command==='take'||a.intent.slotId==='V02'))!;const r=applyCoreAction(g,a);if(!r.ok)throw Error('fixture');g=r.value.state;}
 const pid='seat-1',id=`vine-order:${pid}:V02:0`;
 return refreshVineChoice({...g,players:g.players.map((p,i)=>i?p:{...p,silver:p.silver-2}),vineyards:{...g.vineyards!,players:{...g.vineyards!.players,[pid]:{...g.vineyards!.players[pid],placed:g.vineyards!.players[pid].placed.map(x=>({...x,used:[]}))}}},turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,id},pendingEffects:g.turn.pendingEffects.map(e=>({...e,id}))}});
}
test('old fixed vineyard reward resumes automatically once locally and on its own online seat',async({page,browser},info)=>{
 const g=legacyReward(),before=g.players[0].silver;
 await page.addInitScript(saved=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',saved);},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(before+2);await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players[0].silver)).toBe(before+2);
 const isolated=await isolatedRooms(),context=await browser.newContext({viewport:info.project.use.viewport});
 try{
  let drop=true;const route=async(r:Route)=>{const q=r.request();if(drop&&q.method()==='POST'&&q.url().endsWith('/actions')){drop=false;await r.abort('failed');return;}const res=await fetch(isolated.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
  await page.context().route('**/api/rooms{,/**}',route);await context.route('**/api/rooms{,/**}',route);
  await page.context().routeWebSocket('**/api/rooms/*/live',()=>{});await context.routeWebSocket('**/api/rooms/*/live',()=>{});
  const a=await(await fetch(`${isolated.url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'A',vineyards:true})})).json(),b=await(await fetch(`${isolated.url}/api/rooms/${a.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'B'})})).json();
  const path=join(isolated.directory,`${a.id}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game=g;await writeFile(path,JSON.stringify(room));
  const guest=await context.newPage();await guest.addInitScript(seat=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(seat)),b);await guest.goto('/online');await expect(guest.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(g.revision));expect(JSON.parse(await readFile(path,'utf8')).game.players[0].silver).toBe(before);
  await page.evaluate(seat=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(seat)),a);await page.goto('/online');await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).game.players[0].silver).toBe(before+2);expect(drop).toBe(false);await page.reload();await expect(guest.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(g.revision+1));expect(JSON.parse(await readFile(path,'utf8')).game.players[0].silver).toBe(before+2);
 }finally{await context.close();await isolated.close();}
});
