import {mkdirSync} from "node:fs";
import { test, expect } from "@playwright/test";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction } from "../../src/game/core";
import { serializeSavedGame } from "../../src/game/save";
import { shieldLayout } from "../../src/game/shields";
import type { GameState } from "../../src/game/types";

for(const count of [2,3,4])test(`shield groups ${count}p preserve geometry, touch selection and saved empty slots`,async({page},info)=>{
  // TEST FIXTURE dice only: initial physical shields still use the seeded engine setup.
  const initial=createPracticeSession({names:["방패A","방패B","방패C","방패D"].slice(0,count),seed:"shield-browser",boardIds:Array(count).fill("se:base:2"),officialSlots:true,shieldPreview:true});
  const roll=applyCoreAction(initial,{type:"roll-round",playerId:"seat-1"});if(!roll.ok)throw new Error("fixture roll");
  const game:GameState={...roll.value.state,dice:{...roll.value.state.dice,players:{...roll.value.state.dice.players,"seat-1":[{...roll.value.state.dice.players["seat-1"][0],value:1},{...roll.value.state.dice.players["seat-1"][1],value:1}]}}};
  const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · 방패 UI 검증"],view:{zoom:1,focus:false,table:count!==3,boardZooms:{}}});
  await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/");
  await expect(page.locator("[data-shield-slot]").first()).toBeVisible();
  await expect(page.locator("[data-shield-depot]")).toHaveCount(6);
  await expect(page.locator("[data-shield-slot]")).toHaveCount(count===2?6:count===3?9:12);
  const overlapping=()=>page.evaluate(()=>{
    const shields=[...document.querySelectorAll("[data-shield-zone], [data-shield-slot] .shield-outline, [data-shield-slot] .shield-depot-number")].map(el=>el.getBoundingClientRect());
    const elements=[...document.querySelectorAll(".common-board-svg .supply-art-tile, .common-board-svg [data-depot]>rect, .common-board-svg [data-black-depot]>rect, .common-board-svg [data-info-panel], .common-board-svg [data-color-bonuses] rect, .common-board-svg [data-region-score-panel]>rect, .common-board-svg [data-color-bonuses]>text, .common-board-svg [data-region-score-panel]>text")].map(el=>el.getBoundingClientRect());
    return shields.some(s=>elements.some(e=>Math.min(s.right,e.right)-Math.max(s.left,e.left)>1&&Math.min(s.bottom,e.bottom)-Math.max(s.top,e.top)>1));
  });
  expect(await overlapping()).toBe(false);
  if(info.project.name==='desktop-1280'){
    mkdirSync('.local-data/shield-overlap',{recursive:true});
    for(const zoom of [1,1.6,2]){
      await page.evaluate(z=>{const s=JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!);s.view.commonZoom=z;localStorage.setItem('burgundy-expanded:local-v1',JSON.stringify(s));},zoom);await page.reload();
      await expect(page.locator("[data-shield-slot]").first()).toBeVisible();
      await expect(page.locator("[data-shield-slot]")).toHaveCount(count===2?6:count===3?9:12);
      await expect(page.getByRole('button',{name:'공용 보드 배율 복원',exact:true})).toHaveText(`${zoom*100}%`);
      expect(await overlapping()).toBe(false);
      expect(await page.locator('.common-board-svg').evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(940*zoom,1);
      expect(await page.locator('[data-shield-depot]').evaluateAll(groups=>groups.every(group=>{const slots=[...group.querySelectorAll('[data-shield-slot]')].map(el=>el.getAttribute('transform')!.match(/translate\(([^ ]+) ([^)]+)\)/)!.slice(1).map(Number));return slots.length===1||(slots[0][0]===slots[1][0]&&slots[1][1]-slots[0][1]===70);}))).toBe(true);
      expect(await page.locator('[data-shield-depot]').evaluateAll(groups=>groups.every(g=>(g.querySelector('[data-shield-zone]') as SVGGraphicsElement).getBBox().height===(g.querySelectorAll('[data-shield-slot]').length===2?172:104)))).toBe(true);
      for(const shield of await page.locator('[data-shield-slot]').all()){
        await shield.evaluate(el=>el.scrollIntoView({block:'center',inline:'center'}));const hit=await shield.evaluate(el=>{const b=el.querySelector('.shield-outline')!.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {matches:!!hit&&el.contains(hit),label:hit?.getAttribute('aria-label'),slot:el.getAttribute('data-shield-slot')};});expect(hit.matches,JSON.stringify({zoom,...hit})).toBe(true);
      }
      for(const tile of await page.locator('.common-board-svg .supply-art-tile').all()){
        await tile.locator('[data-supply-hit]').scrollIntoViewIfNeeded();
        await tile.locator('[data-supply-hit]').evaluate(el=>{const b=el.getBoundingClientRect();window.scrollBy(0,b.y+b.height/2-window.innerHeight/2);});
        const hit=await tile.evaluate(el=>{const b=el.querySelector('[data-supply-hit]')!.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {matches:!!hit&&el.contains(hit),tile:el.getAttribute('aria-label'),hit:hit?.outerHTML.slice(0,200),x:b.x,y:b.y};});expect(hit.matches,JSON.stringify({zoom,...hit})).toBe(true);
      }
      await page.locator('.common-board-panel').screenshot({path:`.local-data/shield-overlap/after-${count}p-${zoom*100}.png`});
    }
    await page.getByRole('button',{name:'공용 보드 배율 복원',exact:true}).click();
  }
  const tileGeometry=()=>page.evaluate(()=>[...document.querySelectorAll<SVGGElement>(".common-board-svg [data-depot] .supply-art-tile")].map(el=>{const b=el.getBBox();return {label:el.getAttribute("aria-label"),x:b.x,y:b.y,width:b.width,height:b.height};}));
  const originalTiles=await tileGeometry();
  const neighboringTilesOverlap=await page.evaluate(()=>{
    const deps=[...document.querySelectorAll(".common-board-svg [data-depot]")];
    return deps.some((d,i)=>[...d.querySelectorAll(".supply-art-tile")].some(t=>{const a=t.getBoundingClientRect();return deps.slice(i+1).some(other=>[...other.querySelectorAll(".supply-art-tile")].some(u=>{const b=u.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;}));}));
  });
  expect(neighboringTilesOverlap).toBe(false);
  const firstSlot=shieldLayout(game)!.slots[0];
  const button=page.locator(`[data-shield-slot="${firstSlot.id}"]`);
  await page.getByRole("button",{name:/^행동 주사위 1 눈/}).click();
  if(info.project.name.startsWith("mobile"))await button.tap();else await button.click();
  await expect(button).toHaveAttribute("aria-pressed","true");
  // Changing die selection cancels the shield without consuming resources.
  await page.getByRole("button",{name:/^행동 주사위 2 눈/}).click();await expect(button).toHaveAttribute("aria-pressed","false");
  if(info.project.name==="mobile-390"&&count===2){await page.setViewportSize({width:844,height:390});await button.tap();await expect(button).toHaveAttribute("aria-pressed","true");expect(await overlapping()).toBe(false);await page.screenshot({path:info.outputPath("shields-landscape.png"),fullPage:true});}else await button.click();
  await page.getByRole("button",{name:/^방패A .*배치됨.*배치 가능/}).first().click();
  const empty=page.locator(`[data-shield-slot="${firstSlot.id}"]`);
  await expect(empty).toHaveAttribute("data-empty","true");await expect(empty).toHaveAttribute("role","img");
  await expect(page.locator(`[data-mounted-shield="${firstSlot.shieldNumber}"]`)).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.extensionStates.shields.slots[0].shieldNumber)).toBe(null);
  await page.reload();await expect(empty).toHaveAttribute("data-empty","true");
  expect(await empty.getAttribute("tabindex")).toBeNull();
  expect(await tileGeometry()).toEqual(originalTiles);
  await page.locator(".common-board-panel").scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath(`shields-${count}p-empty.png`),fullPage:true});
  if(info.project.name==="desktop-1280")await page.locator(".common-board-panel").screenshot({path:info.outputPath(`shields-${count}p-board.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test("shield preview can be started from setup and explicitly stays local-only",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();
  await expect(page.getByLabel("방패 UI 검증 모드 (능력·유지비 미구현, 로컬 전용)",{exact:true})).not.toBeVisible();await page.getByText("개발자 설정",{exact:true}).click();
  await page.getByLabel("방패 UI 검증 모드 (능력·유지비 미구현, 로컬 전용)",{exact:true}).check();
  await expect(page.getByLabel("플레이 방식",{exact:true})).toHaveValue("local");
  await expect(page.getByLabel("플레이 방식",{exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();
  await expect(page.locator("[data-shield-slot]").first()).toBeVisible();
  await expect(page.locator("[data-shield-depot]")).toHaveCount(6);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).view.computerPlayerIds)).toEqual([]);
});
