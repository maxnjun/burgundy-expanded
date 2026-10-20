import {test,expect,type Page} from "@playwright/test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import assets from "../../public/assets/tiles/animals/final/manifest.json";
import {TileArt} from "../../src/app/tile-art";
import {tileHexPoints,TILE_FRAME_INSET} from "../../src/app/tile-frame";
import {ESTATE_ART_HEIGHT as H} from "../../src/app/estate-geometry";
import type {Tile} from "../../src/game/types";
import {LIVESTOCK_NAMES,tileHelp} from "../../src/game/tile-help";
import {setup,placed,stash} from "../fixtures/shields";
import {validateCoreState} from "../../src/game/core/state";
import {serializeSavedGame} from "../../src/game/save";

type Asset=typeof assets.assets[number];
const folder="/assets/tiles/animals/final/";
function animal(a:Asset,id:string):Tile{return {id,type:"livestock",species:a.species,count:a.count,back:a.species==="geese"?"black":"matching-color"} as Tile;}
function face(a:Asset,id:string,x=0,y=0){return renderToStaticMarkup(createElement(TileArt,{tile:animal(a,id),x,y,width:100,height:H}),{identifierPrefix:id});}
async function decoded(page:Page){await page.locator("image,img").evaluateAll(els=>Promise.all(els.map(async el=>{const image=new Image();image.src=el.getAttribute("href")??el.getAttribute("src")!;await image.decode();})));}

test("all thirteen approved animal faces retain one frame and common geometry at three zooms",async({page})=>{
 await page.goto("/");
 expect(assets.assets).toHaveLength(13);expect(new Set(assets.assets.map(a=>`${a.species}-${a.count}`)).size).toBe(13);
 const comparison=[];
 for(const [i,a] of assets.assets.entries()){
  const r=await page.request.get(folder+a.file);expect(r.ok()).toBe(true);expect(createHash("sha256").update(await r.body()).digest("hex")).toBe(a.outputSha256);
  const original=existsSync(resolve(a.source));if(original)await page.route(`**/__animal-originals/${a.file}`,route=>route.fulfill({path:resolve(a.source),contentType:"image/png"}));
  comparison.push(`<div style="display:inline-block;width:280px;padding:8px;vertical-align:top"><b>${a.nameKo} ${a.count}</b><div>${original?`<img src="/__animal-originals/${a.file}" width="130" height="130">`:""}${face(a,`compare-${i}`)}</div></div>`);
 }
 await page.setContent(`<body style="margin:12px;background:#efe2c3;font:14px sans-serif"><h2>Approved original → game TileArt (uniform scaling)</h2>${comparison.join("")}</body>`);
 await decoded(page);await page.screenshot({path:".local-data/animal-live/before-after.png",fullPage:true});
 for(const zoom of [100,160,200]){
  const w=48*Math.sqrt(3)*zoom/100;
  const art=assets.assets.map((a,i)=>face(a,`pair-${zoom}-${i}`,i%5*100+(Math.floor(i/5)%2?50:0),Math.floor(i/5)*H*.75)).join("");
  await page.setContent(`<body style="margin:0;background:#efe2c3"><svg data-animal-gallery viewBox="0 0 550 ${H*2.5}" width="${5.5*w}" height="${H*2.5*w/100}" style="background:#ff00ff">${art}</svg></body>`);await decoded(page);
  await expect(page.locator("[data-tile-art]")).toHaveCount(13);await expect(page.locator('[data-tile-frame="common"]')).toHaveCount(13);
  for(const svg of await page.locator("[data-tile-art]").all()){
   await expect(svg).toHaveAttribute("viewBox",`0 0 100 ${H}`);await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints(TILE_FRAME_INSET));
   await expect(svg.locator("image")).toHaveAttribute("preserveAspectRatio","xMidYMid meet");await expect(svg.locator("[data-rim-band]")).toHaveCount(3);
  }
  const gap=await page.locator("[data-tile-art]").evaluateAll((els,H)=>{const a=new DOMPoint(100,H/2).matrixTransform((els[0] as SVGSVGElement).getScreenCTM()!),b=new DOMPoint(0,H/2).matrixTransform((els[1] as SVGSVGElement).getScreenCTM()!);return Math.hypot(a.x-b.x,a.y-b.y);},H);expect(gap).toBeLessThan(.001);
  await page.locator("[data-animal-gallery]").screenshot({path:`.local-data/animal-live/neighbours-${zoom}.png`});
 }
});

