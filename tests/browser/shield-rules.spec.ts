import { test, expect, type Page } from "@playwright/test";
import { setup, mount, boundary } from "../fixtures/shields";
import { serializeSavedGame } from "../../src/game/save";
import { automaticAction } from "../../src/game/direct-actions";
import { listCoreActionOptions } from "../../src/game/core/engine";
import { orderedPlayers } from "../../src/game/core/state";
import type { GameState } from "../../src/game/types";

async function load(page:Page,game:GameState){const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:["TEST FIXTURE · 실제 방패 엔진 UI 검사"],view:{zoom:1,focus:false,table:true,boardZooms:{}}});await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);await page.goto("/");await expect(page.getByText("방패 확장 · 능력 적용 중",{exact:true})).toBeVisible();}
async function current(page:Page):Promise<GameState>{return page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);}
async function changed(page:Page,before:number){await expect.poll(async()=>(await current(page)).revision).toBeGreaterThan(before);}

test("active shields start separately from old UI preview",async({page})=>{await page.goto("/");await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();await page.getByLabel("방패 확장 · 18종 능력·유지비·종료 점수 (로컬)",{exact:true}).check();await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();await expect(page.getByText("방패 확장 · 능력 적용 중",{exact:true})).toBeVisible();expect((await current(page)).config.extensions.find(e=>e.id==="shields")!.options).toEqual({rules:true});});

test("shield6 target and shield16 once-per-turn die survive refresh",async({page})=>{await load(page,mount(mount(setup(),6),16));await page.getByLabel("방패6 수도원 공유 대상",{exact:true}).selectOption("seat-2");await page.getByRole("button",{name:"방패6 대상 확정 (변경 불가)",exact:true}).click();await expect(page.getByText(/수도원 공유 대상: 규칙B/)).toBeVisible();await page.getByLabel("방패16 변경할 눈",{exact:true}).selectOption("6");await page.getByRole("button",{name:"방패16 · 주사위 1 변경",exact:true}).click();await expect(page.getByRole("button",{name:"방패16 · 주사위 2 변경",exact:true})).toBeDisabled();await page.reload();await expect(page.getByText(/수도원 공유 대상: 규칙B/)).toBeVisible();await expect(page.getByRole("button",{name:"방패16 · 주사위 1 변경",exact:true})).toBeDisabled();expect((await current(page)).dice.players["seat-1"][0].value).toBe(6);});

test("phase-end free placement and worker tribute are selectable and reloadable",async({page},info)=>{await load(page,boundary(mount(mount(mount(setup(),14),3),18)));const panel=page.getByLabel("타일 효과 선택",{exact:true});await expect(panel).toBeVisible();let g=await current(page);const before=g.players[0].duchy.cells.filter(c=>c.tileId).length;const option=g.turn.pendingChoice!.options.find(o=>{const p=o.payload as {tileId?:string};return p.tileId&&["mine","livestock","monastery"].includes(g.tiles[p.tileId].type);})!;await panel.getByRole("button",{name:option.label,exact:true}).first().click();await changed(page,g.revision);g=await current(page);expect(g.players[0].duchy.cells.filter(c=>c.tileId).length).toBe(before+1);await page.reload();await expect(panel).toBeVisible();await panel.getByRole("button",{name:"방패 14 유지 · 일꾼1 (방패3)",exact:true}).click();g=await current(page);await page.screenshot({path:info.outputPath("shield-tribute.png"),fullPage:true});await expect(panel).toBeVisible();expect(g.turn.stage).toBe("phase-end");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});

test("actual shield UI completes all 25 rounds, phase choices and final score",async({page},info)=>{test.setTimeout(240_000);await page.clock.install();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await load(page,mount(mount(setup(),3),14));let done=false;
  for(let n=0;n<550;n++){
    const g=await current(page);if(g.status==="finished"){done=true;break;}
    const actor=g.turn.activePlayerId??orderedPlayers(g)[0];
    if(g.turn.pendingChoice){const options=g.turn.pendingChoice.options;const option=options.find(o=>o.id.includes(":silver"))??options.find(o=>{const p=o.payload as {tileId?:string}|null;return p?.tileId&&["mine","livestock","monastery"].includes(g.tiles[p.tileId]?.type);})??options.find(o=>o.id==="skip"||o.id==="shield5:skip")??options[0];await page.getByLabel("타일 효과 선택",{exact:true}).getByRole("button",{name:option.label,exact:true}).first().click();}
    else {const options=listCoreActionOptions(g,actor);expect(options.ok).toBe(true);if(!options.ok)throw new Error("legal options");if(automaticAction(g,options.value.actions)){await expect.poll(async()=>{await page.clock.runFor(400);return (await current(page)).revision;}).toBeGreaterThan(g.revision);continue;}const action=options.value.actions.find(a=>a.type==="roll-round"||a.type==="advance-phase")??options.value.actions.find(a=>a.type==="use-die"&&a.intent.kind==="take-workers")??options.value.actions.find(a=>a.type==="end-turn");if(!action)throw new Error("No UI progression action");
      if(action.type==="roll-round")await page.getByRole("button",{name:"공용 보드 주사위 굴리기",exact:true}).click();
      else if(action.type==="advance-phase")await page.getByRole("button",{name:g.turn.phase==="E"?"E단계 수입 · 최종 정산":"단계 수입 · 다음 단계 준비",exact:true}).click();
      else if(action.type==="end-turn")await page.getByRole("button",{name:"추가 행동 없이 다음 차례",exact:true}).click();
      else if(action.type==="use-die"){const i=g.dice.players[actor].findIndex(d=>d.id===action.dieId);await page.getByRole("button",{name:new RegExp(`^행동 주사위 ${i+1} 눈`)}).click();await page.getByRole("button",{name:"일꾼 자원",exact:true}).click();}
    }
    await changed(page,g.revision);if(n===65)await page.reload();
  }
  expect(done).toBe(true);await expect(page.getByRole("region",{name:"게임 결과",exact:true})).toBeVisible();const g=await current(page);await expect(page.locator("[data-mounted-shield]")).toHaveCount((g.extensionStates.shields as unknown as {mounted:unknown[]}).mounted.length);expect(g.turn.phase).toBe("E");expect(g.finalScores![0].finalAdditions.some(e=>e.id.endsWith("shield-3"))).toBe(true);await page.screenshot({path:info.outputPath("shield-complete-game.png"),fullPage:true});expect(errors).toEqual([]);
});
