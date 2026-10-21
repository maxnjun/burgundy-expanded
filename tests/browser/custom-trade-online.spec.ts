import {startOnlineLobby} from "./starting-castles";
import {test,expect,type Route} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {isolatedRooms} from "./isolated-rooms";
import {tradeFixture} from "../fixtures/custom-trade";
test('online two-seat route allocation, real sale and bonus selection sync after reconnect',async({page,browser})=>{
 const isolated=await isolatedRooms(),context=await browser.newContext({viewport:{width:1280,height:900}});
 try{
  const route=async(r:Route)=>{const q=r.request(),res=await fetch(isolated.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};await page.context().route('**/api/rooms{,/**}',route);await context.route('**/api/rooms{,/**}',route);const guest=await context.newPage();
  await page.goto('/online');await page.getByLabel('온라인 이름').fill('무역온라인A');await page.getByLabel('온라인 무역로 확장',{exact:true}).check();await page.getByRole('button',{name:'2인 방 만들기',exact:true}).click();const code=await page.getByLabel('공유할 방 코드').inputValue();
  await guest.goto('/online');await guest.getByLabel('온라인 이름').fill('무역온라인B');await guest.getByLabel('방 코드',{exact:true}).fill(code);await guest.getByRole('button',{name:'방 참가',exact:true}).click();await expect(guest.locator('.trade-route-panel')).toHaveCount(2);await startOnlineLobby(page,guest);
  const path=join(isolated.directory,`${code}.json`),room=JSON.parse(await readFile(path,'utf8'));room.game={...tradeFixture('white-castle'),revision:room.game.revision+1};await writeFile(path,JSON.stringify(room));await page.reload();
  await page.locator('.player-goods-storage button:enabled').first().click();await expect(page.locator('[data-trade-status=pending]')).toHaveCount(1);await expect(guest.locator('[data-trade-status=pending]')).toHaveCount(1);await guest.reload();await expect(guest.locator('[data-trade-status=pending]')).toHaveCount(1);
  await page.getByLabel('온라인 일꾼 획득',{exact:true}).click();await expect(page.locator('[data-trade-status=resolved]')).toHaveCount(1);await expect(guest.locator('[data-trade-status=resolved]')).toHaveCount(1);await page.locator('.trade-route-panel').first().screenshot({path:'.local-data/qa/custom-trade-online.png'});
 }finally{await context.close();await isolated.close();}
});
