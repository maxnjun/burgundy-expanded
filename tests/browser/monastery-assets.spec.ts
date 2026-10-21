import {test,expect,type Page} from "@playwright/test";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import assets from "../../public/assets/tiles/monastery/final/manifest.json";
import {TileArt} from "../../src/app/tile-art";
import {tileHexPoints,TILE_FRAME_INSET} from "../../src/app/tile-frame";
import {ESTATE_ART_HEIGHT as H} from "../../src/app/estate-geometry";
import {setup,placed,stash} from "../fixtures/shields";
import {serializeSavedGame} from "../../src/game/save";
import {validateCoreState} from "../../src/game/core/state";
import type {Tile,MonasteryNumber} from "../../src/game/types";

const folder="/assets/tiles/monastery/final/",out=".local-data/monastery-import";
const face=(number:number)=>({type:"monastery" as const,number:number as MonasteryNumber,back:"matching-color" as const});
async function decoded(page:Page){
 await page.locator("image,img").evaluateAll(els=>Promise.all(els.map(async el=>{const image=new Image();image.src=el.getAttribute("href")??el.getAttribute("src")!;await image.decode();})));
}

test("all 29 approved faces load by number with one baked border and shared hex at every PC zoom",async({page})=>{
 expect(assets.assets.map(a=>a.number)).toEqual(Array.from({length:29},(_,i)=>i+1));
 expect(new Set(assets.assets.map(a=>a.file)).size).toBe(29);
 await page.goto("/monastery-gallery");await decoded(page);
 await expect(page.locator('[data-baked-tile-frame="approved-monastery"]')).toHaveCount(58);
 await expect(page.locator("[data-tile-frame],[data-rim-band],[data-resource-effect]")).toHaveCount(0);
 // Number/effect/black-back artwork is already in the PNG; no second SVG drawing.
 await expect(page.locator("[data-tile-art] text,[data-tile-art] path")).toHaveCount(0);
 for(const asset of assets.assets){
  const response=await page.request.get(folder+asset.file);expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(asset.outputSha256);
  for(const svg of await page.locator(`[data-tile-art]`).filter({has:page.locator(`image[data-approved-monastery="${asset.number}"]`)}).all()){
   await expect(svg).toHaveAttribute("viewBox",`0 0 100 ${H}`);
   await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints());
   await expect(svg.locator("image")).toHaveAttribute("href",`${folder}${asset.file}?v=${asset.outputSha256.slice(0,12)}`);
   await expect(svg.locator("image")).toHaveAttribute("preserveAspectRatio","xMidYMid meet");
  }
 }
 await page.screenshot({path:`${out}/gallery.png`,fullPage:true});
 // Compare the approved originals without publishing a duplicate source tree.
 for(const a of assets.assets)await page.route(`**/__monastery-source/${a.number}.png`,route=>route.fulfill({path:resolve(a.source),contentType:"image/png"}));
 await page.setContent(`<body style="background:#efe2c3;font:16px sans-serif"><h2>Approved ZIP → registered game face</h2>${assets.assets.map(a=>`<div style="display:inline-block;width:290px;margin:8px"><b>${a.number}</b><br><img src="/__monastery-source/${a.number}.png" width="140"><img src="${folder}${a.file}" width="140"></div>`).join("")}</body>`);
 await decoded(page);await page.screenshot({path:`${out}/before-after.png`,fullPage:true});
 for(const zoom of [100,160,200]){
  const w=48*Math.sqrt(3)*zoom/100;
  const tiles=assets.assets.map((a,i)=>renderToStaticMarkup(createElement(TileArt,{tile:{...face(a.number),id:`adjacent-${a.number}`},x:i%6*100+(Math.floor(i/6)%2?50:0),y:Math.floor(i/6)*H*.75,width:100,height:H}),{identifierPrefix:`m${a.number}`})).join("");
  await page.setContent(`<body style="margin:0;background:#efe2c3"><h3>29 faces · ${zoom}%</h3><svg data-neighbours viewBox="0 0 650 ${H*4}" width="${w*6.5}" height="${H*4*w/100}" style="background:#ff00ff">${tiles}</svg></body>`);
  await decoded(page);await expect(page.locator('[data-baked-tile-frame="approved-monastery"]')).toHaveCount(29);
  const distance=await page.locator("[data-tile-art]").evaluateAll((els,H)=>{
   const a=new DOMPoint(100,H/2).matrixTransform((els[0] as SVGSVGElement).getScreenCTM()!),b=new DOMPoint(0,H/2).matrixTransform((els[1] as SVGSVGElement).getScreenCTM()!);
   const c=new DOMPoint(100,H*.75).matrixTransform((els[0] as SVGSVGElement).getScreenCTM()!),d=new DOMPoint(50,0).matrixTransform((els[6] as SVGSVGElement).getScreenCTM()!);
   return [Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(c.x-d.x,c.y-d.y)];
  },H);
  expect(Math.max(...distance)).toBeLessThan(.001);
  await page.locator("[data-neighbours]").screenshot({path:`${out}/neighbours-${zoom}.png`});
 }
});

