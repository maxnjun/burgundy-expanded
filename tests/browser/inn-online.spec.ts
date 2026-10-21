import {chooseOnlineStart} from "./starting-castles";
import {test,expect,type Route} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {isolatedRooms} from "./isolated-rooms";
import {applyCoreAction} from "../../src/game/core";

test('online inn option and real stack purchase synchronize across two clients and reconnect',async({page,browser})=>{
 const isolated=await isolatedRooms(),context=await browser.newContext({viewport:{width:1280,height:900}});
 try{
  const route=async(r:Route)=>{const req=r.request(),response=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});};
  await page.context().route('**/api/rooms{,/**}',route);await context.route('**/api/rooms{,/**}',route);const guest=await context.newPage();
  await page.goto('/online');await page.getByLabel('온라인 이름').fill('여관온라인A');await page.getByLabel('온라인 여관 확장',{exact:true}).check();await page.getByRole('button',{name:'2인 방 만들기',exact:true}).click();
  const code=await page.getByLabel('공유할 방 코드').inputValue();await guest.goto('/online');await guest.getByLabel('온라인 이름').fill('여관온라인B');await guest.getByLabel('방 코드',{exact:true}).fill(code);await guest.getByRole('button',{name:'방 참가',exact:true}).click();
  await chooseOnlineStart(page);await chooseOnlineStart(guest);
  await expect(guest.getByLabel('온라인 여관 스택',{exact:true})).toBeVisible();const path=join(isolated.directory,`${code}.json`),room=JSON.parse(await readFile(path,'utf8')),rolled=applyCoreAction(room.game,{type:'roll-round',playerId:'seat-1'});expect(rolled.ok).toBe(true);if(!rolled.ok)return;
  room.game=rolled.value.state;room.game.players[0].silver=4;await writeFile(path,JSON.stringify(room));await page.reload();
  const stack=page.locator('[data-inn-stack]');await expect(stack).toHaveAttribute('aria-disabled','false');await stack.locator('[data-inn-hit]').click();
  await expect(stack.locator('[data-inn-layer]')).toHaveCount(0);await expect(guest.locator('[data-inn-layer]')).toHaveCount(0);await guest.reload();await expect(guest.locator('[data-inn-layer]')).toHaveCount(0);
  await page.getByLabel('온라인 여관 스택',{exact:true}).screenshot({path:'.local-data/qa/inn-online-purchased.png'});
 }finally{await context.close();await isolated.close();}
});
