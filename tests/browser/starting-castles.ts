import {expect,type Page} from '@playwright/test';

export async function chooseLocalStarts(page:Page,count:number){
 for(let i=0;i<count;i++){
  const cell=page.locator('[data-can-start="true"]').first();await expect(cell).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.reduce((n:number,p:{duchy:{cells:{tileId:string|null}[]}})=>n+p.duchy.cells.filter(c=>c.tileId).length,0));
  await cell.click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game.players.reduce((n:number,p:{duchy:{cells:{tileId:string|null}[]}})=>n+p.duchy.cells.filter(c=>c.tileId).length,0))).toBe(before+1);
 }
}
export async function chooseOnlineStart(page:Page){
 const revision=await page.evaluate(async()=>{const seat=JSON.parse(localStorage.getItem('burgundy-online-seat-v1')!);const response=await fetch(`/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`},cache:'no-store'});if(!response.ok)throw Error('Room refresh failed');return (await response.json()).revision as number;});
 await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(revision));
 const cell=page.locator('[data-can-start="true"]').first();await expect(cell).toBeVisible();await cell.click();await expect(page.locator('[data-can-start="true"]')).toHaveCount(0);
}
