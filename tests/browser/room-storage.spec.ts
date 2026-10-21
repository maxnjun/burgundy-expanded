import {test,expect} from "@playwright/test";
import {isolatedRooms} from "./isolated-rooms";

test("definitive storage rejection explains the cause, clears retry state and allows a fresh room",async({page})=>{
 const isolated=await isolatedRooms();let fail=true,attempts=0;
 await page.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
 await page.route("**/api/rooms{,/**}",async route=>{
  const req=route.request();if(req.method()==="POST"&&new URL(req.url()).pathname==="/api/rooms"){attempts++;if(fail){await route.fulfill({status:503,json:{error:"서버 디스크의 남은 저장 공간이 부족합니다. 기존 방은 보존됩니다.",code:"ROOM_STORAGE_FULL"}});return;}}
  const response=await fetch(isolated.url+new URL(req.url()).pathname,{method:req.method(),headers:{...req.headers(),host:new URL(isolated.url).host,origin:isolated.url},body:req.postData()??undefined});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 try{
  await page.goto("/online");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();await expect(page.getByRole("alert",{name:"온라인 오류"})).toContainText("디스크");await expect(page.getByRole("button",{name:"중단된 방 연결 다시 시도",exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("burgundy-online-pending")))).toEqual([]);await page.reload();await expect(page.getByRole("button",{name:"2인 방 만들기",exact:true})).toBeEnabled();expect(attempts).toBe(1);
  fail=false;await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();await expect(page.getByLabel("공유할 방 코드")).toHaveValue(/^[a-f0-9]{24}$/);await expect(page.getByRole("button",{name:"중단된 방 연결 다시 시도",exact:true})).toHaveCount(0);
 }finally{await isolated.close();}
});

test("a full room does not leave a misleading interrupted-connection banner",async({page})=>{
 await page.route("**/api/rooms/*/join",route=>route.fulfill({status:409,json:{error:"이미 두 좌석이 사용 중입니다."}}));
 await page.goto(`/online?room=${"a".repeat(24)}`);await expect(page.getByLabel("방 코드",{exact:true})).toHaveValue("a".repeat(24));await page.getByRole("button",{name:"방 참가",exact:true}).click();await expect(page.getByRole("alert",{name:"온라인 오류"})).toContainText("두 좌석");await expect(page.getByRole("button",{name:"중단된 방 연결 다시 시도",exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("burgundy-online-pending")))).toEqual([]);
});
