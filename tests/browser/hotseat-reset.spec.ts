import {test,expect,type Page} from '@playwright/test';
import {createPracticeSession} from '../../src/game/practice';
import {finishedHotseat,resetOptions} from '../fixtures/hotseat-reset';
import {serializeSavedGame,type SavedGame} from '../../src/game/save';
import type {GameState} from '../../src/game/types';
import {applyCoreAction,orderedPlayers} from '../../src/game/core';

const key='burgundy-expanded:local-v1',historyKey='burgundy-expanded:turn-history-v1';
async function saved(p:Page):Promise<SavedGame>{return p.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);}
async function load(p:Page,g:GameState){
 await p.goto('/');const setup=p.getByRole('button',{name:'⚙ 게임 준비',exact:true});await setup.click();
 await p.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'finished-hotseat.json',mimeType:'application/json',buffer:Buffer.from(serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:['이전 게임 기록'],view:{zoom:1,focus:false,hotseat:true,table:true,boardZooms:{}}}))});
 await expect(setup).toHaveAttribute('aria-expanded','false');await expect.poll(async()=>(await saved(p)).game).toEqual(g);
 await setup.click();await p.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await setup.click();
}
test('finished 2→3→4→2 and consecutive new games recreate every shared/expansion state, reload and old manual save',async({page},info)=>{
 const seeds=new Set<string>();
 for(const [before,count] of [[2,3],[3,4],[4,2]] as const){
  const old=finishedHotseat(before).game;await load(page,old);await expect(page.getByRole('button',{name:'새 핫시트 게임',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'새 핫시트 게임',exact:true}).click();await page.getByLabel('플레이어 수',{exact:true}).selectOption(String(count));
  for(let i=0;i<count;i++)await page.getByLabel(`좌석 ${i+1} 이름`,{exact:true}).fill(`새 게임${i+1}`);
  let confirmations=0;page.once('dialog',async d=>{confirmations++;await d.dismiss();});
  await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();b.click();});
  await expect.poll(async()=>(await saved(page)).game.status).toBe('setup');expect(confirmations).toBe(0);page.removeAllListeners('dialog');
  const fresh=await saved(page);expect(seeds.has(fresh.game.config.seed)).toBe(false);seeds.add(fresh.game.config.seed);expect(fresh.game.config.seed).not.toBe(old.config.seed);
  const expected=createPracticeSession({...resetOptions,customRules:true,chooseStartingCastles:true,names:Array.from({length:count},(_,i)=>`새 게임${i+1}`),boardIds:Array(count).fill('se:base:2'),seed:fresh.game.config.seed,colors:fresh.game.players.map(p=>p.color!)});
  expect(fresh.game).toEqual(expected);expect(fresh.logs).toHaveLength(1);expect(fresh.view.startingPreview).toBeUndefined();const h=JSON.parse(await page.evaluate(k=>localStorage.getItem(k)!,historyKey));expect(h.game).toEqual(expected);expect(h.history.past).toEqual([]);
  await expect(page.locator('.estate-panel')).toHaveCount(count);await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toHaveCount(0);
  await page.reload();await expect.poll(()=>saved(page)).toEqual(fresh);if(count===2)await page.screenshot({path:info.outputPath('fresh-hotseat-all-expansions.png')});
 }
 expect(seeds.size).toBe(3);
 const old=finishedHotseat().game;await load(page,old);expect((await saved(page)).game).toEqual(old);
});

test('in-progress cancel preserves disk/game; confirmed fresh game clears selections and disabling expansions removes their states',async({page})=>{
 const initial=createPracticeSession({...resetOptions,names:['진행1','진행2'],seed:'reset-running',officialSlots:true});
 const rolled=applyCoreAction(initial,{type:'roll-round',playerId:orderedPlayers(initial)[0]});if(!rolled.ok)throw Error('fixture roll');const g=rolled.value.state;await load(page,g);
 await expect.poll(async()=>(await saved(page)).game.turn.stage).toBe('player-turn');
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await expect(page.getByRole('button',{name:/^행동 주사위 1 눈/})).toHaveAttribute('aria-pressed','true');
 const before=await saved(page),setup=page.getByRole('button',{name:'⚙ 게임 준비',exact:true});await setup.click();
 await page.getByLabel('포도밭 확장',{exact:true}).uncheck();await page.getByLabel('무역로 확장',{exact:true}).uncheck();await page.getByLabel('여관 확장',{exact:true}).uncheck();await page.getByLabel('하프물범 확장',{exact:true}).uncheck();await page.getByLabel('방패 확장 · 24종 능력·유지비·종료 점수 (로컬)',{exact:false}).uncheck();
 page.once('dialog',d=>d.dismiss());await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();expect(await saved(page)).toEqual(before);
 page.once('dialog',d=>d.accept());await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();await expect.poll(async()=>(await saved(page)).game.status).toBe('setup');
 const fresh=await saved(page);expect(fresh.game.vineyards).toBeUndefined();expect(fresh.game.tradeRoutes).toBeUndefined();expect(fresh.game.market.inns).toBeUndefined();expect(fresh.game.extensionStates).toEqual({});await expect(page.locator('.vineyard-supply')).toHaveCount(0);await expect(page.getByRole('button',{name:'선택 취소',exact:true})).toHaveCount(0);
});

test('failed active save does not enter a half-created game or discard prior checkpoint',async({page})=>{
 const g=finishedHotseat().game;await load(page,g);const before=await saved(page);await page.getByRole('button',{name:'새 핫시트 게임',exact:true}).click();
 await page.evaluate(k=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('Test quota full','QuotaExceededError');return set.call(this,key,value);};},key);
 await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();await expect(page.getByText('Test quota full',{exact:true})).toBeVisible();expect(await saved(page)).toEqual(before);await expect(page.getByRole('region',{name:'게임 결과',exact:true})).toBeVisible();
});

test('provisional starting castle is protected by confirmation and cleared only on confirmed new game',async({page})=>{
 const g=createPracticeSession({...resetOptions,names:['배치1','배치2'],seed:'reset-preview',chooseStartingCastles:true});await load(page,g);
 await page.locator('[data-can-start="true"]').first().click();await expect(page.getByRole('button',{name:'확정 및 턴 종료',exact:true})).toBeVisible();
 await expect.poll(async()=>(await saved(page)).view.startingPreview).toBeTruthy();const before=await saved(page);
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();page.once('dialog',d=>d.dismiss());await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();expect(await saved(page)).toEqual(before);
 page.once('dialog',d=>d.accept());await page.getByLabel("시작 플레이어 결정 방식",{exact:true}).selectOption("manual");await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();await expect.poll(async()=>(await saved(page)).game.config.seed).not.toBe(g.config.seed);
 expect((await saved(page)).view.startingPreview).toBeUndefined();await expect(page.getByRole('button',{name:'확정 및 턴 종료',exact:true})).toHaveCount(0);
});
