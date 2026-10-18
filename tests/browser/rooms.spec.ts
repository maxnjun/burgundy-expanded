import { test, expect } from "@playwright/test";

test("two browser seats synchronize turns, reconnect and cannot impersonate each other",async({page,browser},info)=>{
  test.setTimeout(60_000);
  const otherContext=await browser.newContext({viewport:info.project.use.viewport});
  const guest=await otherContext.newPage();
  try{
    await page.goto("/online");await page.getByLabel("온라인 이름").fill("온라인A");const created=page.waitForResponse(r=>r.url().endsWith("/api/rooms")&&r.request().method()==="POST");await page.getByRole("button",{name:"2인 방 만들기",exact:true}).click();expect((await created).status()).toBe(200);
    const code=await page.getByLabel("공유할 방 코드").inputValue();expect(code).toMatch(/^[a-f0-9]{24}$/);
    await guest.goto("http://127.0.0.1:3000/online");await guest.getByLabel("온라인 이름").fill("온라인B");await guest.getByLabel("방 코드",{exact:true}).fill(code);await guest.getByRole("button",{name:"방 참가",exact:true}).click();
    await expect(page.getByRole("button",{name:"온라인 행동 실행",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"온라인 행동 실행",exact:true}).click();
    await expect(page.getByLabel("온라인 상태",{exact:true})).toContainText("온라인A의 차례");
    for(let i=0;i<2;i++){
      await page.getByLabel("온라인 행동 종류",{exact:true}).selectOption("take-workers");
      await page.getByRole("button",{name:"온라인 행동 실행",exact:true}).click();
      await expect(page.locator(".online-logs")).toContainText("일꾼2 획득");
    }
    await page.getByLabel("온라인 행동 종류",{exact:true}).selectOption("end-turn");await page.getByRole("button",{name:"온라인 행동 실행",exact:true}).click();
    await expect(guest.getByLabel("온라인 상태",{exact:true})).toContainText("온라인B의 차례");
    await guest.reload();await expect(guest.getByRole("button",{name:"온라인 행동 실행",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"온라인 행동 실행",exact:true})).toHaveCount(0);
    const auth=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!));
    const response=await page.request.get(`/api/rooms/${code}`,{headers:{Authorization:`Bearer ${auth.token}`}});expect(response.status()).toBe(200);
    const publicState=await response.json();expect(publicState.random).toBeUndefined();expect(publicState.supplyPools).toBeUndefined();
    const forged=await page.request.post(`/api/rooms/${code}/actions`,{headers:{Authorization:`Bearer ${auth.token}`},data:{revision:publicState.revision,action:{type:"end-turn",playerId:"seat-2"}}});expect(forged.status()).toBe(403);
    const unauthorized=await page.request.get(`/api/rooms/${code}`);expect(unauthorized.status()).toBe(401);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await otherContext.close();}
});
