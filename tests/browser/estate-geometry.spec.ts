import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstateTile, EstateGrid } from "../../src/app/estate-tile";
import { estatePoints } from "../../src/app/estate-geometry";
import { test,expect,type Page } from "@playwright/test";
import { setup,placed } from "../fixtures/shields";
import { serializeSavedGame } from "../../src/game/save";
import type { Tile } from "../../src/game/types";

async function load(page:Page){
 let game=setup();
 for(const face of [{type:"castle"},{type:"mine"},{type:"ship"},{type:"building",building:"market"},{type:"building",building:"crane"},{type:"livestock",species:"cattle",count:3},{type:"livestock",species:"geese",count:2},{type:"monastery",number:27},{type:"monastery",number:28}])game=placed(game,0,{...face,back:"black"} as Omit<Tile,"id">);
 const player=game.players[0],ship=player.duchy.cells.find(c=>c.tileId&&game.tiles[c.tileId].type==="ship")!,neighbor=player.duchy.cells.find(c=>!c.tileId&&c.terrain==="ship"&&Math.max(Math.abs(c.coord.q-ship.coord.q),Math.abs(c.coord.r-ship.coord.r),Math.abs(c.coord.q+c.coord.r-ship.coord.q-ship.coord.r))===1)!;expect(neighbor).toBeTruthy();game=placed(game,0,{type:"ship",back:"black"},neighbor.id);
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · estate geometry"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);await page.goto("/");await expect(page.getByRole("group",{name:"규칙A 영지",exact:true})).toBeVisible();return game;
}
test("estate zoom preserves board cells and saved game while recording layout",async({page},info)=>{
 const game=await load(page),board=page.getByRole("group",{name:"규칙A 영지",exact:true});let zoom=100;
 for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await expect(board.locator(".hex-cell")).toHaveCount(37);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
  if(process.env.ESTATE_CAPTURE_PREFIX==="before"?((info.project.name==="mobile-375"||info.project.name==="desktop-1280")&&target===160):(info.project.name==="desktop-1280"||info.project.name==="mobile-375"||(info.project.name==="mobile-390"&&target===160)))await board.screenshot({path:`.local-data/qa/estate-${process.env.ESTATE_CAPTURE_PREFIX??"after"}-${info.project.name}-${target}.png`});
 }
 const panel=board.locator("xpath=ancestor::section[1]"),viewport=board.locator("..");await expect(panel.getByRole("button",{name:"영지 드래그 이동",exact:true})).toHaveCount(0);await viewport.scrollIntoViewIfNeeded();
 if(await viewport.evaluate(el=>el.scrollWidth>el.clientWidth)){await viewport.evaluate(el=>{el.scrollLeft=0;});const b=(await viewport.boundingBox())!,size=page.viewportSize()!,x=Math.min(b.x+b.width-30,size.width-30),y=(Math.max(130,b.y)+Math.min(b.y+b.height,size.height-80))/2;await page.mouse.move(x,y);await page.keyboard.down("Alt");await page.mouse.down();await page.mouse.move(x-90,y,{steps:6});await page.mouse.up();await page.keyboard.up("Alt");expect(await viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);}
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
});

test("adjacent estate cells share two exact corners and every tile shares the cell clip at all zooms",async({page})=>{
 await load(page);const board=page.getByRole("group",{name:"규칙A 영지",exact:true});let zoom=100;
 for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}
  await board.locator("..").scrollIntoViewIfNeeded();
  const geometry=await board.evaluate(root=>{const cells=[...root.querySelectorAll<SVGGElement>("[data-estate-cell]")].map(cell=>{const polygon=cell.querySelector<SVGPolygonElement>(":scope > polygon")!,points=[...polygon.points].map(p=>[p.x,p.y]),q=Number(cell.dataset.q),r=Number(cell.dataset.r);return {id:cell.dataset.estateCell,q,r,points,center:[310+48*Math.sqrt(3)*(q+r/2),282+72*r]};});let pairs=0;const failures:string[]=[];const key=(p:number[])=>p.map(n=>n.toFixed(5)).join(",");
   for(let i=0;i<cells.length;i++){const a=cells[i];for(const p of a.points)if(Math.abs(Math.hypot(p[0]-a.center[0],p[1]-a.center[1])-48)>.0001)failures.push("radius");for(let j=i+1;j<cells.length;j++){const b=cells[j],dq=a.q-b.q,dr=a.r-b.r;if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==1)continue;pairs++;if(a.points.filter(p=>b.points.some(k=>key(k)===key(p))).length!==2)failures.push("edge");}}
   const path=root.querySelector("[data-estate-grid]")!.getAttribute("d")!;const tiles=[...root.querySelectorAll<SVGGElement>("[data-estate-tile]")];for(const tile of tiles){const cell=tile.closest("[data-estate-cell]")!,outer=cell.querySelector("polygon")!.getAttribute("points"),clip=tile.querySelector("clipPath polygon")!.getAttribute("points");if(outer!==clip)failures.push("clip");const svg=tile.querySelector<SVGSVGElement>("svg[data-tile-art]")!,b=cell.querySelector<SVGPolygonElement>("polygon")!.getBBox();if(Math.abs(svg.width.baseVal.value-b.width)>.0001||Math.abs(svg.height.baseVal.value-b.height)>.0001||Math.abs(svg.x.baseVal.value-b.x)>.0001||Math.abs(svg.y.baseVal.value-b.y)>.0001)failures.push("viewport size");if(tile.querySelectorAll('[data-tile-frame="common"]').length>1)failures.push("duplicate frame");}
   let checked=0;const rect=root.parentElement!.getBoundingClientRect(),matrix=(root as SVGSVGElement).getScreenCTM()!;for(const c of cells){const p=new DOMPoint(c.center[0],c.center[1]).matrixTransform(matrix);if(p.x<=Math.max(0,rect.left)||p.x>=Math.min(innerWidth,rect.right)||p.y<=Math.max(0,rect.top)||p.y>=Math.min(innerHeight,rect.bottom))continue;const hit=document.elementFromPoint(p.x,p.y);if(hit?.closest(".direct-toolbar,.board-touch-tools,.topbar"))continue;checked++;if(hit?.closest<SVGGElement>("[data-estate-cell]")?.dataset.estateCell!==c.id)failures.push("hit target");}
   return {cells:cells.length,pairs,edges:(path.match(/M/g)||[]).length,failures,tiles:tiles.length,checked};});
  expect(geometry).toMatchObject({cells:37,pairs:90,failures:[],tiles:11});expect(geometry.checked).toBeGreaterThan(0);
 }
 const ids=await page.locator("clipPath[id^=estate-clip]").evaluateAll(els=>els.map(e=>e.id));expect(new Set(ids).size).toBe(ids.length);
});


