import {expect,test,type Locator,type Page,type Route} from "@playwright/test";
import {chooseLocalStarts,chooseOnlineStart,startOnlineLobby,waitOnlineFresh} from "./starting-castles";
import {isolatedRooms} from "./isolated-rooms";
import {createPracticeSession} from "../../src/game/practice";
import {serializeSavedGame} from "../../src/game/save";
import {step} from "../fixtures/shields";
import type {GameState} from "../../src/game/types";

type Playback={starts:number;ended:number;volumes:number[];hasSignal:boolean};
declare global {interface Window {turnSoundPlayback:Playback}}
const playback=(page:Page)=>page.evaluate(()=>window.turnSoundPlayback);
const current=(page:Page):Promise<GameState>=>page.evaluate(()=>JSON.parse(localStorage.getItem("burgundy-expanded:local-v1")!).game);
const die=(page:Page,index:number)=>page.getByRole("button",{name:new RegExp(`^행동 주사위 ${index} 눈`)});
const endTurn=(page:Page)=>page.getByRole("button",{name:"턴 종료",exact:true}).first();
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
        if(!(this instanceof HTMLAudioElement)||this.muted||!this.src.endsWith("/04_wooden_ping.wav"))return playback;
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
  await expect(die(page,1)).toBeEnabled();
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
  await expect.poll(()=>current(page).then(s=>[s.turn.round,s.turn.activePlayerId])).toEqual([2,"seat-2"]);
  await expect.poll(async()=>(await playback(page)).ended).toBe(1);
  await useDice(page);
  await press(endTurn(page));
  await expect.poll(()=>current(page).then(s=>s.turn.activePlayerId)).toBe("seat-1");
  expect((await playback(page)).starts).toBe(1);
  await expect.poll(()=>current(page).then(s=>[s.turn.round,s.turn.activePlayerId])).toEqual([3,"seat-2"]);
  await expect.poll(async()=>(await playback(page)).ended).toBe(2);
  expect((await playback(page)).starts).toBe(2);
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
    await press(page.getByRole("button",{name:"주사위 굴리기",exact:true}));
    await expect.poll(async()=>(await playback(page)).ended).toBe(1);
    await waitOnlineFresh(guest);
    expect((await playback(guest)).starts).toBe(0);
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
