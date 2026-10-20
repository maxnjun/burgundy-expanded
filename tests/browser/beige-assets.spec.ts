import {test,expect} from "@playwright/test";
import {resolve} from "node:path";
import {existsSync} from "node:fs";
import assets from "../../public/assets/tiles/beige/final/manifest.json";
import {tileHexPoints} from "../../src/app/tile-frame";
import {ESTATE_ART_HEIGHT as H} from "../../src/app/estate-geometry";
import {setup,placed,stash} from "../fixtures/shields";
import {serializeSavedGame} from "../../src/game/save";
import {validateCoreState} from "../../src/game/core/state";
import type {BuildingType} from "../../src/game/types";

const folder="/assets/tiles/beige/final/";
function face(asset:typeof assets.assets[number],id:string,x=0,y=0,width=100){
 const h=H*width/100;
 return `<svg data-approved-id="${asset.id}" x="${x}" y="${y}" width="${width}" height="${h}" viewBox="0 0 100 ${H}"><defs><clipPath id="${id}"><polygon points="${tileHexPoints()}"/></clipPath></defs><image href="${folder}${asset.file}?v=${asset.outputSha256.slice(0,12)}" x="${(100-H)/2}" y="0" width="${H}" height="${H}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/></svg>`;
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
  expect((await response.body()).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  if(originals)await page.route(`**/__beige-originals/${asset.file}`,route=>route.fulfill({path:resolve(asset.source),contentType:"image/png"}));
 }
 // Original inputs are local reference material; distributed-asset checks also run in clean clones.
 const comparison=assets.assets.map((a,i)=>`<div style="display:inline-block;width:250px;padding:10px;vertical-align:top"><b>${a.nameKo}</b><div>${originals?"Approved source → registered":"Registered final asset"}</div>${originals?`<img src="/__beige-originals/${a.file}" width="112" height="112">`:""}${face(a,`compare-${i}`,0,0,96)}</div>`).join("");
 await page.setContent(`<body style="margin:12px;background:#efe2c3;color:#4a3420;font:14px sans-serif"><h2>Original artwork / final registration (no redraw)</h2>${comparison}</body>`);
 await decoded(page);await page.screenshot({path:".local-data/beige-import/before-after.png",fullPage:true});
 for(const zoom of [100,160,200]){
  const w=48*Math.sqrt(3)*zoom/100;
  const tiles=assets.assets.map((a,i)=>face(a,`pair-${zoom}-${i}`,i%5*100+(i>=5?50:0),i>=5?H*.75:0)).join("");
  await page.setContent(`<body style="margin:0;background:#efe2c3"><h3>All ten / ${zoom}% estate size</h3><svg data-beige-neighbours viewBox="0 0 550 ${H*1.75}" width="${5.5*w}" height="${H*1.75*w/100}" style="background:#ff00ff">${tiles}</svg></body>`);
  await decoded(page);
  await expect(page.locator("[data-approved-id]")).toHaveCount(10);
  await expect(page.locator("[data-tile-frame], [data-rim-band]")).toHaveCount(0);
  for(const svg of await page.locator("[data-approved-id]").all()){
   await expect(svg).toHaveAttribute("viewBox",`0 0 100 ${H}`);
   await expect(svg.locator("clipPath polygon")).toHaveAttribute("points",tileHexPoints());
   await expect(svg.locator("image")).toHaveAttribute("preserveAspectRatio","xMidYMid meet");
  }
  const touching=await page.locator("[data-approved-id]").evaluateAll((els,H)=>{const a=new DOMPoint(100,H/2).matrixTransform((els[0] as SVGSVGElement).getScreenCTM()!),b=new DOMPoint(0,H/2).matrixTransform((els[1] as SVGSVGElement).getScreenCTM()!);return Math.hypot(a.x-b.x,a.y-b.y);},H);
  expect(touching).toBeLessThan(.001);
  await page.locator("[data-beige-neighbours]").screenshot({path:`.local-data/beige-import/neighbours-${zoom}.png`});
 }
});

test("full-face assets can replace supply storage estate art without changing saved game",async({page})=>{
 let game=setup();
 game={...game,config:{...game.config,extensions:[...game.config.extensions,{id:"white-castles",options:{}}]}};
 for(const asset of assets.assets){const tile={type:"building" as const,building:asset.buildingType as BuildingType,back:"matching-color" as const};game=placed(game,0,tile);}
 const stored={type:"building" as const,building:"bank" as const,back:"matching-color" as const};game=stash(game,stored).g;
 const valid=validateCoreState(game);expect(valid.valid,valid.valid?"":JSON.stringify(valid.issues)).toBe(true);
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · approved beige full-face import preview"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.clock.install();await page.addInitScript(value=>localStorage.setItem("burgundy-expanded:local-v1",value),saved);await page.goto("/");
 await expect(page.locator(`.estate-keyspaces [data-tile-art="${game.players[0].storage[0]}"]`)).toBeAttached();
 const board=page.getByRole("group",{name:"규칙A 영지",exact:true});
 await expect(board.locator("[data-estate-tile]")).toHaveCount(11);
 const paths=Object.fromEntries(Object.values(game.tiles).flatMap(tile=>{const asset=tile.type==="building"?assets.assets.find(a=>a.buildingType===tile.building):null;return asset?[[tile.id,asset]]:[];}));
 // DOM-only import preview: keep production rendering and user saves untouched.
 await page.locator("[data-tile-art]").evaluateAll((els,{paths,H,folder,points})=>{
  for(const [i,el] of els.entries()){
   const asset=paths[el.getAttribute("data-tile-art")!];if(!asset)continue;
   const clip=`beige-preview-${i}`;
   el.innerHTML=`<defs><clipPath id="${clip}"><polygon points="${points}"/></clipPath></defs><image data-approved-preview="${asset.id}" href="${folder}${asset.file}?v=${asset.outputSha256.slice(0,12)}" x="${(100-H)/2}" y="0" width="${H}" height="${H}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clip})"/>`;
  }
 },{paths,H,folder,points:tileHexPoints()});
 await decoded(page);
 await expect(page.locator(".live-estate-svg").first().locator("image[data-approved-preview]")).toHaveCount(10);
 await expect(page.locator(".estate-keyspaces image[data-approved-preview]")).toHaveCount(1);
 expect(await page.locator(".common-board-svg image[data-approved-preview]").count()).toBeGreaterThan(0);
 await page.locator(".common-board-svg").screenshot({path:".local-data/beige-import/game-supply-preview.png"});
 await page.locator(".estate-keyspaces").first().screenshot({path:".local-data/beige-import/game-storage-preview.png"});
 await board.screenshot({path:".local-data/beige-import/game-estate-preview.png"});
 const tile=board.locator("[data-estate-cell]").filter({has:page.locator("image[data-approved-preview]")}).first();
 const hit=await tile.evaluate(el=>{const p=el.querySelector("polygon")!,box=p.getBoundingClientRect(),hits=document.elementsFromPoint(box.x+box.width/2,box.y+box.height/2);return hits.some(h=>h===el||el.contains(h));});expect(hit).toBe(true);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
});