function fixture(batch:typeof assets.assets){
 let game=setup(4);
 game={...game,config:{...game.config,extensions:[...game.config.extensions,{id:"white-castles",options:{}}]}};
 for(const a of batch){game=placed(game,0,face(a.number));game=stash(game,face(a.number)).g;}
 const black=batch.map(a=>`monastery-black:${a.number}`),numbered=batch.map(a=>`monastery-numbered:${a.number}`);
 const slots=game.market.numberedDepots.flatMap(d=>d.slots.filter(s=>s.requiredType==="monastery")).slice(0,batch.length);
 expect(slots).toHaveLength(batch.length);
 game={...game,tiles:{...game.tiles,...Object.fromEntries(batch.flatMap((a,i)=>[[black[i],{...face(a.number),id:black[i],back:"black"}],[numbered[i],{...face(a.number),id:numbered[i]}]])) as Record<string,Tile>},market:{...game.market,
  removedTileIds:[...game.market.removedTileIds,...game.market.blackDepot.slice(0,batch.length).filter((id):id is string=>!!id),...slots.flatMap(s=>s.tileId?[s.tileId]:[])],
  blackDepot:game.market.blackDepot.map((id,i)=>black[i]??id),numberedDepots:game.market.numberedDepots.map(d=>({...d,slots:d.slots.map(s=>{const i=slots.findIndex(x=>x.id===s.id);return i>=0?{...s,tileId:numbered[i]}:s;})}))}};
 const result=validateCoreState(game);expect(result.valid,result.valid?"":JSON.stringify(result.issues)).toBe(true);
 return game;
}
async function init(page:Page){await page.clock.install();await page.addInitScript(()=>{const s=sessionStorage.getItem("monastery-fixture");if(s)localStorage.setItem("burgundy-expanded:local-v1",s);});await page.goto("/");}
async function load(page:Page,game:ReturnType<typeof setup>){
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · monastery approved artwork"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.evaluate(s=>sessionStorage.setItem("monastery-fixture",s),saved);await page.reload();
 await expect(page.locator(`.estate-keyspaces [data-tile-art="${game.players[0].storage[0]}"]`)).toBeAttached();
}

test("all 29 faces match in numbered black supply storage estate and placement preview without state changes",async({page})=>{
 await init(page);
 for(let start=0;start<29;start+=3){
  const batch=assets.assets.slice(start,start+3),game=fixture(batch);await load(page,game);await decoded(page);
  const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
  for(const a of batch){
   const supplyCount=[...game.market.blackDepot,...game.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId))].filter(id=>{const tile=id?game.tiles[id]:null;return tile?.type==="monastery"&&tile.number===a.number;}).length;
   for(const [scope,count] of [[board,1],[page.locator(".estate-keyspaces").first(),1],[page.locator(".common-board-svg"),supplyCount]] as const){
    const images=scope.locator(`image[data-approved-monastery="${a.number}"]`);
    await expect(images).toHaveCount(count);
    for(const image of await images.all()){
     await expect(image).toHaveAttribute("href",`${folder}${a.file}?v=${a.outputSha256.slice(0,12)}`);
     const tile=image.locator("xpath=ancestor::*[@data-tile-art][1]");await expect(tile.locator("[data-rim-band],[data-tile-backdrop],text,path")).toHaveCount(0);
    }
   }
   await expect(page.locator(`[data-tile-art="monastery-black:${a.number}"] image`)).toHaveAttribute("data-approved-monastery",String(a.number));
   await expect(page.locator(`[data-tile-art="monastery-numbered:${a.number}"] image`)).toHaveAttribute("data-approved-monastery",String(a.number));
  }
  await page.locator(".common-board-svg").screenshot({path:`${out}/game-supply-${start/3+1}.png`});
  await page.locator(".estate-keyspaces").first().screenshot({path:`${out}/game-storage-${start/3+1}.png`});
  await board.screenshot({path:`${out}/game-estate-batch-${start/3+1}.png`});
  if(start===12){let zoom=100;for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await board.screenshot({path:`${out}/game-estate-${target}.png`});}}
  const stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await stored.click();await expect(stored).toHaveClass(/selected/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 }
});

test("missing monastery images restore readable numbered SVG fallback and recover after reload",async({page})=>{
 await page.route("**/assets/tiles/monastery/final/*.png*",route=>route.fulfill({status:404,body:"missing approved image fixture"}));
 await init(page);const game=fixture(assets.assets.filter(a=>[1,14,29].includes(a.number)));await load(page,game);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
 await expect(board.locator(`[data-tile-fallback^="${folder}"]`)).toHaveCount(3);
 await expect(board.locator("image[data-approved-monastery]")).toHaveCount(0);
 for(const a of [1,14,29]){
  const svg=board.locator(`[data-tile-fallback="${folder}monastery-${String(a).padStart(2,"0")}.png"]`);
  await expect(svg.locator('[data-tile-frame="common"]')).toHaveCount(1);
  await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints(TILE_FRAME_INSET));
  expect(await svg.locator("text").allTextContents()).toContain(String(a));
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 await page.unroute("**/assets/tiles/monastery/final/*.png*");await page.reload();await decoded(page);
 await expect(board.locator("image[data-approved-monastery]")).toHaveCount(3);await expect(board.locator("[data-tile-fallback]")).toHaveCount(0);
});
