import {test,expect,type Route} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createPracticeSession} from "../../src/game/practice";
import {applyCoreAction} from "../../src/game/core";
import {serializeSavedGame} from "../../src/game/save";
import {vineScore,VINE_TILES} from "../../src/game/vineyards";
import {layeredVineFixture,vineFixture} from "../fixtures/vineyards";
import {isolatedRooms} from "./isolated-rooms";
import type {RoomView} from "../../src/server/rooms";

for(const count of [2,3,4])test(`score pages ${count}p are independent, accurate and do not change game state`,async({page},info)=>{
 let game=count===2?layeredVineFixture():createPracticeSession({names:Array.from({length:count},(_,i)=>`영주${i+1}`),seed:`scores-${count}`,vineyards:true,officialSlots:true});
 if(count!==2){const rolled=applyCoreAction(game,{type:"roll-round",playerId:"seat-1"});if(!rolled.ok)throw Error("score fixture roll");game=rolled.value.state;}
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>localStorage.setItem("burgundy-expanded:local-v1",s),saved);await page.goto("/");
 const common=page.locator("[data-region-score-panel] [data-score-page]"),personal=page.locator(".personal-score-pages [data-score-page]");
 await expect(personal).toHaveCount(count);await expect(common).toHaveAttribute("data-score-page","1");
 await expect(common).toContainText("지역 완성");await expect(common).toContainText(`현재 누적 ${game.players[0].victoryPoints}점`);
 await common.getByRole("button",{name:"공용 점수판 다음 페이지",exact:true}).click();
 await expect(common).toHaveAttribute("data-score-page","2");await expect(common.locator("[data-vine-score]")).toHaveAttribute("data-vine-score",String(vineScore(game.vineyards!,game.players[0].id)));
 await expect(personal.first()).toHaveAttribute("data-score-page","1");
 await personal.first().getByRole("button",{name:`${game.players[0].name} 점수판 다음 페이지`,exact:true}).click();
 await expect(personal.first()).toHaveAttribute("data-score-page","2");await expect(personal.nth(1)).toHaveAttribute("data-score-page","1");
 await common.getByRole("button",{name:"공용 점수판 이전 페이지",exact:true}).click();
 await expect(personal.first()).toHaveAttribute("data-score-page","2");
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 for(const panel of await personal.all()){
  const nav=panel.getByRole("button",{name:/다음 페이지$/});
  await expect(nav).toHaveAttribute("aria-disabled",await panel.getAttribute("data-score-page")==="2"?"true":"false");
  const bounds=await panel.evaluate(el=>{const outer=el.closest("svg")!.getBoundingClientRect();return [...el.querySelectorAll("text")].every(t=>{const r=t.getBoundingClientRect();return r.left>=outer.left-1&&r.right<=outer.right+1&&r.bottom<=outer.bottom+1;});});expect(bounds).toBe(true);
 }
 await expect(page.locator(".common-board-svg")).toHaveAttribute("viewBox","0 0 950 1030");
 if(count===2){const board=page.locator(".common-board-panel");for(const zoom of [100,160,200]){await board.getByRole("button",{name:"공용 보드 배율 복원",exact:true}).click();for(let value=100;value<zoom;value+=10){await board.locator(".live-board-scroll").evaluate(el=>el.dispatchEvent(new WheelEvent("wheel",{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true})));await expect(board.getByRole("button",{name:"공용 보드 배율 복원",exact:true})).toHaveText(`${value+10}%`);}await common.getByRole("button",{name:"공용 점수판 다음 페이지",exact:true}).click();await expect(common).toHaveAttribute("data-score-page","2");await common.getByRole("button",{name:"공용 점수판 이전 페이지",exact:true}).press("Enter");await expect(common).toHaveAttribute("data-score-page","1");}await board.getByRole("button",{name:"공용 보드 배율 복원",exact:true}).click();}
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game)).toEqual(game);
 await page.mouse.click(1,1);await page.mouse.move(0,0);await personal.first().scrollIntoViewIfNeeded();await page.locator(".personal-score-pages").first().screenshot({path:info.outputPath(`personal-vineyard-score-${count}p.png`)});
 await page.locator(".estate-panel").first().screenshot({path:info.outputPath(`score-pages-${count}p.png`)});
 if(count===2){await page.locator("[data-region-score-panel]").screenshot({path:info.outputPath("common-estate-score.png")});await common.getByRole("button",{name:"공용 점수판 다음 페이지",exact:true}).click();await page.locator("[data-region-score-panel]").screenshot({path:info.outputPath("common-vineyard-score.png")});}
});

