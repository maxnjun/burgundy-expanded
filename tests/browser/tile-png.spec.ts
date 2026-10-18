import { test, expect } from "@playwright/test";
import { setup, placed, stash } from "../fixtures/shields";
import { validateCoreState } from "../../src/game/core/state";
import { serializeSavedGame } from "../../src/game/save";
import type { Tile } from "../../src/game/types";

test("four PNG illustrations share intact hex frames across supply storage estate and zoom",async({page},info)=>{
 await page.clock.install();await page.goto("/");
 const paths=["monastery-27","monastery-28","crane","goose"];
 for(const asset of paths){
  let game=setup();const tile=Object.values(game.tiles).find(t=>asset.startsWith("monastery")?t.type==="monastery"&&t.number===Number(asset.slice(10)):asset==="crane"?t.type==="building"&&t.building==="crane":t.type==="livestock"&&t.species==="geese")!;expect(tile).toBeTruthy();
  const {id:ignored,...face}=tile;void ignored;game=placed(game,0,face);const stored=stash(game,face);game=stored.g;
  const supplyId=`png-fixture:${asset}`;game={...game,tiles:{...game.tiles,[supplyId]:{...tile,id:supplyId,back:"black"} as Tile},market:{...game.market,removedTileIds:[...game.market.removedTileIds,...game.market.blackDepot.slice(0,1).filter((id):id is string=>id!==null)],blackDepot:game.market.blackDepot.map((id,i)=>i===0?supplyId:id)}};
  const valid=validateCoreState(game);expect(valid.valid,valid.valid?"":JSON.stringify(valid.issues)).toBe(true);
  const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · PNG display only"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
  await page.evaluate(value=>localStorage.setItem("burgundy-expanded:local-v1",value),saved);await page.reload();
  const path=`/tiles/${asset}.png`,images=page.locator(`image[data-tile-art-png="${path}"]`);await expect.poll(()=>images.count()).toBeGreaterThanOrEqual(3);await expect(page.locator(`.estate-keyspaces image[data-tile-art-png="${path}"]`)).toHaveCount(1);await expect(page.locator(`.live-estate-svg image[data-tile-art-png="${path}"]`)).toHaveCount(1);expect(await page.locator(`.common-board-svg image[data-tile-art-png="${path}"]`).count()).toBeGreaterThanOrEqual(1);
  const resource=await page.request.get(path);expect(resource.ok()).toBe(true);expect(resource.headers()["content-type"]).toContain("image/png");expect((await resource.body()).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  for(const image of await images.all()){
   await expect(image).toHaveAttribute("preserveAspectRatio","xMidYMid meet");const svg=image.locator("..");await expect(svg.locator("polygon").first()).toHaveAttribute("points","50,3 94,28 94,80 50,106 6,80 6,28");await expect(svg.locator("polygon").first()).toHaveAttribute("stroke","#5d5b36");
   if(asset.startsWith("monastery"))expect(await svg.locator("text").allTextContents()).not.toContain(asset.slice(10));
   if(asset==="goose")await expect(svg.locator("text")).toHaveText("2");
  }
  const board=page.getByRole("group",{name:"규칙A 영지",exact:true}),image=board.locator(`image[data-tile-art-png="${path}"]`);await image.scrollIntoViewIfNeeded();const before=(await image.boundingBox())!;await page.getByRole("button",{name:"규칙A 영지 확대",exact:true}).click();expect((await image.boundingBox())!.width).toBeGreaterThan(before.width);
  const fits=await image.evaluate(el=>{const image=el.getBoundingClientRect(),frame=el.parentElement!.getBoundingClientRect();return image.left>=frame.left&&image.right<=frame.right&&image.top>=frame.top&&image.bottom<=frame.bottom;});expect(fits).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision)).toBe(game.revision);
  if(asset==="monastery-27"&&info.project.name==="mobile-390")await board.screenshot({path:info.outputPath("tile-png-mobile.png")});
 }
});
