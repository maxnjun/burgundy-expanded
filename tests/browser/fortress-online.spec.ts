import {chooseOnlineStart,startOnlineLobby} from "./starting-castles";
import {test,expect,type Route} from "@playwright/test";
import {isolatedRooms} from "./isolated-rooms";
test("online each seat chooses its own saved candidate before game start",async({page,browser})=>{
 const isolated=await isolatedRooms(),context=await browser.newContext({viewport:{width:1280,height:900}});
 const proxy=async(route:Route)=>{const req=route.request(),r=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});};
 try{
  await page.context().route('**/api/rooms{,/**}',proxy);await context.route('**/api/rooms{,/**}',proxy);const guest=await context.newPage();
  await page.goto('/online');await page.getByRole('checkbox',{name:'랜덤 후보2개 중 영지 선택',exact:true}).check();await page.getByLabel('온라인 초기 영지 범위',{exact:true}).selectOption('fortress');await page.getByRole('button',{name:'2인 방 만들기',exact:true}).click();
  const code=await page.getByLabel('공유할 방 코드',{exact:true}).inputValue();await guest.goto('/online');await guest.getByLabel('방 코드',{exact:true}).fill(code);await guest.getByRole('button',{name:'방 참가',exact:true}).click();
  await expect(page.getByLabel("온라인 상태",{exact:true})).toContainText("상태 1");
  const own=page.getByRole('region',{name:'seat-1 영지 후보',exact:true});await expect(own.getByRole('button').first()).toBeEnabled();await expect(page.getByRole('region',{name:'seat-2 영지 후보',exact:true}).getByRole('button').first()).toBeDisabled();
  const selectedResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/actions'));await own.getByRole('button').first().click();expect((await selectedResponse).status()).toBe(200);await expect(own.locator('[aria-pressed="true"]')).toHaveCount(1);await page.reload();await expect(page.getByRole('region',{name:'seat-1 영지 후보',exact:true}).locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(guest.getByRole('region',{name:'seat-1 영지 후보',exact:true}).locator('[aria-pressed="true"]')).toHaveCount(1);
  const other=guest.getByRole('region',{name:'seat-2 영지 후보',exact:true});await expect(other.getByRole('button').last()).toBeEnabled();await other.getByRole('button').last().click();
  await expect(page.getByRole('region',{name:'온라인 영지 선택',exact:true})).toHaveCount(0);await expect(guest.getByRole('region',{name:'온라인 영지 선택',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-fortress-line]')).toHaveCount(6);await expect(guest.locator('[data-fortress-line]')).toHaveCount(6);
  await startOnlineLobby(page,guest);await chooseOnlineStart(page);await chooseOnlineStart(guest);
  await expect(page.getByRole('button',{name:'주사위 굴리기',exact:true})).toBeVisible();
 }finally{await context.close();await isolated.close();}
});