test("isolated artwork stays inside the common inner hex without clipping central pixels",async({page})=>{
 await load(page);
 const assets=await page.evaluate(async()=>{
  const results:{size:number[];outside:number;holes:number;alpha:number[]}[]=[];
  for(const name of ["castle","mine","ship","monastery-27","monastery-28"]){
   const image=new Image();image.src=`/tiles/illustrations/${name}.png`;await image.decode();
   const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;const context=canvas.getContext("2d")!;context.drawImage(image,0,0);const rgba=context.getImageData(0,0,1024,1024).data;
   let outside=0,holes=0;const alpha=[];
   for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const dx=Math.abs(x+.5-512),dy=Math.abs(y+.5-512),a=rgba[(y*1024+x)*4+3];if((dx>Math.sqrt(3)*256*(1-2*2.2/100)||dy+dx/Math.sqrt(3)>512*(1-2*2.2/100))&&a)outside++;if(dx<Math.sqrt(3)*256-3&&dy+dx/Math.sqrt(3)<509&&a<255)holes++;alpha.push(a);}
   results.push({size:[image.naturalWidth,image.naturalHeight],outside,holes,alpha});
  }
  return {sizes:results.map(r=>r.size),outside:results.map(r=>r.outside),holes:results.map(r=>r.holes),same:results.every(r=>r.alpha.every((a,i)=>a===results[0].alpha[i]))};
 });
 expect(assets.sizes).toEqual(Array(5).fill([1024,1024]));expect(assets.outside).toEqual([0,0,0,0,0]);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
 const images=board.locator('image[data-estate-image="illustration"]');expect(await images.count()).toBeGreaterThanOrEqual(4);
 const specs=await images.evaluateAll(els=>els.map(el=>["x","y","width","height","preserveAspectRatio"].map(a=>el.getAttribute(a)).join("|")));expect(new Set(specs).size).toBe(1);
});


test("all final framed tile pairs share edges and retain rims at PC zooms",async({page})=>{
 const cells=(["castle","mine","ship"] as const).flatMap((type,row)=>[0,1].map(column=>({id:`${type}-${column}`,coord:{q:column-row,r:2*row},tile:{id:`pair-${type}-${column}`,type,back:"matching-color"} as Tile})));
 const markup=renderToStaticMarkup(createElement("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"260 220 190 410",width:380,height:820,"data-pair-board":"true"},...cells.map(cell=>createElement("g",{key:cell.id,"data-estate-cell":cell.id},createElement("polygon",{points:estatePoints(cell.coord),fill:"#eee9db"}),createElement(EstateTile,{tile:cell.tile,coord:cell.coord}))),createElement(EstateGrid,{cells,framed:cells.map(c=>c.id)})));
 await page.goto("/");await page.setContent(`<html><body style="margin:0;background:#f5f0d2"><div>TEST FIXTURE · shared game EstateTile renderer</div>${markup}</body></html>`);
 await page.locator('image[data-estate-image="illustration"]').evaluateAll(async els=>{await Promise.all(els.map(async el=>{const probe=new Image();probe.src=el.getAttribute("href")!;await probe.decode();}));});
 const board=page.locator("[data-pair-board]");
 for(const zoom of [100,160,200]){await board.evaluate((el,z)=>{el.setAttribute("width",String(190*z/100));el.setAttribute("height",String(410*z/100));},zoom);await board.screenshot({path:`.local-data/qa/final-tiles-pairs-${zoom}.png`});expect(await board.locator('[data-estate-tile]').count()).toBe(6);}
});