test("disabled vineyards have no invented score",async({page})=>{
 const game=createPracticeSession({names:["영주1","영주2"],seed:"score-disabled"});
 await page.addInitScript(s=>localStorage.setItem("burgundy-expanded:local-v1",s),serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}}));await page.goto("/");
 const panel=page.locator("[data-region-score-panel]");await panel.getByRole("button",{name:"공용 점수판 다음 페이지"}).click();await expect(panel).toContainText("포도밭 확장이 활성화되지 않았습니다.");await expect(panel.locator("[data-vine-score]")).toHaveCount(0);
});

test("two online browsers update score pages from authoritative state and preserve independent selections",async({page,browser},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({viewport:info.project.use.viewport});
 const proxy=async(r:Route)=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});};
 await page.context().route("**/api/rooms{,/**}",proxy);await peer.route("**/api/rooms{,/**}",proxy);await page.context().routeWebSocket("**/api/rooms/*/live",ws=>ws.close());await peer.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
 try{
  const seat=await(await fetch(`${server.url}/api/rooms`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"포도1",vineyards:true})})).json();
  const other=await(await fetch(`${server.url}/api/rooms/${seat.id}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"포도2"})})).json();
  const path=join(server.directory,`${seat.id}.json`),room=JSON.parse(await readFile(path,"utf8"));room.game=vineFixture();const targetTile=room.game.vineyards.depots[0].tileId;const grape=VINE_TILES[targetTile][0],old=room.game.vineyards.players["seat-1"].tokens[0];room.game.vineyards.pool[old]++;room.game.vineyards.pool[grape]--;room.game.vineyards.players["seat-1"].tokens=[grape];delete room.lobby;delete room.draft;delete room.history;await writeFile(path,JSON.stringify(room));
  const view=async()=>await(await fetch(`${server.url}/api/rooms/${seat.id}`,{headers:{Authorization:`Bearer ${seat.token}`}})).json() as RoomView;
  const act=async(predicate:(a:RoomView["actions"][number])=>boolean)=>{const v=await view(),entry=v.actions.find(predicate);expect(entry).toBeTruthy();const res=await fetch(`${server.url}/api/rooms/${seat.id}/actions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${seat.token}`},body:JSON.stringify({revision:v.revision,action:entry!.action})});expect(res.status).toBe(200);return view();};
  await page.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),seat);await peer.addInitScript(s=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(s)),other);await page.goto("/online");const guest=await peer.newPage();await guest.goto("/online");
  const common=page.locator("[data-region-score-panel] [data-score-page]"),personal=page.locator(".personal-score-pages [data-score-page]").first();
  await common.getByRole("button",{name:"공용 점수판 다음 페이지"}).click();await personal.getByRole("button",{name:"포도1 점수판 다음 페이지"}).click();
  await act(a=>a.action.type==="use-die"&&a.action.intent.kind==="vineyard"&&a.action.intent.command==="take"&&a.action.intent.tileId===targetTile);
  let current=await act(a=>a.action.type==="use-die"&&a.action.intent.kind==="vineyard"&&a.action.intent.command==="place"&&a.action.intent.slotId==="V01");
  let guard=0;while(current.actions.some(a=>a.action.type==="resolve-choice")){expect(guard++).toBeLessThan(20);current=await act(a=>a.action.type==="resolve-choice"&&(a.action.optionId==="skip"||!current.actions.some(x=>x.action.type==="resolve-choice"&&x.action.optionId==="skip")));}
  await expect(page.locator("[data-game-revision]")).toHaveAttribute("data-game-revision",String(current.revision));await expect(guest.locator("[data-game-revision]")).toHaveAttribute("data-game-revision",String(current.revision));
  expect(vineScore(current.vineyards!,"seat-1")).toBeGreaterThan(0);await expect(common.locator("[data-vine-score]")).toHaveAttribute("data-vine-score",String(vineScore(current.vineyards!,"seat-1")));await expect(common).toHaveAttribute("data-score-page","2");await expect(personal.locator("[data-vine-score]")).toHaveAttribute("data-vine-score",String(vineScore(current.vineyards!,"seat-1")));
  await expect(guest.locator("[data-region-score-panel] [data-score-page]")).toHaveAttribute("data-score-page","1");await expect(guest.locator(".personal-score-pages").first()).toContainText(`현재 누적 ${current.players[0].victoryPoints}점`);
  await page.locator(".online-estates .estate-panel").first().screenshot({path:info.outputPath("online-score-pages.png")});
  await guest.reload();await expect(guest.locator(".personal-score-pages").first()).toContainText(`현재 누적 ${current.players[0].victoryPoints}점`);
 }finally{await page.context().unrouteAll({behavior:"ignoreErrors"});await peer.unrouteAll({behavior:"ignoreErrors"});await peer.close();await server.close();}
});
