import {expect,test,type Locator,type Page,type Route} from "@playwright/test";
import {chooseLocalStarts,chooseOnlineStart,startOnlineLobby,waitOnlineFresh} from "./starting-castles";
import {isolatedRooms} from "./isolated-rooms";
import {createPracticeSession} from "../../src/game/practice";
import {serializeSavedGame} from "../../src/game/save";
import {finishDiceRound,step} from "../fixtures/shields";
import type {GameState} from "../../src/game/types";
import type {RoomView} from "../../src/server/rooms";

type Playback={starts:number;ended:number;volumes:number[];hasSignal:boolean};
declare global {interface Window {turnSoundPlayback:Playback}}
const playback=(page:Page)=>page.evaluate(()=>window.turnSoundPlayback);
const current=(page:Page):Promise<GameState>=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);
const die=(page:Page,index:number)=>page.getByRole("button",{name:new RegExp(`^행동 주사위 ${index} 눈`)});
const endTurn=(page:Page)=>page.getByRole("button",{name:"턴 종료",exact:true}).first();
const rollRound=(page:Page)=>page.getByRole("button",{name:"주사위 굴리기",exact:true});
const settings=(page:Page)=>page.getByText("⚙ 게임 설정",{exact:true});
const soundToggle=(page:Page)=>page.getByRole("checkbox",{name:"턴 알림음",exact:true});
const volume=(page:Page)=>page.getByRole("slider",{name:"턴 알림음 음량",exact:true});

async function press(locator:Locator){
  if(await locator.page().evaluate(()=>navigator.maxTouchPoints>0))await locator.tap();
  else await locator.click();
}

async function observeAudio(page:Page){
  await page.addInitScript(()=>{
    localStorage.setItem("burgundy-expanded:pinned-guidance-v1","off");
    const result:Playback={starts:0,ended:0,volumes:[],hasSignal:false};
    window.turnSoundPlayback=result;
    const AudioContextClass=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioContextClass){
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        const playback=play.call(this);
        if(!(this instanceof HTMLAudioElement)||this.muted||!this.src.endsWith(".wav"))return playback;
        return playback.then(()=>{
          result.starts++;
          result.volumes.push(Math.round(this.volume*100));
          result.hasSignal=this.duration>0;
          this.addEventListener("ended",()=>result.ended++,{once:true});
        });
      };
      return;
    }
    let gain:GainNode;
    const createGain=AudioContextClass.prototype.createGain;
    AudioContextClass.prototype.createGain=function(){
      return gain=createGain.call(this);
    };
    const createSource=AudioContextClass.prototype.createBufferSource;
    AudioContextClass.prototype.createBufferSource=function(){
      const source=createSource.call(this),start=source.start.bind(source);
      source.start=(...args:Parameters<AudioBufferSourceNode["start"]>)=>{
        start(...args);
        result.starts++;
        result.volumes.push(Math.round(gain.gain.value*100));
        result.hasSignal=source.buffer?.getChannelData(0).some(sample=>Math.abs(sample)>.01)??false;
      };
      source.addEventListener("ended",()=>result.ended++);
      return source;
    };
  });
}

async function useDice(page:Page){
  for(const index of [1,2]){
    await press(die(page,index));
    await press(page.getByRole("button",{name:"일꾼 자원",exact:true}));
  }
}

test("local turn sound plays the supplied audio once and persists volume and mute",async({page})=>{
  await observeAudio(page);
  await page.goto("/");
  await press(settings(page));
  await expect(soundToggle(page)).toBeChecked();
  await expect(volume(page)).toHaveValue("50");
  expect((await playback(page)).starts).toBe(0);
  await press(settings(page));
  await chooseLocalStarts(page,2);
  await expect.poll(async()=>(await playback(page)).ended).toBe(1);
  expect(await playback(page)).toEqual({starts:1,ended:1,volumes:[50],hasSignal:true});
  await expect(rollRound(page)).toBeEnabled();
  expect((await current(page)).dice.rolledForRound).toBe(false);
  await press(rollRound(page));
  await expect(page.locator(".direct-dice")).toHaveAttribute("aria-busy","true");
  await expect(die(page,1)).toBeDisabled();
  await expect(rollRound(page)).toBeDisabled();
  await expect(die(page,1)).toBeEnabled();

  await press(settings(page));
  await volume(page).fill("25");
  await press(settings(page));
  await useDice(page);
  expect((await playback(page)).starts).toBe(1);
  await press(endTurn(page));
  await expect.poll(async()=>(await playback(page)).ended).toBe(2);
  expect((await playback(page)).volumes).toEqual([50,25]);

  await press(settings(page));
  await soundToggle(page).uncheck();
  await press(settings(page));
  await useDice(page);
  await press(endTurn(page));
  await expect.poll(async()=>(await current(page)).turn.round).toBe(2);
  await expect(rollRound(page)).toBeEnabled();
  expect((await playback(page)).starts).toBe(2);
  await page.reload();
  await press(settings(page));
  await expect(soundToggle(page)).not.toBeChecked();
  await expect(volume(page)).toHaveValue("25");
  await soundToggle(page).check();
  await expect(volume(page)).toBeEnabled();
  expect((await playback(page)).starts).toBe(0);
});

