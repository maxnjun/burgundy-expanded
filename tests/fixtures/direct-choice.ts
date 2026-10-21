import type {Page} from '@playwright/test';
import type {GameState,PendingChoice,ActionIntent} from '../../src/game/types';

/** Drive the real board controls for the engine option; abstract effects retain their existing UI. */
export async function clickChoice(page:Page,g:GameState,o:PendingChoice['options'][number]){
 const p=o.payload as {intent?:ActionIntent;depot?:number;goodsIds?:string[];shield?:{slotId:string;castleCellId:string}}|null;
 const player=g.players.find(x=>x.id===g.turn.activePlayerId)!;
 if(p?.intent){const i=p.intent;
  if(i.kind==='take-workers'){await page.getByLabel('일꾼 자원',{exact:true}).click();return;}
  if(i.kind==='sell-goods'){await page.locator('.estate-panel').filter({has:page.getByRole('heading',{name:new RegExp(`^${player.name}의 영지`)})}).getByRole('button',{name:new RegExp(`^${i.goodsType}번 상품 .* 판매$`)}).click();return;}
  if(i.kind==='take-tile'){await page.locator(`[data-tile-id="${i.tileId}"]`).click();if(i.discardTileId){await page.getByRole('button',{name:new RegExp(`^${player.name} 개인 보관 ${i.storageSlot+1} `)}).click();}return;}
  if(i.kind==='place-tile'){const n=player.storage.indexOf(i.tileId)+1;await page.getByRole('button',{name:new RegExp(`^${player.name} 개인 보관 ${n} `)}).click();await page.getByRole('button',{name:new RegExp(`^${player.name} ${i.cellId} `)}).click();return;}
 }
 if(p?.shield){await page.locator(`[data-shield-slot="${p.shield.slotId}"]`).click();await page.getByRole('button',{name:new RegExp(`^${player.name} ${p.shield.castleCellId} `)}).click();return;}
 if(p?.depot!==undefined&&p.goodsIds){await page.locator(`[data-goods-space="${p.depot}"]`).click();const types=[...new Set(g.market.numberedDepots.find(d=>d.number===p.depot)!.goods.filter(x=>p.goodsIds!.includes(x.id)).map(x=>x.type))];for(const t of types){const button=page.getByRole('button',{name:`${p.depot}번 공급처 상품 ${t}번 종류 선택`,exact:true});if(await button.getAttribute('aria-disabled')==='false')await button.click();}return;}
 await page.getByLabel('타일 효과 선택',{exact:true}).getByRole('button',{name:o.label,exact:true}).first().click();
}
