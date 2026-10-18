import { test,expect,type Page } from "@playwright/test";
import { setup,placed } from "../fixtures/shields";
import { serializeSavedGame } from "../../src/game/save";
import type { Tile } from "../../src/game/types";

async function load(page:Page){
 let game=setup();
 for(const face of [{type:"castle"},{type:"mine"},{type:"ship"},{type:"building",building:"market"},{type:"building",building:"crane"},{type:"livestock",species:"cattle",count:3},{type:"livestock",species:"geese",count:2},{type:"monastery",number:27},{type:"monastery",number:28}])game=placed(game,0,{...face,back:"black"} as Omit<Tile,"id">);
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · estate geometry"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);await page.goto("/");await expect(page.getByRole("group",{name:"규칙A 영지",exact:true})).toBeVisible();return game;
}
test("estate zoom preserves board cells and saved game while recording layout",async({page},info)=>{
 const game=await load(page),board=page.getByRole("group",{name:"규칙A 영지",exact:true});let zoom=100;
 for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await expect(board.locator(".hex-cell")).toHaveCount(37);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
  if(process.env.ESTATE_CAPTURE_PREFIX==="before"?((info.project.name==="mobile-375"||info.project.name==="desktop-1280")&&target===160):(info.project.name==="mobile-375"||((info.project.name==="mobile-390"||info.project.name==="desktop-1280")&&target===160)))await board.screenshot({path:`.local-data/qa/estate-${process.env.ESTATE_CAPTURE_PREFIX??"after"}-${info.project.name}-${target}.png`});
 }
 const panel=board.locator("xpath=ancestor::section[1]"),viewport=board.locator("..");await panel.getByRole("button",{name:"영지 드래그 이동",exact:true}).click();await viewport.scrollIntoViewIfNeeded();
 if(await viewport.evaluate(el=>el.scrollWidth>el.clientWidth)){await viewport.evaluate(el=>{el.scrollLeft=0;});const b=(await viewport.boundingBox())!,size=page.viewportSize()!,x=Math.min(b.x+b.width-30,size.width-30),y=(Math.max(130,b.y)+Math.min(b.y+b.height,size.height-80))/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-90,y,{steps:6});await page.mouse.up();expect(await viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);}
 await panel.getByRole("button",{name:"영지 드래그 이동",exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
});

test("adjacent estate cells share two exact corners and every tile shares the cell clip at all zooms",async({page})=>{
 await load(page);const board=page.getByRole("group",{name:"규칙A 영지",exact:true});let zoom=100;
 for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}
  await board.locator("..").scrollIntoViewIfNeeded();
  const geometry=await board.evaluate(root=>{const cells=[...root.querySelectorAll<SVGGElement>("[data-estate-cell]")].map(cell=>{const polygon=cell.querySelector<SVGPolygonElement>(":scope > polygon")!,points=[...polygon.points].map(p=>[p.x,p.y]),q=Number(cell.dataset.q),r=Number(cell.dataset.r);return {id:cell.dataset.estateCell,q,r,points,center:[310+48*Math.sqrt(3)*(q+r/2),282+72*r]};});let pairs=0;const failures:string[]=[];const key=(p:number[])=>p.map(n=>n.toFixed(5)).join(",");
   for(let i=0;i<cells.length;i++){const a=cells[i];for(const p of a.points)if(Math.abs(Math.hypot(p[0]-a.center[0],p[1]-a.center[1])-48)>.0001)failures.push("radius");for(let j=i+1;j<cells.length;j++){const b=cells[j],dq=a.q-b.q,dr=a.r-b.r;if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==1)continue;pairs++;if(a.points.filter(p=>b.points.some(k=>key(k)===key(p))).length!==2)failures.push("edge");}}
   const path=root.querySelector("[data-estate-grid]")!.getAttribute("d")!;const tiles=[...root.querySelectorAll<SVGGElement>("[data-estate-tile]")];for(const tile of tiles){const cell=tile.closest("[data-estate-cell]")!,outer=cell.querySelector("polygon")!.getAttribute("points"),clip=tile.querySelector("clipPath polygon")!.getAttribute("points");if(outer!==clip)failures.push("clip");const svg=tile.querySelector<SVGSVGElement>("svg[data-tile-art]")!,b=cell.querySelector<SVGPolygonElement>("polygon")!.getBBox();if(Math.abs(svg.width.baseVal.value-b.width)>.0001||Math.abs(svg.height.baseVal.value-b.height)>.0001||Math.abs(svg.x.baseVal.value-b.x)>.0001||Math.abs(svg.y.baseVal.value-b.y)>.0001)failures.push("viewport size");if(tile.querySelector("[data-tile-frame]"))failures.push("nested frame");}
   let checked=0;const rect=root.parentElement!.getBoundingClientRect(),matrix=(root as SVGSVGElement).getScreenCTM()!;for(const c of cells){const p=new DOMPoint(c.center[0],c.center[1]).matrixTransform(matrix);if(p.x<=Math.max(0,rect.left)||p.x>=Math.min(innerWidth,rect.right)||p.y<=Math.max(0,rect.top)||p.y>=Math.min(innerHeight,rect.bottom))continue;const hit=document.elementFromPoint(p.x,p.y);if(hit?.closest(".direct-toolbar,.board-touch-tools,.topbar"))continue;checked++;if(hit?.closest<SVGGElement>("[data-estate-cell]")?.dataset.estateCell!==c.id)failures.push("hit target");}
   return {cells:cells.length,pairs,edges:(path.match(/M/g)||[]).length,failures,tiles:tiles.length,checked};});
  expect(geometry).toMatchObject({cells:37,pairs:90,edges:132,failures:[],tiles:10});expect(geometry.checked).toBeGreaterThan(0);
 }
 const ids=await page.locator("clipPath[id^=estate-clip]").evaluateAll(els=>els.map(e=>e.id));expect(new Set(ids).size).toBe(ids.length);
});