test("a consecutive human turn plays again and the intervening computer turn stays quiet",async({page})=>{
  await observeAudio(page);
  let game=createPracticeSession({names:["AI 좌석","사람 좌석"],seed:"turn-sound",officialSlots:true});
  game=step(game,{type:"roll-round",playerId:"seat-1"});
  for(const die of game.dice.players["seat-1"]){
    game=step(game,{type:"use-die",playerId:"seat-1",dieId:die.id,adjustment:{steps:[],workersSpent:0},intent:{kind:"take-workers"}});
  }
  game=step(game,{type:"end-turn",playerId:"seat-1"});
  // The last player has moved ahead on the ship track and starts the next round.
  game={...game,turn:{...game.turn,orderTrack:[{position:1,players:["seat-2"]},{position:0,players:["seat-1"]}]}};
  const save=serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],
    view:{zoom:1,focus:false,boardZooms:{},computerPlayerIds:["seat-1"]}});
  await page.addInitScript(text=>localStorage.setItem("burgundy-expanded:local-v1",text),save);
  await page.goto("/");
  await expect(die(page,1)).toBeEnabled();
  await useDice(page);
  expect((await playback(page)).starts).toBe(0);
  await press(endTurn(page));
  await expect.poll(()=>current(page).then(s=>[s.turn.round,s.turn.stage])).toEqual([2,"round-setup"]);
  await expect.poll(async()=>(await playback(page)).ended).toBe(1);
  await press(rollRound(page));
  await useDice(page);
  await press(endTurn(page));
  await expect.poll(()=>current(page).then(s=>s.turn.activePlayerId)).toBe("seat-1");
  expect((await playback(page)).starts).toBe(1);
  await expect.poll(()=>current(page).then(s=>[s.turn.round,s.turn.stage])).toEqual([3,"round-setup"]);
  await expect.poll(async()=>(await playback(page)).ended).toBe(2);
  expect((await playback(page)).starts).toBe(2);
});

test("the next phase announces its first turn before rolling and the final phase shows results",async({page})=>{
  await observeAudio(page);
  let game=createPracticeSession({names:["1번","2번"],seed:"phase-audio",officialSlots:true});
  function lastTurnOfPhase(){
    for(let round=1;round<=5;round++){
      game=step(game,{type:"roll-round",playerId:"seat-1"});
      if(round<5)game=finishDiceRound(game);
    }
    for(const playerId of ["seat-1","seat-2"]){
      for(const die of game.dice.players[playerId])game=step(game,{
        type:"use-die",playerId,dieId:die.id,adjustment:{steps:[],workersSpent:0},intent:{kind:"take-workers"},
      });
      if(playerId==="seat-1")game=step(game,{type:"end-turn",playerId});
    }
    return serializeSavedGame({format:"burgundy-local-v1",randomAlgorithm:"counter-v1",game,logs:[],view:{zoom:1,focus:false,boardZooms:{}}});
  }
  await page.addInitScript(text=>localStorage.setItem("burgundy-expanded:local-v1",sessionStorage.getItem("final-phase-sound")??text),lastTurnOfPhase());
  await page.goto("/");
  await press(endTurn(page));
  await expect(rollRound(page)).toBeEnabled();
  await expect.poll(async()=>(await playback(page)).ended).toBe(1);
  const next=await current(page);
  expect([next.turn.phase,next.turn.round,next.dice.rolledForRound]).toEqual(["B",1,false]);
  expect(next.discardedTiles?.map(history=>history.phase)).toEqual(["A"]);
  await expect(page.getByRole("button",{name:"단계 진행",exact:true})).toHaveCount(0);

  game=next;
  for(const phase of ["B","C","D"]){
    for(let round=1;round<=5;round++)game=finishDiceRound(step(game,{type:"roll-round",playerId:"seat-1"}));
    expect(game.turn.phase).toBe(phase);
    game=step(game,{type:"advance-phase",playerId:"seat-1"});
  }
  await page.evaluate(text=>sessionStorage.setItem("final-phase-sound",text),lastTurnOfPhase());
  await page.reload();
  await expect.poll(async()=>(await current(page)).turn.phase).toBe("E");
  await press(endTurn(page));
  await expect(page.getByRole("region",{name:"게임 결과",exact:true})).toBeVisible();
  await expect.poll(async()=>(await current(page)).finalScores?.length).toBe(2);
  expect((await playback(page)).starts).toBe(0);
});

