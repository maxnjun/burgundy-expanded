import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {test,expect} from "@playwright/test";
import {TileArt} from "../../src/app/tile-art";
import {ShieldArt} from "../../src/app/shield-art";
import {ResourceIcon} from "../../src/app/resource-icon";
import {tileHexPoints,TILE_FRAME_INSET} from "../../src/app/tile-frame";
import {ESTATE_ART_HEIGHT as H} from "../../src/app/estate-geometry";
import type {Tile} from "../../src/game/types";
import {setup,placed,stash} from "../fixtures/shields";
import {serializeSavedGame} from "../../src/game/save";

const faces:Tile[]=[
 {id:"castle",type:"castle",back:"black"},{id:"mine",type:"mine",back:"black"},{id:"ship",type:"ship",back:"black"},
 ...["market","carpenters-workshop","church","warehouse","boarding-house","bank","town-hall","watchtower","crane","white-castle"].map(building=>({id:building,type:"building",building,back:"black"}) as Tile),
 ...["sheep","pigs","cattle","chickens","geese"].map(species=>({id:species,type:"livestock",species,count:2,back:"black"}) as Tile),
 ...Array.from({length:29},(_,i)=>i+1).map(number=>({id:`monastery-${number}`,type:"monastery",number,back:"black"}) as Tile),
 {id:"inn",type:"inn",back:"black"},
];

test("every tile face shares viewBox clip inward frame and readable resource sizes",async({page})=>{
 await page.goto("/");
 const gallery=renderToStaticMarkup(createElement("div",null,...faces.map(tile=>createElement("div",{key:tile.id,style:{display:"inline-block",width:110,textAlign:"center"}},tile.id,createElement(TileArt,{tile,width:100,height:H}))),createElement("div",null,...[16,20,24,32].flatMap(size=>[createElement(ResourceIcon,{key:`s${size}`,type:"silver",size}),createElement(ResourceIcon,{key:`w${size}`,type:"worker",size})])),createElement("svg",{width:200,height:80,viewBox:"-50 -40 200 80"},createElement(ShieldArt,{number:8}),createElement(ShieldArt,{number:3,numberSize:23,x:100}))));
 await page.setContent(`<body style="margin:12px;background:#f5ecd0">${gallery}</body>`);
 await page.locator('image,img').evaluateAll(async els=>Promise.all(els.map(async el=>{const i=new Image();i.src=el.getAttribute('href')??el.getAttribute('src')!;await i.decode();})));
 const tiles=page.locator('[data-tile-art]');await expect(tiles).toHaveCount(faces.length);
 await expect(tiles.locator('image[data-approved-building]')).toHaveCount(10);
 await expect(tiles.locator('image[data-approved-monastery]')).toHaveCount(29);
 await expect(tiles.locator('[data-rim-band]')).toHaveCount(27);
 for(const tile of await tiles.all()){
  const baked=['approved-beige','approved-monastery'].includes((await tile.getAttribute('data-baked-tile-frame'))??'');
  await expect(tile).toHaveAttribute('viewBox',`0 0 100 ${H}`);
  await expect(tile.locator('[data-tile-frame="common"]')).toHaveCount(baked?0:1);
  await expect(tile.locator('clipPath polygon')).toHaveAttribute('points',tileHexPoints(baked?0:TILE_FRAME_INSET));
  if(baked)await expect(tile.locator('[data-tile-backdrop],[data-rim-band]')).toHaveCount(0);else await expect(tile.locator('[data-tile-backdrop]')).toHaveAttribute('stroke','none');
 }
 const bands=await tiles.evaluateAll(els=>els.filter(el=>!el.hasAttribute('data-baked-tile-frame')).map(el=>[...el.querySelectorAll('[data-rim-band]')].map(p=>p.getAttribute('d')).join('|')));expect(new Set(bands).size).toBe(1);
 const sizes=await page.locator('img[data-resource-icon]').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return [b.width,b.height,getComputedStyle(e).objectFit];}));expect(sizes).toEqual([16,20,24,32].flatMap(n=>[[n,n,"contain"],[n,n,"contain"]]));
 const separation=await page.locator('[data-resource-shield]').evaluateAll(els=>els.map(g=>{const icon=g.querySelector<SVGGraphicsElement>('image')!.getBBox(),texts=g.querySelectorAll<SVGGraphicsElement>('text'),number=texts[0].getBBox(),score=texts[1].getBBox();return icon.y+icon.height<=number.y&&number.y+number.height<=score.y;}));expect(separation).toEqual([true,true]);
 await page.screenshot({path:'.local-data/tile-standard/all-faces-resources.png',fullPage:true});
});

