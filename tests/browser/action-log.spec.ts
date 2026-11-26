import {expect,test,type Page} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {PLAYER_PALETTE} from "../../src/game/player-colors";
import {serializeSavedGame} from "../../src/game/save";
import {customGame} from "../fixtures/custom-rules";
import {isolatedRooms} from "./isolated-rooms";

const name="노랑 · 긴플레이어이름ABCDEFGHIJKLM";
const text=`무역로 1칸 · 보상 획득 · ${name} · 선박 배치 · 승점 +6`;
const notice="두 플레이어가 참가했습니다.";
const legacy="빨강: 일꾼 획득";
const makeFixture=()=>{
 const initial=customGame();
 const players=initial.players.map((player,index)=>({...player,name:index?"빨강":name,color:index?"red" as const:"yellow" as const}));
 const game={...initial,players,config:{...initial.config,players:initial.config.players.map((player,i)=>({...player,name:players[i].name,color:players[i].color}))}};
 const tileId=game.market.numberedDepots.flatMap(depot=>depot.slots).find(slot=>slot.tileId)?.tileId;
 const record=JSON.stringify({format:"action-log-v1",playerId:players[0].id,playerColor:"yellow",text,tileId,dice:[{index:1,value:3,color:"yellow"},{index:2,value:5,color:"yellow"},{index:3,value:1,color:"yellow"}]});
 const logs=[record,notice,legacy,`첫 차례는 ${name}입니다.`,...Array(16).fill(record)];
 return {game,logs};
};

async function checkHistory(page:Page,online:boolean){
 const panel=page.locator(".action-log-panel"),heading=panel.locator("summary");
 const scroller=panel.locator(online?".online-logs":".live-logs");
 const entry=panel.locator(".action-log-entry").first(),player=entry.locator(".action-log-player");
 await expect(heading).toHaveText(online?"행동 기록 · 20개":"행동과 점수 기록 · 20개");
 await expect(heading).toHaveCSS("font-size","15px");
 if(!online)await heading.click();
 await expect(player).toBeVisible();
 await expect(player).toHaveText(name);
 await expect(player).toHaveCSS("font-weight","700");
 await expect(player).toHaveCSS("color","rgb(112, 90, 18)");
 await expect(entry.locator(".action-log-text")).toHaveText(text);
 const font=online?13.75:12.5;
 await expect(entry).toHaveCSS("font-size",font+"px");
 const textColor=await entry.evaluate(el=>getComputedStyle(el).color);
 await expect(entry.locator(".action-log-text")).toHaveCSS("color",textColor);
 await expect(player).not.toHaveCSS("color",textColor);
 if(!online)expect(textColor).toBe("rgb(184, 162, 120)");
 const lineHeight=await entry.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
 expect(lineHeight/font).toBeCloseTo(1.45,2);
 await expect(entry.locator(".action-log-tile")).toHaveCSS("width","40px");
 await expect(entry.locator(".action-log-die svg")).toHaveCount(3);
 await expect(entry.locator(".action-log-die svg").first()).toHaveCSS("width","30px");
 const [artBox,textBox]=await Promise.all([entry.locator(".action-log-tile").boundingBox(),entry.locator(".action-log-text").boundingBox()]);
 expect(artBox!.x+artBox!.width).toBeLessThan(textBox!.x);
 expect(Math.min(artBox!.y+artBox!.height,textBox!.y+textBox!.height)).toBeGreaterThan(Math.max(artBox!.y,textBox!.y));
 await expect(scroller.getByText(notice,{exact:true}).locator("strong")).toHaveCount(0);
 await expect(scroller.locator(".action-log-text").nth(3).locator("strong")).toHaveText(name);
 await expect(scroller.locator(".action-log-player").filter({hasText:"빨강"})).toHaveCSS("color",`rgb(${[1,3,5].map(i=>parseInt(PLAYER_PALETTE.red.ink.slice(i,i+2),16)).join(", ")})`);
 const bounds=await scroller.evaluate(el=>({scrollHeight:el.scrollHeight,height:el.clientHeight,width:el.clientWidth,scrollWidth:el.scrollWidth}));
 expect(bounds.scrollHeight).toBeGreaterThan(bounds.height);
 expect(bounds.scrollWidth).toBe(bounds.width);
 await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 expect(await scroller.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await heading.click();
 await expect(panel).not.toHaveAttribute("open","");
 await heading.click();
 await expect(panel).toHaveAttribute("open","");
 await scroller.evaluate(el=>{el.scrollTop=0;});
 return panel;
}

test("local history keeps the stored text, color, wrapping and scroll after reload",async({page},info)=>{
 const {game,logs}=makeFixture();
 const saved=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs,view:{zoom:1,focus:false,boardZooms:{},table:true}});
 await page.addInitScript(value=>{
  if(!localStorage.getItem("burgundy-expanded:local-v1"))localStorage.setItem("burgundy-expanded:local-v1",value);
  localStorage.setItem("burgundy-expanded:pinned-guidance-v1","off");
 },saved);
 await page.goto("/");
 if(info.project.use.hasTouch)await page.setViewportSize({width:320,height:844});
 const panel=await checkHistory(page,false);
 await panel.screenshot({path:info.outputPath("local-action-history.png")});
 await page.reload();
 await expect(panel).not.toHaveAttribute("open","");
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).logs)).toEqual(logs);
});

test("online history colors only the acting player and fits a narrow display",async({page},info)=>{
 const server=await isolatedRooms();
 try{
  const response=await fetch(server.url+"/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
  expect(response.ok).toBe(true);
  const {id,token}=await response.json();
  const roomFile=join(server.directory,id+".json");
  const room=JSON.parse(await readFile(roomFile,"utf8"));
  const fixture=makeFixture();
  await writeFile(roomFile,JSON.stringify({...room,...fixture}));
  await page.route("**/api/rooms/**",async route=>{
   const request=route.request();
   const result=await fetch(server.url+new URL(request.url()).pathname,{headers:request.headers()});
   await route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:Buffer.from(await result.arrayBuffer())});
  });
  await page.routeWebSocket("**/api/rooms/*/live",ws=>ws.close());
  await page.addInitScript(seat=>localStorage.setItem("burgundy-online-seat-v1",JSON.stringify(seat)),{id,token});
  if(info.project.use.hasTouch)await page.setViewportSize({width:320,height:844});
  await page.goto("/online");
  const panel=await checkHistory(page,true);
  await panel.screenshot({path:info.outputPath("online-action-history.png")});
  expect(JSON.parse(await readFile(roomFile,"utf8")).logs).toEqual(fixture.logs);
 }finally{await server.close();}
});
