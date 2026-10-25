import {chooseLocalStarts} from "./starting-castles";
import { test, expect } from "@playwright/test";
import { createPracticeSession } from "../../src/game/practice";
import { chooseComputerAction } from "../../src/game/computer";
import { applyCoreAction, listCoreActionOptions } from "../../src/game/core";
import { serializeSavedGame } from "../../src/game/save";

test("fresh game rolls, adjusts workers, selects supply and preserves zoom after reload",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/");
  await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();await expect(page.getByRole("button",{name:"저장 파일 내보내기",exact:true})).toBeVisible();await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();
  await chooseLocalStarts(page,2);
  const die=page.getByRole("button",{name:/^행동 주사위 1 눈/});await expect(die).toBeEnabled();await die.click();
  const target=page.locator('.supply-art-tile[aria-disabled="false"]').first();await target.click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.players[0].storage.filter(Boolean).length)).toBe(1);
  await page.getByRole("button",{name:"공용 보드 확대",exact:true}).click();
  await expect(page.getByRole("button",{name:"공용 보드 배율 복원",exact:true})).toHaveText("125%");
  await page.reload();await expect(page.getByRole("button",{name:"공용 보드 배율 복원",exact:true})).toHaveText("125%");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test("TEST FIXTURE legal touch/click placement uses engine validation and mobile dock",async({page},info)=>{
  let state=createPracticeSession({names:["검사A","검사B"],seed:"browser-placement",officialSlots:true,boardIds:["se:base:1","se:base:2"]});
  let placement:Extract<import("../../src/game/types").GameAction,{type:"use-die"}>|undefined;
  for(let step=0;step<120&&!placement;step++){
    const id=state.turn.activePlayerId??"seat-1",legal=listCoreActionOptions(state,id);
    if(legal.ok)placement=legal.value.actions.find((a):a is NonNullable<typeof placement>=>a.type==="use-die"&&a.intent.kind==="place-tile");
    if(placement)break;
    const chosen=chooseComputerAction(state);expect(chosen.ok).toBe(true);if(!chosen.ok)throw new Error("fixture decision");
    const next=applyCoreAction(state,chosen.value);if(!next.ok)throw new Error("fixture action");state=next.value.state;
  }
  if(!placement||placement.intent.kind!=="place-tile")throw new Error("No placement fixture");
  const actor=state.players.find(p=>p.id===placement!.playerId)!,tileId=placement.intent.tileId,cellId=placement.intent.cellId;
  const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game:state,logs:["TEST FIXTURE · 정상 엔진으로 진행해 만든 배치 직전 상태"],view:{zoom:1,focus:false,boardZooms:{},table:true}});
  await page.addInitScript(value=>{if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);},saved);await page.goto("/");
  await page.getByRole("button",{name:new RegExp(`^${actor.name} 개인 보관 ${actor.storage.indexOf(tileId)+1} `)}).click();
  const index=state.dice.players[actor.id].findIndex(d=>d.id===placement!.dieId);
  await page.getByRole("button",{name:new RegExp(`^행동 주사위 ${index+1} 눈`)}).click();
  const cell=page.getByRole("button",{name:new RegExp(`^${actor.name} ${cellId} `)});
  if(info.project.name.startsWith("mobile"))await cell.tap();else await cell.click();
  await expect.poll(()=>page.evaluate(({actorId,cellId})=>{const game=JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game;return game.players.find((p:{id:string})=>p.id===actorId).duchy.cells.find((c:{id:string})=>c.id===cellId).tileId;},{actorId:actor.id,cellId})).toBe(tileId);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("new AI demonstration plays a full 25-round game and survives reload",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.clock.install();await page.goto("/");await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();
  await page.getByLabel("플레이 방식",{exact:true}).selectOption("demo");
  await page.getByLabel("주사위 시드",{exact:true}).fill(`browser-full-${info.project.name}`);
  await page.getByLabel("좌석 1 영지 선택",{exact:true}).selectOption("se:base:1");
  await page.getByLabel(/추가 타일 ·/).check();
  await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();
  let finished=false;
  for(let step=0;step<650;step++){
    await page.clock.runFor(500);
    if(step===35)await page.reload();
    if(step%10===0){finished=await page.getByRole("region",{name:"게임 결과",exact:true}).isVisible();if(finished)break;}
  }
  expect(finished).toBe(true);
  await expect(page.getByLabel("일반 AI 상태",{exact:true})).toContainText("자동 진행 완료");
  await expect(page.getByLabel("모바일 게임 조작",{exact:true})).toHaveCount(0);
  const stats=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!);return {phase:s.game.turn.phase,round:s.game.turn.round,placed:s.game.players.map((p:{duchy:{cells:{tileId:string|null}[]}})=>p.duchy.cells.filter(c=>c.tileId).length),scores:s.game.finalScores.length};});
  await page.getByRole("region",{name:"게임 결과",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath("complete-game.png")});
  expect(stats.phase).toBe("E");expect(stats.round).toBe(5);expect(stats.scores).toBe(2);expect(Math.max(...stats.placed)).toBeGreaterThan(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});


