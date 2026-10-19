import {test,expect} from "@playwright/test";
test("local ranges show two distinct previews, persist selection and start selected fortress boards",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/ゲーム準備|게임 준비/}).click();await page.getByRole('checkbox',{name:'랜덤 후보2개 중 영지 선택',exact:true}).check();
 for(const id of ['seat-1','seat-2']){await page.getByLabel(`${id} 보드 범위`,{exact:true}).selectOption('fortress');const candidates=page.getByRole('region',{name:`${id} 영지 후보`,exact:true});await expect(candidates.getByRole('button')).toHaveCount(2);await candidates.getByRole('button').first().click();}
 const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:board-draft-v1')!));
 await page.screenshot({path:".local-data/qa/board-draft-local.png",fullPage:true});
 await page.reload();await page.getByRole('button',{name:/게임 준비/}).click();
 for(const id of ['seat-1','seat-2'])await expect(page.getByRole('region',{name:`${id} 영지 후보`,exact:true}).locator('[aria-pressed="true"]')).toHaveCount(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:board-draft-v1')!))).toEqual(draft);
 await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.map((p:{duchy:{boardId:string}})=>p.duchy.boardId))).toEqual(draft.seats.slice(0,2).map((s:{selected:string})=>s.selected));
 await expect(page.locator('[data-fortress-line]')).toHaveCount(6);
});
test("AI picks its own candidate automatically",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/게임 준비/}).click();await page.getByRole('checkbox',{name:'랜덤 후보2개 중 영지 선택',exact:true}).check();await page.getByLabel('플레이 방식',{exact:true}).selectOption('computer');
 await expect(page.getByRole('region',{name:'seat-2 영지 후보',exact:true}).locator('[aria-pressed="true"]')).toHaveCount(1);
 await expect(page.getByRole('region',{name:'seat-2 영지 후보',exact:true}).getByRole('button').first()).toBeDisabled();
});
test("four local seats start with their individually selected candidates",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/게임 준비/}).click();await page.getByLabel('플레이어 수',{exact:true}).selectOption('4');
 await page.getByRole('checkbox',{name:'랜덤 후보2개 중 영지 선택',exact:true}).check();
 for(const id of ['seat-1','seat-2','seat-3','seat-4']){await page.getByLabel(`${id} 보드 범위`,{exact:true}).selectOption('all');await page.getByRole('region',{name:`${id} 영지 후보`,exact:true}).getByRole('button').last().click();}
 const selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:board-draft-v1')!).seats.map((s:{selected:string})=>s.selected));
 await page.getByRole('button',{name:'새 연습 시작',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.map((p:{duchy:{boardId:string}})=>p.duchy.boardId))).toEqual(selected);
});
