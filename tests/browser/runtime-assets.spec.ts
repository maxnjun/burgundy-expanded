import {expect,test,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import sharp from "sharp";
import assets from "../../src/app/runtime-assets.generated.json";
import {assetUrl} from "../../src/app/runtime-assets";
import {serializeSavedGame} from "../../src/game/save";
import {customGame,customMount} from "../fixtures/custom-rules";

const pixels=(png:Buffer)=>sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const sources=Object.fromEntries(Object.entries(assets).filter(([source])=>source.endsWith(".png")).map(([source,url])=>[url,source]));

async function captureGame(page:Page){
 await page.evaluate(async()=>{
  const urls=[...new Set([...document.querySelectorAll("image[href], img[src]")]
   .map(element=>element.getAttribute("href")??element.getAttribute("src")!))];
  await Promise.all(urls.map(async source=>{const image=new Image();image.src=source;await image.decode();}));
  await document.fonts.ready;
 });
 const common=await page.locator(".common-board-svg").screenshot({animations:"disabled"});
 const estate=await page.getByRole("group",{name:"왕실A 영지",exact:true}).screenshot({animations:"disabled"});
 const vineyard=await page.locator(".vineyard-personal").first().screenshot({animations:"disabled"});
 return [common,estate,vineyard];
}

test("lossless URLs have immutable headers and preserve source pixels and game appearance",async({context,page},info)=>{
 const versioned=assetUrl("/shields/shield-21.png");
 expect(versioned).toMatch(/^\/_art\/[a-f0-9]{64}\.webp$/);
 const response=await page.request.get(versioned);
 expect(response.ok()).toBe(true);
 expect(response.headers()["content-type"]).toBe("image/webp");
 expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
 const [a,b]=await Promise.all([pixels(await response.body()),pixels(await readFile("public/shields/shield-21.png"))]);
 expect([a.info.width,a.info.height,a.info.channels]).toEqual([b.info.width,b.info.height,b.info.channels]);
 expect(a.data.equals(b.data)).toBe(true);
 const game=customMount(customMount(customGame(4,true,true,true),19),21);
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],
  view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await context.addInitScript(save=>{
  localStorage.setItem("burgundy-expanded:local-v1",save);
  localStorage.setItem("burgundy-expanded:pinned-guidance-v1","off");
 },saved);
 await page.goto("/");
 await expect(page.locator(".vineyard-personal")).toHaveCount(4);
 const optimized=await captureGame(page);
 await page.evaluate(mapping=>{
  for(const image of document.querySelectorAll("image[href^='/_art/'],img[src^='/_art/']")){
   const attribute=image.tagName.toLowerCase()==="image"?"href":"src";
   const original=mapping[image.getAttribute(attribute)!];
   if(original)image.setAttribute(attribute,original);
  }
 },sources);
 const originals=await captureGame(page);
 for(let i=0;i<optimized.length;i++){
  await info.attach(`original-${i}.png`,{body:originals[i],contentType:"image/png"});
  await info.attach(`optimized-${i}.png`,{body:optimized[i],contentType:"image/png"});
  const [a,b]=await Promise.all([pixels(optimized[i]),pixels(originals[i])]);
  expect([a.info.width,a.info.height]).toEqual([b.info.width,b.info.height]);
  let max=0,above2=0;
  for(let p=0;p<a.data.length;p+=4){
   const difference=Math.max(...[0,1,2,3].map(c=>Math.abs(a.data[p+c]-b.data[p+c])));
   max=Math.max(max,difference);
   above2+=Number(difference>2);
  }
  // Chromium's premultiplied SVG resampling can round by a few levels when the image decoder changes.
  expect(max,`largest channel difference in render ${i}`).toBeLessThanOrEqual(8);
  expect(above2/(a.info.width*a.info.height),`fraction of pixels differing by more than two levels in render ${i}`).toBeLessThan(.001);
 }
});
