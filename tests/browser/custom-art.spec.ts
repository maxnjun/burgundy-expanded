import {assetUrl} from '../../src/app/runtime-assets';
import {expect,test,type Page} from '@playwright/test';
import {serializeSavedGame} from '../../src/game/save';
import {tileHexPoints} from '../../src/app/tile-frame';
import {areAxialNeighbors} from '../../src/game/boards';
import {customGame,moveTile} from '../fixtures/custom-rules';
import {customArtEstate} from '../fixtures/custom-art';
import {boundary,roundtrip,step} from '../fixtures/shields';
import type {GameState} from '../../src/game/types';

async function load(page:Page,game:GameState){
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{hotseat:true,zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{
  localStorage.setItem('burgundy-expanded:local-v1',s);
  localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off');
 },saved);
 await page.goto('/');
 await expect(page.getByRole('button',{name:'⚙ 게임 준비',exact:true})).toBeEnabled();
}

test('approved monastery faces share real estate edges and mounted shield 24 stays centered at 100 160 and 200 percent',async({page},info)=>{
 const {game,neighbours,bank}=customArtEstate();
 await load(page,game);
 const board=page.getByRole('group',{name:'왕실A 영지',exact:true});
 const faces=[1,30,31,32];
 for(const number of faces){
  const tile=board.locator(`[data-tile-art]:has(image[data-approved-monastery="${number}"])`);
  await expect(tile).toHaveAttribute('data-baked-tile-frame','approved-monastery');
  await expect(tile.locator('clipPath polygon')).toHaveAttribute('points',tileHexPoints());
  await expect(tile.locator('[data-tile-backdrop],[data-rim-band],text')).toHaveCount(0);
 }
 const mounted=board.locator('[data-mounted-shield="24"]');
 await expect(mounted.locator('image[data-shield-image="24"]')).toBeAttached();
 await expect(mounted.locator('[data-mounted-shield-scale]')).toHaveAttribute('transform','scale(1.18)');
 const anchors=neighbours.concat(bank).map(id=>game.players[0].duchy.cells.find(c=>c.id===id)!);
 const pairs=anchors.flatMap((a,i)=>anchors.slice(i+1).filter(b=>areAxialNeighbors(a.coord,b.coord)).map(b=>[a.tileId!,b.tileId!] as const));
 expect(pairs.length).toBeGreaterThanOrEqual(4);
 const enlarge=page.getByRole('button',{name:'왕실A 영지 확대',exact:true});
 let zoom=100;
 for(const level of [100,160,200]){
  while(zoom<level){await enlarge.click();zoom+=10;}
  const greatestGap=await board.evaluate((root,pairs)=>{
   const polygon=(id:string)=>{
    const p=root.querySelector<SVGPolygonElement>(`[data-tile-art="${id}"] clipPath polygon`)!;
    const ctm=p.ownerSVGElement!.getScreenCTM()!;
    return Array.from(p.points).map(p=>new DOMPoint(p.x,p.y).matrixTransform(ctm));
   };
   return Math.max(...pairs.map(([a,b])=>{
    const left=polygon(a),right=polygon(b);
    const matches=left.map(p=>Math.min(...right.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))).sort((x,y)=>x-y);
    return matches[1];
   }));
  },pairs);
  expect(greatestGap).toBeLessThan(.1);
  await board.screenshot({path:info.outputPath(`estate-${level}.png`)});
 }
 await mounted.locator('..').screenshot({path:info.outputPath('castle-with-shield-24.png')});
 await mounted.locator('..').click();
 const detail=page.getByRole('dialog',{name:'방패 상세',exact:true});
 await expect(detail.locator('image[data-shield-image="24"]')).toBeAttached();
 await expect(detail).toContainText('기본 종료 승점 12점');
 await detail.getByRole('button',{name:'방패 상세 닫기'}).click();
 await expect(detail).toHaveCount(0);
});

test('monastery 31 keeps its black-supply identity with the approved yellow face',async({page},info)=>{
 const initial=customGame(),moved=moveTile(initial,t=>t.type==='monastery'&&t.number===31);
 const m=moved.game.market,replaced=m.blackDepot[0];
 const game=roundtrip({...moved.game,market:{...m,blackDepot:m.blackDepot.map((id,i)=>i===0?moved.tileId:id),
  removedTileIds:[...m.removedTileIds,...(replaced?[replaced]:[])]},players:moved.game.players.map(p=>({...p,storage:p.storage.map(id=>id===moved.tileId?null:id)}))});
 expect(game.tiles[moved.tileId].back).toBe('black');
 await load(page,game);
 const black=page.locator('[data-black-depot]');
 const approved=black.locator('image[data-approved-monastery="31"]');
 await expect(approved).toBeAttached();
 await expect(approved).toHaveAttribute('href',assetUrl("/assets/tiles/monastery/final/monastery-31.png"));
 const diamond=await approved.evaluate(async el=>{
  const image=new Image();
  image.src=el.getAttribute('href')!;
  await image.decode();
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=1;
  const pixels=canvas.getContext('2d')!;
  pixels.drawImage(image,384,685,1,1,0,0,1,1);
  return Array.from(pixels.getImageData(0,0,1,1).data);
 });
 expect(diamond[3]).toBe(255);
 expect(Math.max(...diamond.slice(0,3))).toBeLessThan(80);
 await black.screenshot({path:info.outputPath('black-supply-31.png')});
});

test('the real phase upkeep prompt displays approved shield 24',async({page},info)=>{
 const {game}=customArtEstate();
 const upkeep=step(boundary(game),{type:'advance-phase',playerId:'seat-1'});
 await load(page,upkeep);
 const prompt=page.getByLabel('방패 유지 또는 제거',{exact:true});
 await expect(prompt.locator('image[data-shield-image="24"]')).toBeAttached();
 await expect(prompt.getByRole('button',{name:'방패 유지',exact:true})).toBeEnabled();
 await prompt.screenshot({path:info.outputPath('shield-24-upkeep.png')});
});
