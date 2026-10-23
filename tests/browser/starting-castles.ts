import {expect,type Page} from '@playwright/test';

export async function chooseLocalStarts(page:Page,count:number){
 for(let i=0;i<count;i++){
  const cell=page.locator('[data-can-start="true"]').first();await expect(cell).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.reduce((n:number,p:{duchy:{cells:{tileId:string|null}[]}})=>n+p.duchy.cells.filter(c=>c.tileId).length,0));
  await cell.click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.reduce((n:number,p:{duchy:{cells:{tileId:string|null}[]}})=>n+p.duchy.cells.filter(c=>c.tileId).length,0))).toBe(before+1);
 }
}
export async function waitOnlineFresh(page:Page){
 const revision=await page.evaluate(async()=>{const seat=JSON.parse(localStorage.getItem('burgundy-online-seat-v1')!);const response=await fetch(`/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`},cache:'no-store'});if(!response.ok)throw Error('Room refresh failed');return (await response.json()).revision as number;});
 await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(revision));
}
export async function chooseOnlineStart(page:Page){
 await waitOnlineFresh(page);const cell=page.locator('[data-can-start="true"]').first();await expect(cell).toBeVisible();await cell.click();await expect(page.locator('[data-starting-preview="true"]')).toHaveCount(1);const confirmed=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/actions')&&r.request().postDataJSON()?.action?.type==='end-turn');await page.getByRole('button',{name:'턴 종료',exact:true}).click();expect((await confirmed).status()).toBe(200);await waitOnlineFresh(page);await expect(page.locator('[data-can-start="true"]')).toHaveCount(0);
}

export async function startOnlineLobby(host:Page,guest:Page){
 await waitOnlineFresh(host);const lobby=host.getByRole('region',{name:'게임 시작 준비',exact:true});
 if(!await lobby.count())return;
 await expect(guest.getByLabel('공유할 방 코드',{exact:true})).toBeVisible();await expect(lobby).toContainText('2/2명');await waitOnlineFresh(host);
 await lobby.getByRole('button',{name:'준비 완료',exact:true}).click();await expect(lobby.getByRole('button',{name:'준비 취소',exact:true})).toBeVisible();
 await waitOnlineFresh(guest);await guest.getByRole('region',{name:'게임 시작 준비',exact:true}).getByRole('button',{name:'준비 완료',exact:true}).click();
 await waitOnlineFresh(host);await lobby.getByRole('button',{name:'게임 시작',exact:true}).click();await expect(lobby).toHaveCount(0);await expect(guest.getByRole('region',{name:'게임 시작 준비',exact:true})).toHaveCount(0);
}
export async function startLobbyHttp(url:string,a:{id:string;token:string},b:{id:string;token:string}){
 for(const [seat,playerId,command] of [[a,'seat-1','ready'],[b,'seat-2','ready'],[a,'seat-1','start']] as const){
  const view=await(await fetch(`${url}/api/rooms/${a.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json();const response=await fetch(`${url}/api/rooms/${a.id}/actions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${seat.token}`},body:JSON.stringify({revision:view.revision,action:{type:'room-control',playerId,command,ready:true}})});expect(response.status).toBe(200);
 }
}
