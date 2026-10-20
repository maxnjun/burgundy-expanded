import {tileHexPoints,TILE_FRAME_INSET} from "../../src/app/tile-frame";
import { createHash } from "node:crypto";
import finalTiles from "../../public/tiles/illustrations/manifest.json";
import { test, expect, type Locator } from "@playwright/test";
import { setup, placed, stash } from "../fixtures/shields";
import { validateCoreState } from "../../src/game/core/state";
import { serializeSavedGame } from "../../src/game/save";
import type { Tile } from "../../src/game/types";

function frame(image:Locator){return image.locator("xpath=ancestor::*[@data-tile-art][1]");}
async function visibleTile(image:Locator){const cell=image.locator("xpath=ancestor::*[@data-estate-cell][1]");return await cell.count()?cell.locator(":scope > polygon"):frame(image);}
function fixture(asset:string){
  let game=setup();const tile=Object.values(game.tiles).find(t=>asset.startsWith("monastery")?t.type==="monastery"&&t.number===Number(asset.slice(10)):["castle","mine","ship"].includes(asset)?t.type===asset:asset==="crane"?t.type==="building"&&t.building==="crane":t.type==="livestock"&&t.species==="geese")!;expect(tile).toBeTruthy();
  const {id:ignored,...face}=tile;void ignored;game=placed(game,0,face);const stored=stash(game,face);game=stored.g;
  const supplyId=`png-fixture:${asset}`;game={...game,tiles:{...game.tiles,[supplyId]:{...tile,id:supplyId,back:"black"} as Tile},market:{...game.market,removedTileIds:[...game.market.removedTileIds,...game.market.blackDepot.slice(0,1).filter((id):id is string=>id!==null)],blackDepot:game.market.blackDepot.map((id,i)=>i===0?supplyId:id)}};
  const valid=validateCoreState(game);expect(valid.valid,valid.valid?"":JSON.stringify(valid.issues)).toBe(true);
  return game;
}
async function init(page:import("@playwright/test").Page){await page.clock.install();await page.addInitScript(()=>{const saved=sessionStorage.getItem("png-display-fixture");if(saved)localStorage.setItem("burgundy-expanded:local-v1",saved);});await page.goto("/");}
async function load(page:import("@playwright/test").Page,game:ReturnType<typeof setup>){const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · full PNG"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.evaluate(value=>sessionStorage.setItem("png-display-fixture",value),saved);await page.reload();await expect(page.locator(`svg[data-tile-art="${game.players[0].storage[0]}"]`)).toBeAttached();}

test("four PNG illustrations share intact hex frames across supply storage estate and zoom",async({page},info)=>{
 await init(page);
 const paths=["monastery-27","monastery-28","crane","goose"];
 for(const asset of paths){
  const game=fixture(asset);
  const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · PNG display only"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
  await page.evaluate(value=>sessionStorage.setItem("png-display-fixture",value),saved);await page.reload();
  const path=asset==="crane"?"/assets/tiles/beige/final/crane.png":`/tiles/${asset}.png`,images=page.locator(`image[data-tile-art-png="${path}"]`);await expect.poll(()=>images.count()).toBeGreaterThanOrEqual(3);await expect(page.locator(`.estate-keyspaces image[data-tile-art-png="${path}"]`)).toHaveCount(1);await expect(page.locator(`.live-estate-svg image[data-tile-art-png="${path}"]`)).toHaveCount(1);expect(await page.locator(`.common-board-svg image[data-tile-art-png="${path}"]`).count()).toBeGreaterThanOrEqual(1);
  const resource=await page.request.get(path);expect(resource.ok()).toBe(true);expect(resource.headers()["content-type"]).toContain("image/png");expect((await resource.body()).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  for(const image of await images.all()){
   await expect(image).toHaveAttribute("preserveAspectRatio","xMidYMid meet");const svg=frame(image),baked=asset==="crane";await expect(svg.locator('[data-tile-frame="common"]')).toHaveCount(baked?0:1);await expect(svg).toHaveAttribute("viewBox",/^0 0 100 115\.47/);if(baked)await expect(svg.locator('[data-tile-backdrop],[data-rim-band]')).toHaveCount(0);else await expect(svg.locator('[data-tile-backdrop]')).toHaveAttribute("stroke","none");await expect(svg.locator('clipPath polygon')).toHaveAttribute("points",tileHexPoints(baked?0:TILE_FRAME_INSET));if(await svg.getAttribute("data-estate-art"))await expect(svg.locator("..")).toHaveAttribute("clip-path",/^url\(#estate-clip-/);
   if(asset.startsWith("monastery"))expect(await svg.locator("text").allTextContents()).not.toContain(asset.slice(10));
   if(asset==="goose")await expect(svg.locator("text")).toHaveText("2");
  }
  const board=page.getByRole("group",{name:"규칙A 영지",exact:true}),image=board.locator(`image[data-tile-art-png="${path}"]`);const visible=await visibleTile(image);await visible.scrollIntoViewIfNeeded();const before=(await visible.boundingBox())!;await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();expect((await visible.boundingBox())!.width).toBeGreaterThan(before.width);
  const fits=await image.evaluate(el=>{const image=el.getBoundingClientRect(),frame=el.closest("svg[data-tile-art]")!.getBoundingClientRect();return image.left>=frame.left-.1&&image.right<=frame.right+.1&&image.top>=frame.top-.1&&image.bottom<=frame.bottom+.1;});if(!asset.startsWith("monastery"))expect(fits).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision)).toBe(game.revision);
  if(asset==="monastery-27"&&info.project.name==="mobile-390")await board.screenshot({path:info.outputPath("tile-png-mobile.png")});
 }
});

test("castle silver mine and ship use one full PNG frame in supply storage estate and zoom",async({page},info)=>{
 await init(page);
 for(const asset of ["castle","mine","ship"] as const){const game=fixture(asset);await load(page,game);const path=`/tiles/${asset}.png`,images=page.locator(`image[data-tile-art-png="${path}"]`);await expect.poll(()=>images.count()).toBeGreaterThanOrEqual(3);
  for(const image of await images.all()){const href=(await image.getAttribute("href"))!;expect(href).toContain(`?v=${finalTiles.assets[asset].outputSha256.slice(0,12)}`);const served=await page.request.get(href);expect(served.ok()).toBe(true);expect(createHash("sha256").update(await served.body()).digest("hex")).toBe(finalTiles.assets[asset].outputSha256);await expect(image).toHaveAttribute("data-tile-image-mode","full");await expect(image).toHaveAttribute("preserveAspectRatio","xMidYMid meet");await expect(frame(image).locator('[data-tile-frame="svg"]')).toHaveCount(0);await expect(frame(image)).toHaveAttribute("viewBox",/^0 0 100 115\.47/);}
  await expect(page.locator(`.estate-keyspaces image[data-tile-art-png="${path}"]`)).toHaveCount(1);expect(await page.locator(`.common-board-svg image[data-tile-art-png="${path}"]`).count()).toBeGreaterThanOrEqual(1);
  const board=page.getByRole("group",{name:"규칙A 영지",exact:true}),image=board.locator(`image[data-tile-art-png="${path}"]`).last();const visible=await visibleTile(image);await visible.scrollIntoViewIfNeeded();const before=(await visible.boundingBox())!;await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();expect((await visible.boundingBox())!.width).toBeGreaterThan(before.width);
  await expect(frame(image).locator("..")).toHaveAttribute("clip-path",/^url\(#estate-clip-/);await expect(frame(image).locator("[data-isolated-art]")).toHaveAttribute("preserveAspectRatio","xMidYMid meet");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision)).toBe(game.revision);
  if(info.project.name==="mobile-375"&&asset==="mine")await board.screenshot({path:info.outputPath("silver-mine-mobile.png")});
 }
});
test("missing full PNGs restore original SVG artwork and recover after reload",async({page})=>{
 await page.route("**/tiles/**{castle,mine,ship,monastery-27,monastery-28}.png*",route=>route.fulfill({status:404,body:"missing fixture"}));await init(page);
 for(const asset of ["castle","mine","ship","monastery-27","monastery-28"]){const game=fixture(asset);await load(page,game);const path=`/tiles/${asset}.png`,fallback=page.locator(`svg[data-tile-fallback="${path}"]`);await expect.poll(()=>fallback.count()).toBeGreaterThanOrEqual(3);await expect(page.locator(`image[data-tile-art-png="${path}"]`)).toHaveCount(0);
  for(const svg of await fallback.all()){await expect(svg.locator('[data-tile-frame="common"]')).toHaveCount(1);expect(await svg.locator("path").count()).toBeGreaterThan(2);}
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision)).toBe(game.revision);
 }
 await page.unroute("**/tiles/**{castle,mine,ship,monastery-27,monastery-28}.png*");await page.reload();await expect(page.locator('image[data-tile-art-png="/tiles/monastery-28.png"]').first()).toBeAttached();await expect(page.locator('svg[data-tile-fallback="/tiles/ship.png"]')).toHaveCount(0);
});
