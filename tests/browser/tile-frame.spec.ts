import { test,expect } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TileArt } from "../../src/app/tile-art";
import { EstateTile,EstateGrid } from "../../src/app/estate-tile";
import { estatePoints } from "../../src/app/estate-geometry";
import type { Tile } from "../../src/game/types";
import { setup,placed } from "../fixtures/shields";
import { serializeSavedGame } from "../../src/game/save";

const faces:Tile[]=[{id:"frame-castle",type:"castle",back:"matching-color"},{id:"frame-mine",type:"mine",back:"matching-color"},{id:"frame-ship",type:"ship",back:"matching-color"},{id:"frame-27",type:"monastery",number:27,back:"matching-color"},{id:"frame-28",type:"monastery",number:28,back:"matching-color"}];

test("five artwork frames have equal inward bands and preserve source colours at all PC zooms",async({page})=>{
 const rows=[...faces.slice(0,3).map(t=>[t,t]),faces.slice(3),[faces[0],faces[1],faces[2]],[faces[3],null]];
 const cells=rows.flatMap((tiles,row)=>tiles.map((tile,column)=>({id:`${row}-${column}`,coord:{q:column-row,r:2*row},tile:tile?{...tile,id:`${row}-${column}`} as Tile:null})));
 const markup=renderToStaticMarkup(createElement("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"260 220 290 850",width:290,height:850,"data-frame-pairs":true},...cells.map(cell=>createElement("g",{key:cell.id},createElement("polygon",{points:estatePoints(cell.coord),fill:"#d6bf32",stroke:"none"}),cell.tile?createElement(EstateTile,{tile:cell.tile,coord:cell.coord}):null)),createElement(EstateGrid,{cells,framed:cells.filter(c=>c.tile).map(c=>c.id)})));
 await page.goto("/");await page.setContent(`<body style="margin:0;background:#f5f0d2"><div>TEST FIXTURE · pairs / monastery / mixed / empty</div>${markup}</body>`);
 await page.locator('image[data-isolated-art]').evaluateAll(async els=>{await Promise.all(els.map(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();}));});
 const frames=page.locator('[data-tile-frame="common"]');expect(await frames.count()).toBe(12);
 const bands=await frames.evaluateAll(els=>els.map(el=>[...el.querySelectorAll('path')].map(p=>p.getAttribute('d')).join('|')));expect(new Set(bands).size).toBe(1);
 for(const zoom of [100,160,200]){const board=page.locator('[data-frame-pairs]');await board.evaluate((el,z)=>{el.setAttribute('width',String(290*z/100));el.setAttribute('height',String(850*z/100));},zoom);await board.screenshot({path:`.local-data/qa/uniform-pairs-${zoom}.png`});const maskStyle=await page.addStyleTag({content:'[data-isolated-art]{visibility:hidden!important}[data-tile-backdrop]{fill:white!important}[data-rim-band]{fill:black!important}'});await board.screenshot({path:`.local-data/qa/uniform-rim-mask-${zoom}.png`});await maskStyle.evaluate(el=>el.parentNode?.removeChild(el));}
 const comparison=renderToStaticMarkup(createElement("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 330 760",width:660,height:1520},...faces.flatMap((tile,row)=>{const name=tile.type==='monastery'?`monastery-${tile.number}`:tile.type;return [createElement('image',{key:`before-${row}`,href:`/tiles/${name}.png`,x:0,y:row*150+10,width:140,height:140}),createElement(TileArt,{key:`after-${row}`,tile,x:175,y:row*150+10,width:121.24,height:140})];})));
 await page.setContent(`<body style="margin:0;background:#f5f0d2"><div>Original PNG (left) / extracted artwork + common SVG rim (right)</div>${comparison}</body>`);
 await page.locator('image').evaluateAll(async els=>{await Promise.all(els.map(async el=>{const image=new Image();image.src=el.getAttribute('href')!;await image.decode();}));});await page.locator('svg').first().screenshot({path:'.local-data/qa/uniform-original-vs-svg.png'});
});

test("table CSS does not restore cell strokes and framed edges are absent from the grid",async({page})=>{
 let game=setup();for(const tile of faces){const {id:ignored,...face}=tile;void ignored;game=placed(game,0,face);}
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · uniform rim"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',value);},saved);await page.goto('/');const board=page.getByRole('group',{name:'규칙A 영지',exact:true});await expect(board.locator('[data-tile-frame="common"]')).toHaveCount(6);await page.mouse.move(1250,0);
 const values=await board.evaluate(root=>{const cells=[...root.querySelectorAll('[data-estate-cell]')],strokes=cells.map(c=>getComputedStyle(c.querySelector(':scope > polygon')!).stroke),grid=root.querySelector('[data-estate-grid]')!.getAttribute('d')!,key=(p:number[])=>p.map(n=>n.toFixed(5)).join(',');const edges=[...grid.matchAll(/M([^L]+)L([^M]+)/g)].map(m=>[m[1].split(',').map(Number),m[2].trim().split(',').map(Number)].map(key).sort().join('|'));let duplicates=0;for(const cell of cells.filter(c=>c.querySelector('[data-tile-frame="common"]'))){const points=[...(cell.querySelector(':scope > polygon') as SVGPolygonElement).points].map(p=>[p.x,p.y]);for(let i=0;i<6;i++)if(edges.includes([key(points[i]),key(points[(i+1)%6])].sort().join('|')))duplicates++;}return {strokes,duplicates,gridEdges:edges.length};});expect(new Set(values.strokes)).toEqual(new Set(['none']));expect(values.duplicates).toBe(0);expect(values.gridEdges).toBeGreaterThan(0);
});
