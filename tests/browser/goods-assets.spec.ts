import {test,expect,type Page} from '@playwright/test';
import {setup} from '../fixtures/shields';
import {serializeSavedGame} from '../../src/game/save';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CommonBoard} from '../../src/app/common-board';
import type {GameState} from '../../src/game/types';

const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
async function install(page:Page){
 const initial=setup(),game:GameState={...initial,players:initial.players.map((p,i)=>i?p:{...p,soldGoods:[{id:'goods-art:sold',type:2}],goods:([1,4,6] as const).map(type=>({type,tiles:[{id:`goods-art:${type}`,type}]}))})};
 await page.addInitScript(s=>{if(!sessionStorage.getItem('goods-art-installed')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('goods-art-installed','1');}},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));
 await page.goto('/');await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));return JSON.parse(JSON.stringify(game));
}
async function decoded(page:Page){
 return page.locator('[data-goods-image]').evaluateAll(async nodes=>Promise.all(nodes.map(async n=>{
  const im=new Image();im.src=n.getAttribute('href')!;await im.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const ctx=canvas.getContext('2d')!;ctx.drawImage(im,0,0);return {width:im.naturalWidth,height:im.naturalHeight,corner:ctx.getImageData(0,0,1,1).data[3]};
 })));
}
test('all six approved faces and common back keep geometry in both designs and at 100 160 200 percent',async({page},info)=>{
 const g=await install(page),inventory=page.locator('.estate-inventory').first(),common=page.locator('.common-board-panel');
 await inventory.screenshot({path:info.outputPath('inventory-before-or-after.png')});await common.screenshot({path:info.outputPath('common-before-or-after.png')});
 if(process.env.GOODS_ASSETS_BEFORE)return;
 await expect(inventory.locator('[data-goods-back] image')).toHaveAttribute('data-goods-image','goods_back.png');
 for(const on of [false,true]){
  await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await page.getByRole('switch',{name:'디자인 1',exact:true}).setChecked(on);await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-design-1',on?'on':'off');
  await inventory.locator('.sold-goods-trigger').click();const dialog=page.getByRole('dialog',{name:/상품 판매 내역/});
  for(let value=1;value<=6;value++){
   const art=dialog.locator(`[data-goods-value="${value}"]`);await expect(art.locator('image')).toHaveAttribute('data-goods-image',`goods_${value}.png`);await expect(art.locator('rect,path,[data-white-die]')).toHaveCount(0);
  }
  const images=await decoded(page);expect(images.length).toBeGreaterThan(7);for(const im of images)expect(im).toEqual({width:768,height:768,corner:0});
  await dialog.screenshot({path:info.outputPath(`six-faces-design-${on?'on':'off'}.png`)});
  // Clone the actual shared renderers into a temporary QA sheet, never a game route.
  await page.evaluate(()=>{const sheet=document.createElement('section');sheet.id='goods-qa';sheet.style.cssText='position:fixed;inset:8px;z-index:2000;background:#f6ebcf;display:grid;grid-template-columns:repeat(3,1fr);align-content:center;gap:8px;padding:12px;overflow:auto';for(const n of [...document.querySelectorAll('.sold-goods-types [data-goods-value]'),document.querySelector('[data-goods-back]')!]){const clone=n.cloneNode(true) as SVGSVGElement;clone.style.cssText='width:100%;height:auto;max-height:23vh';sheet.append(clone);}document.body.append(sheet);});
  await page.locator('#goods-qa').screenshot({path:info.outputPath(`seven-assets-design-${on?'on':'off'}.png`)});await page.evaluate(()=>document.querySelector('#goods-qa')!.remove());
  await page.getByRole('button',{name:'상품 판매 내역 닫기',exact:true}).click();
  await common.screenshot({path:info.outputPath(`common-design-${on?'on':'off'}.png`),style:'.direct-toolbar{visibility:hidden !important}'});
  for(const zoom of [1,1.6,2]){
   await page.evaluate(z=>document.body.style.zoom=String(z),zoom);await inventory.scrollIntoViewIfNeeded();const b=await inventory.locator('[data-goods-layer]').first().boundingBox();expect(b!.width).toBeCloseTo(52*zoom,0);expect(b!.height).toBeCloseTo(52*zoom,0);
   await inventory.screenshot({path:info.outputPath(`inventory-${on?'on':'off'}-${zoom*100}.png`)});
  }
  await page.evaluate(()=>document.body.style.zoom='1');expect(await current(page)).toEqual(g);
 }
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-design-1','on');expect(await current(page)).toEqual(g);
});

test('redacted board goods use one anonymous back and public goods keep their faces through reload',async({page})=>{
 const g=await install(page),waiting=page.locator('[data-round-supply][data-supplied=false]');
 await expect(waiting.locator('[data-goods-value]')).toHaveCount(4);
 // Current phases reveal five goods. Exercise the existing redacted-view fallback without changing that rule.
 const redacted={...g,market:{...g.market,roundGoods:Array(4).fill(null),revealedPhaseGoods:undefined}};
 const markup=renderToStaticMarkup(createElement(CommonBoard,{game:redacted,selectedTileId:null,onSelect:()=>{},titleFor:()=>'',zoom:1,onZoom:()=>{},showCosts:false,actionFor:()=>null,costFor:()=>0}));
 await page.setContent(markup);
 await expect(waiting).toHaveCount(4);await expect(waiting.locator('[data-goods-value]')).toHaveCount(0);await expect(waiting.locator('[data-goods-image="goods_back.png"]')).toHaveCount(4);
 const urls=await waiting.locator('image').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));expect(new Set(urls).size).toBe(1);expect(urls[0]).toMatch(/^\/assets\/goods\/goods_back\.png\?v=/);
 await expect(waiting.locator('[data-goods-back]')).toHaveCount(4);await page.reload();await expect(waiting.locator('[data-goods-value]')).toHaveCount(4);expect(await current(page)).toEqual(g);
});

test('missing approved art preserves usable numbered fronts and anonymous backs',async({page})=>{
 await page.route('**/assets/goods/goods_1.png*',r=>r.abort());await page.route('**/assets/goods/goods_back.png*',r=>r.abort());await install(page);
 const inventory=page.locator('.estate-inventory').first();await expect(inventory.locator('[data-goods-layer][data-goods-value="1"] [data-white-die="1"] circle')).toHaveCount(1);
 const backs=inventory.locator('[data-goods-back]');await expect(backs).toHaveCount(1);await expect(backs.locator('image')).toHaveCount(0);await expect(backs.locator('[data-goods-value],[data-white-die],text')).toHaveCount(0);await expect(backs.locator('rect')).toHaveCount(1);
});