test("online turn sound plays only for the active seat and stays quiet after reconnect",async({page,browser,baseURL},info)=>{
  const rooms=await isolatedRooms();
  const peer=await browser.newContext({baseURL,viewport:info.project.use.viewport,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch});
  const guest=await peer.newPage();
  try{
    for(const side of [page,guest]){
      await observeAudio(side);
      await side.route("**/api/rooms{,/**}",async(route:Route)=>{
        const request=route.request(),host=new URL(rooms.url).host;
        const response=await fetch(rooms.url+new URL(request.url()).pathname,{
          method:request.method(),headers:{...request.headers(),host,origin:rooms.url},body:request.postData()??undefined,
        });
        await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
      });
      await side.routeWebSocket("**/api/rooms/*/live",socket=>socket.close());
    }
    await page.goto("/online");
    await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");
    await press(page.getByRole("button",{name:"2인 방 만들기",exact:true}));
    await guest.goto(await page.getByLabel("초대 링크",{exact:true}).inputValue());
    await press(guest.getByRole("button",{name:"방 참가",exact:true}));
    await startOnlineLobby(page,guest);
    await chooseOnlineStart(page);
    await chooseOnlineStart(guest);
    await waitOnlineFresh(page);
    await expect.poll(async()=>(await playback(page)).ended).toBe(1);
    await expect(rollRound(page)).toBeEnabled();
    await waitOnlineFresh(guest);
    expect((await playback(guest)).starts).toBe(0);
    const controls=page.locator(".online-direct-resources");
    await controls.evaluate(element=>{
      const observer=new MutationObserver(()=>{
        const dice=[...element.querySelectorAll<HTMLButtonElement>(".online-die")];
        if(element.getAttribute("aria-busy")==="true"&&dice.every(die=>die.disabled)&&element.querySelector("[data-die-rolling]")){
          observer.disconnect();
          element.setAttribute("data-checked-roll-lock","true");
        }
      });
      observer.observe(element,{attributes:true,childList:true,subtree:true});
    });
    await press(rollRound(page));
    const dice=page.locator(".online-direct-resources .online-die");
    await expect(controls).toHaveAttribute("data-checked-roll-lock","true");
    await expect(dice.first()).toBeEnabled();
    const owner=await page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-online-seat-v1")!));
    const response=await fetch(`${rooms.url}/api/rooms/${owner.id}`,{headers:{Authorization:`Bearer ${owner.token}`}});
    const current:RoomView=await response.json();
    const faces=["","⚀","⚁","⚂","⚃","⚄","⚅"];
    await expect(dice).toHaveText(current.dice.players[current.seat].map(d=>faces[d.value]));
    expect((await playback(page)).starts).toBe(1);
    const workers=page.getByRole("button",{name:"온라인 일꾼 획득",exact:true});
    await press(workers);
    await expect(page.locator(".online-logs p").filter({hasText:"일꾼 획득"})).toHaveCount(1);
    await press(workers);
    await expect(endTurn(page)).toBeEnabled();
    expect((await playback(page)).starts).toBe(1);
    await press(endTurn(page));
    await expect.poll(async()=>(await playback(guest)).ended).toBe(1);
    expect((await playback(page)).starts).toBe(1);
    await guest.reload();
    await waitOnlineFresh(guest);
    await press(settings(guest));
    await expect(soundToggle(guest)).toBeChecked();
    expect((await playback(guest)).starts).toBe(0);
  }finally{
    await peer.close();
    await rooms.close();
  }
});