test("mixed neighbours retain one shared edge at 100 160 200 percent",async({page})=>{
 await page.goto('/');
 const pair=renderToStaticMarkup(createElement('svg',{xmlns:"http://www.w3.org/2000/svg",viewBox:`0 0 200 ${H}`,width:200,height:H,"data-shared-pair":true},createElement(TileArt,{tile:faces[0],x:0,y:0,width:100,height:H}),createElement(TileArt,{tile:faces[2],x:100,y:0,width:100,height:H})));
 await page.setContent(`<body style="margin:0;background:#ff00ff">${pair}</body>`);
 await page.locator('image').evaluateAll(async els=>Promise.all(els.map(async el=>{const i=new Image();i.src=el.getAttribute('href')!;await i.decode();})));
 const board=page.locator('[data-shared-pair]');
 for(const zoom of [100,160,200]){
  await board.evaluate((el,{zoom,H})=>{el.setAttribute('width',String(2*zoom));el.setAttribute('height',String(H*zoom/100));},{zoom,H});
  await board.screenshot({path:`.local-data/tile-standard/mixed-pair-${zoom}.png`});
  const style=await page.addStyleTag({content:'image{visibility:hidden}[data-tile-backdrop]{fill:white!important}[data-rim-band]{fill:black!important}'});
  await board.screenshot({path:`.local-data/tile-standard/shared-rim-mask-${zoom}.png`});await style.evaluate(el=>el.parentNode?.removeChild(el));
 }
});

test("actual game keeps estate supply storage and resources aligned without changing state",async({page})=>{
 let game=setup();
 for(const tile of faces.filter(t=>["castle","mine","ship","bank","crane","geese","monastery-14","monastery-27","monastery-28"].includes(t.id))){const {id:ignored,...face}=tile;void ignored;game=placed(game,0,face);}
 for(const tile of faces.slice(0,3)){const {id:ignored,...face}=tile;void ignored;game=stash(game,face).g;}
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · shared asset standard"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>localStorage.setItem('burgundy-expanded:local-v1',value),saved);await page.goto('/');
 const board=page.getByRole('group',{name:'규칙A 영지',exact:true});await expect(board.locator('[data-tile-frame="common"]')).toHaveCount(5);await expect(board.locator('image[data-approved-monastery]')).toHaveCount(3);await expect(board.locator('image[data-approved-building]')).toHaveCount(2);
 await expect(page.locator('.direct-toolbar img[data-resource-icon]')).toHaveCount(2);
 // Outer button clipping must not shave off the new shared hex corners.
 for(const tile of await page.locator('.estate-keyspaces [data-tile-art]').all()){
  const result=await tile.evaluate(el=>{const tile=el.getBoundingClientRect(),button=el.closest('button')!,b=button.getBoundingClientRect();return {clip:getComputedStyle(button).clipPath,inside:tile.left>=b.left-.01&&tile.right<=b.right+.01&&tile.top>=b.top-.01&&tile.bottom<=b.bottom+.01};});expect(result).toEqual({clip:'none',inside:true});
 }
 await page.locator('.common-board-svg').screenshot({path:'.local-data/tile-standard/game-common-after.png'});
 await page.locator('.estate-keyspaces').first().screenshot({path:'.local-data/tile-standard/game-storage-after.png'});
 let zoom=100;for(const target of [100,160,200]){while(zoom<target){await page.getByRole('button',{name:'규칙A 영지 확대',exact:true}).click();zoom+=10;}await board.screenshot({path:`.local-data/tile-standard/game-estate-after-${target}.png`});}
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game)).toEqual(game);
});