test("common board retains drag mode and pinch while personal boards use native scrolling",async({page},info)=>{
  await page.goto("/");
  const buttons=page.getByRole("button",{name:"공용 보드 확대",exact:true});
  for(let i=0;i<2;i++)await buttons.click();
  await page.getByRole("button",{name:"공용 보드 드래그 이동",exact:true}).first().click();
  const board=page.getByLabel("공용 보드 이동 영역",{exact:true}).first();await board.scrollIntoViewIfNeeded();
  await expect(board).toHaveCSS("touch-action","none");
  const box=await board.boundingBox();if(!box)throw new Error("missing board");
  const viewport=page.viewportSize()!,toolbar=(await page.getByLabel("직접 게임 조작",{exact:true}).boundingBox())!;
  const x=Math.min(box.x+Math.min(box.width-20,250),viewport.width-30),y=(Math.max(box.y+10,toolbar.y+toolbar.height+10)+Math.min(box.y+box.height-10,viewport.height-40))/2;
  if(info.project.name.startsWith("mobile")){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:0}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x-80,y,id:0}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>board.evaluate(el=>el.scrollLeft)).toBeGreaterThan(10);
    const before=await page.locator(".common-board-svg").evaluate(el=>el.getBoundingClientRect().width);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x-60,y,id:0},{x:x+10,y,id:1}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x-90,y,id:0},{x:x+30,y,id:1}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>page.locator(".common-board-svg").evaluate(el=>el.getBoundingClientRect().width)).not.toBe(before);
    await cdp.detach();
  }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-80,y,{steps:8});await page.mouse.up();
    // A wide desktop board can fit without horizontal overflow; only overflowing boards must pan.
    if(await board.evaluate(el=>el.scrollWidth>el.clientWidth))expect(await board.evaluate(el=>el.scrollLeft)).toBeGreaterThan(10);
  }
  await page.getByRole("button",{name:"공용 보드 드래그 이동",exact:true}).first().click();
  await expect(board).toHaveCSS("touch-action","manipulation");
});


test("paused computer stays paused after timers and refresh",async({page})=>{
  await page.clock.install();await page.goto("/");await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();
  await page.getByLabel("플레이 방식",{exact:true}).selectOption("demo");await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();
  await page.getByRole("button",{name:"AI 일시정지",exact:true}).click();
  const revision=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision);
  await page.clock.runFor(5000);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.revision)).toBe(revision);
  await page.reload();await expect(page.getByRole("button",{name:"AI 계속 진행",exact:true})).toBeVisible();
});


test("three and four player local practice seats each finish a round",async({page})=>{
  await page.goto("/");
  for(const count of [3,4]){
    await page.getByRole("button",{name:"⚙ 게임 준비",exact:true}).click();await page.getByLabel("플레이어 수",{exact:true}).selectOption(String(count));
    await page.getByRole("button",{name:"새 연습 시작",exact:true}).click();await expect(page.locator(".live-estates>.estate-panel")).toHaveCount(count);await chooseLocalStarts(page,count);
    await expect(page.getByRole("button",{name:/^행동 주사위 1 눈/})).toBeEnabled();
    for(let seat=0;seat<count;seat++){
      for(let die=0;die<2;die++){await page.getByRole("button",{name:new RegExp(`^행동 주사위 ${die+1} 눈`)}).click();await page.getByLabel("일꾼 자원",{exact:true}).click();}
      await page.getByLabel("차례 제어",{exact:true}).getByRole("button",{name:"턴 종료",exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.turn.activePlayerId)).not.toBe(`seat-${seat+1}`);

    }
    await expect(page.getByRole("button",{name:/^행동 주사위 1 눈/})).toBeEnabled();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game.turn.round)).toBe(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
