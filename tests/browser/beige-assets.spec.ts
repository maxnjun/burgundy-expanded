import {test,expect} from "@playwright/test";
import {resolve} from "node:path";
import {existsSync} from "node:fs";
import assets from "../../public/assets/tiles/beige/final/manifest.json";
import {tileHexPoints,TILE_FRAME_INSET} from "../../src/app/tile-frame";
import {ESTATE_ART_HEIGHT as H} from "../../src/app/estate-geometry";
import {setup,placed,stash} from "../fixtures/shields";
import {serializeSavedGame} from "../../src/game/save";
import {validateCoreState} from "../../src/game/core/state";
import type {BuildingType} from "../../src/game/types";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createHash} from "node:crypto";
import {TileArt} from "../../src/app/tile-art";

const folder="/assets/tiles/beige/final/";
function face(asset:typeof assets.assets[number],id:string,x=0,y=0,width=100){
 const h=H*width/100;
 return renderToStaticMarkup(createElement(TileArt,{tile:{id,type:"building",building:asset.buildingType as BuildingType,back:"matching-color"},x,y,width,height:h}),{identifierPrefix:id});
}
async function decoded(page:import("@playwright/test").Page){
 await page.locator("image,img").evaluateAll(els=>Promise.all(els.map(async el=>{const image=new Image();image.src=el.getAttribute("href")??el.getAttribute("src")!;await image.decode();})));
}

test("approved ten full-face assets preserve shared geometry at 100 160 200 percent",async({page})=>{
 await page.goto("/");
 expect(assets.assets).toHaveLength(10);
 expect(new Set(assets.assets.map(a=>a.buildingType)).size).toBe(10);
 const originals=assets.assets.every(a=>existsSync(resolve(a.source)));
 for(const asset of assets.assets){
  const response=await page.request.get(folder+asset.file);expect(response.ok()).toBe(true);
  const bytes=await response.body();expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.outputSha256);
  if(originals)await page.route(`**/__beige-originals/${asset.file}`,route=>route.fulfill({path:resolve(asset.source),contentType:"image/png"}));
 }
 // Original inputs are local reference material; distributed-asset checks also run in clean clones.
 const comparison=assets.assets.map((a,i)=>`<div style="display:inline-block;width:250px;padding:10px;vertical-align:top"><b>${a.nameKo}</b><div>${originals?"Approved source → registered":"Registered final asset"}</div>${originals?`<img src="/__beige-originals/${a.file}" width="112" height="112">`:""}${face(a,`compare-${i}`,0,0,96)}</div>`).join("");
 await page.setContent(`<body style="margin:12px;background:#efe2c3;color:#4a3420;font:14px sans-serif"><h2>Original artwork / final registration (no redraw)</h2>${comparison}</body>`);
 await decoded(page);await page.screenshot({path:".local-data/beige-live/before-after.png",fullPage:true});
 for(const zoom of [100,160,200]){
  const w=48*Math.sqrt(3)*zoom/100;
  const tiles=assets.assets.map((a,i)=>face(a,`pair-${zoom}-${i}`,i%5*100+(i>=5?50:0),i>=5?H*.75:0)).join("");
  await page.setContent(`<body style="margin:0;background:#efe2c3"><h3>All ten / ${zoom}% estate size</h3><svg data-beige-neighbours viewBox="0 0 550 ${H*1.75}" width="${5.5*w}" height="${H*1.75*w/100}" style="background:#ff00ff">${tiles}</svg></body>`);
  await decoded(page);
  await expect(page.locator('[data-baked-tile-frame="approved-beige"]')).toHaveCount(10);
  await expect(page.locator("[data-tile-frame], [data-rim-band]")).toHaveCount(0);
  for(const svg of await page.locator("[data-tile-art]").all()){
   await expect(svg).toHaveAttribute("viewBox",`0 0 100 ${H}`);
   await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints());
   await expect(svg.locator("image")).toHaveAttribute("preserveAspectRatio","xMidYMid meet");
  }
  const touching=await page.locator("[data-tile-art]").evaluateAll((els,H)=>{const a=new DOMPoint(100,H/2).matrixTransform((els[0] as SVGSVGElement).getScreenCTM()!),b=new DOMPoint(0,H/2).matrixTransform((els[1] as SVGSVGElement).getScreenCTM()!);return Math.hypot(a.x-b.x,a.y-b.y);},H);
  expect(touching).toBeLessThan(.001);
  await page.locator("[data-beige-neighbours]").screenshot({path:`.local-data/beige-live/neighbours-${zoom}.png`});
 }
});