function fixture(batch:Asset[]){
 let game=setup();
 for(const a of batch){const {id:ignored,...tile}=animal(a,a.file);void ignored;game=placed(game,0,tile);game=stash(game,tile).g;}
 const ids=batch.map(a=>`animal-black:${a.file}`),numbered=batch.filter(a=>a.species!=="geese");
 game={...game,tiles:{...game.tiles,...Object.fromEntries(batch.map((a,i)=>[ids[i],{...animal(a,ids[i]),back:"black"}]))},market:{...game.market,removedTileIds:[...game.market.removedTileIds,...game.market.blackDepot.slice(0,batch.length).filter((id):id is string=>!!id)],blackDepot:game.market.blackDepot.map((id,i)=>ids[i]??id)}};
 let index=0;
 const tiles={...game.tiles},removed=[...game.market.removedTileIds];
 const depots=game.market.numberedDepots.map(d=>({...d,slots:d.slots.map(slot=>{
  if(slot.requiredType!=="livestock"||index>=numbered.length)return slot;
  const a=numbered[index++],id=`animal-numbered:${a.file}`;
  if(slot.tileId)removed.push(slot.tileId);
  tiles[id]=animal(a,id);return {...slot,tileId:id};
 })}));
 expect(index).toBe(numbered.length);
 game={...game,tiles,market:{...game.market,removedTileIds:removed,numberedDepots:depots}};
 const valid=validateCoreState(game);expect(valid.valid,valid.valid?"":JSON.stringify(valid.issues)).toBe(true);return game;
}
async function init(page:Page){await page.clock.install();await page.addInitScript(()=>{const saved=sessionStorage.getItem("animal-live-fixture");if(saved)localStorage.setItem("burgundy-expanded:local-v1",saved);});await page.goto("/");}
async function load(page:Page,game:ReturnType<typeof fixture>){const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · approved animals"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.evaluate(s=>sessionStorage.setItem("animal-live-fixture",s),saved);await page.reload();await expect(page.locator(`.estate-keyspaces [data-tile-art="${game.players[0].storage[0]}"]`)).toBeAttached();}

test("all thirteen textures and names match in numbered black storage estate and selection without changing saved rules",async({page})=>{
 await init(page);
 for(let start=0;start<13;start+=2){
  const batch=assets.assets.slice(start,start+2),game=fixture(batch);await load(page,game);await decoded(page);
  const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
  for(const a of batch){
   const selector=`image[data-approved-animal="${a.species}-${a.count}"]`;
   for(const scope of [board,page.locator(".estate-keyspaces").first(),page.locator(".common-board-svg")]){
    const images=scope.locator(selector);expect(await images.count()).toBeGreaterThan(0);
    for(const image of await images.all()){await expect(image).toHaveAttribute("href",`${folder}${a.file}?v=${a.outputSha256.slice(0,12)}`);const svg=image.locator("xpath=ancestor::*[@data-tile-art][1]");await expect(svg.locator('[data-tile-frame="common"]')).toHaveCount(1);await expect(svg.locator("text")).toHaveText(String(a.count));}
   }
   if(a.species!=="geese")await expect(page.locator('.common-board-svg [data-depot] [data-tile-art="animal-numbered:'+a.file+'"]').locator(selector)).toHaveCount(1);
   expect(LIVESTOCK_NAMES[a.species as keyof typeof LIVESTOCK_NAMES]).toBe(a.nameKo);
  }
  await expect(page.locator('.common-board-svg [data-depot] image[data-approved-animal="geese-2"]')).toHaveCount(0);
  await page.locator(".common-board-svg").screenshot({path:`.local-data/animal-live/game-supply-${start/2+1}.png`,style:".direct-toolbar{visibility:hidden!important}"});
  await page.locator(".estate-keyspaces").first().screenshot({path:`.local-data/animal-live/game-storage-${start/2+1}.png`});
  let zoom=100;for(const target of [100,160,200]){while(zoom<target){await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();zoom+=10;}await board.screenshot({path:`.local-data/animal-live/game-estate-${start/2+1}-${target}.png`});}
  const stored=page.locator(".estate-keyspaces").first().getByRole("button").first();await expect(stored).toHaveAccessibleName(new RegExp(`${batch[0].nameKo} ${batch[0].count}마리`));await stored.click();await expect(stored).toHaveClass(/selected/);
  const preview=page.locator('[data-tile-art="'+game.players[0].storage[0]+'"]');expect(await preview.count()).toBeGreaterThan(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 }
 expect(tileHelp(animal(assets.assets[12],"help"))).toContain("하프물범 2마리");
});

test("missing animal PNGs restore SVG without changing state and recover on reload",async({page})=>{
 await page.route("**/assets/tiles/animals/final/*.png*",r=>r.fulfill({status:404,body:"missing fixture"}));await init(page);const game=fixture(assets.assets.slice(0,2));await load(page,game);
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});await expect(board.locator('[data-tile-fallback^="'+folder+'"]')).toHaveCount(2);await expect(board.locator("image[data-approved-animal]")).toHaveCount(0);
 for(const svg of await board.locator('[data-tile-fallback^="'+folder+'"]').all()){await expect(svg.locator('[data-tile-frame="common"]')).toHaveCount(1);expect(await svg.locator("ellipse").count()).toBeGreaterThan(0);}
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 await page.unroute("**/assets/tiles/animals/final/*.png*");await page.reload();await expect(board.locator("image[data-approved-animal]")).toHaveCount(2);await expect(board.locator("[data-tile-fallback]")).toHaveCount(0);
});