function fixture(batch:typeof assets.assets){
 let game=setup();
 game={...game,config:{...game.config,extensions:[...game.config.extensions,{id:"white-castles",options:{}}]}};
 for(const asset of assets.assets){const tile={type:"building" as const,building:asset.buildingType as BuildingType,back:"matching-color" as const};game=placed(game,0,tile);}
 for(const asset of batch){const stored={type:"building" as const,building:asset.buildingType as BuildingType,back:"matching-color" as const};game=stash(game,stored).g;}
 const ids=batch.map(a=>`beige-supply:${a.id}`);
 game={...game,tiles:{...game.tiles,...Object.fromEntries(batch.map((a,i)=>[ids[i],{id:ids[i],type:"building" as const,building:a.buildingType as BuildingType,back:"black" as const}]))},market:{...game.market,removedTileIds:[...game.market.removedTileIds,...game.market.blackDepot.slice(0,batch.length).filter((id):id is string=>!!id)],blackDepot:game.market.blackDepot.map((id,i)=>ids[i]??id)}};
 const valid=validateCoreState(game);expect(valid.valid,valid.valid?"":JSON.stringify(valid.issues)).toBe(true);
 return game;
}
async function init(page:import("@playwright/test").Page){await page.clock.install();await page.addInitScript(()=>{const s=sessionStorage.getItem("beige-live-fixture");if(s)localStorage.setItem("burgundy-expanded:local-v1",s);});await page.goto("/");}
async function load(page:import("@playwright/test").Page,game:ReturnType<typeof fixture>){
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · approved beige production renderer"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.evaluate(s=>sessionStorage.setItem("beige-live-fixture",s),saved);await page.reload();
 await expect(page.locator(`.estate-keyspaces [data-tile-art="${game.players[0].storage[0]}"]`)).toBeAttached();
}

test("all ten production textures match across supply storage estate and zoom without changing state",async({page})=>{
 await init(page);
 for(let start=0;start<assets.assets.length;start+=3){
 const batch=assets.assets.slice(start,start+3),game=fixture(batch);await load(page,game);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
 await expect(board.locator("[data-estate-tile]")).toHaveCount(11);
 await decoded(page);
 await expect(board.locator("image[data-approved-building]")).toHaveCount(10);
 await expect(board.locator('[data-tile-frame="common"]')).toHaveCount(1);
 for(const asset of batch){
  const selector=`image[data-approved-building="${asset.buildingType}"]`;
  for(const scope of [board,page.locator(".estate-keyspaces").first(),page.locator(".common-board-svg")]){
   const images=scope.locator(selector);expect(await images.count()).toBeGreaterThan(0);
   for(const image of await images.all()){
    await expect(image).toHaveAttribute("href",`${folder}${asset.file}?v=${asset.outputSha256.slice(0,12)}`);
    const svg=image.locator("xpath=ancestor::*[@data-tile-art][1]");await expect(svg.locator("[data-rim-band],[data-tile-backdrop]")).toHaveCount(0);await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints());
   }
  }
 }
 await page.locator(".common-board-svg").screenshot({path:`.local-data/beige-live/game-supply-${start/3+1}.png`});
 await page.locator(".estate-keyspaces").first().screenshot({path:`.local-data/beige-live/game-storage-${start/3+1}.png`});
 if(start===0){let zoom=100;for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await board.screenshot({path:`.local-data/beige-live/game-estate-${target}.png`});}}
 const tile=board.locator("[data-estate-cell]").filter({has:page.locator("image[data-approved-building]")}).first();await tile.scrollIntoViewIfNeeded();
 const hit=await tile.evaluate(el=>{const p=el.querySelector("polygon")!,box=p.getBoundingClientRect(),hits=document.elementsFromPoint(box.x+box.width/2,box.y+box.height/2);return hits.some(h=>h===el||el.contains(h));});expect(hit).toBe(true);
 const stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await stored.click();await expect(stored).toHaveClass(/selected/);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 }
});

test("missing approved textures retain SVG fallback and recover after reload",async({page})=>{
 await page.route("**/assets/tiles/beige/final/*.png*",route=>route.fulfill({status:404,body:"missing approved texture fixture"}));
 await init(page);const game=fixture(assets.assets.slice(0,3));await load(page,game);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
 await expect(board.locator(`svg[data-tile-fallback^="${folder}"]`)).toHaveCount(10);
 await expect(board.locator("image[data-approved-building]")).toHaveCount(0);
 await expect(board.locator('[data-tile-frame="common"]')).toHaveCount(11);
 for(const svg of await board.locator(`svg[data-tile-fallback^="${folder}"]`).all()){
  await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints(TILE_FRAME_INSET));expect(await svg.locator("path").count()).toBeGreaterThan(2);
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 await page.unroute("**/assets/tiles/beige/final/*.png*");await page.reload();await expect(board.locator("image[data-approved-building]")).toHaveCount(10);await expect(board.locator("[data-tile-fallback]")).toHaveCount(0);
});
