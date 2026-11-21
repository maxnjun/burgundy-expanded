import {test,expect,type Locator,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {boardChoice,startVineDiscard,vineyardDiscardGuidance} from '../../src/game/board-choice';
import {serializeSavedGame} from '../../src/game/save';
import {beginHistory} from '../../src/game/turn-history';
import {serializeTurnHistory} from '../../src/game/turn-history-cache';
import {step} from '../fixtures/shields';
import {choiceOptions,fullVineStorageFixture,shieldPlacementFixture} from '../fixtures/board-choices';
import {isolatedRooms} from './isolated-rooms';
import type {GameState} from '../../src/game/types';

const save=(p:Page):Promise<GameState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
const tap=async(l:Locator)=>{if(await l.page().evaluate(()=>navigator.maxTouchPoints>0))await l.tap();else await l.click();};
const revision=(p:Page)=>p.locator('[data-game-revision]');
const supply=(p:Page,id:string)=>p.locator(`.common-board-panel [data-tile-id="${id}"]`);
const estate=(p:Page)=>p.locator('.estate-panel[data-player-id="seat-1"]');
const cell=(p:Page,id:string)=>estate(p).locator(`[data-estate-cell="${id}"]`);
const guidance=(p:Page,text:string)=>expect(p.getByText(text,{exact:true}).first()).toBeVisible();
const storage=(p:Page)=>estate(p).locator('.estate-keyspaces button');
const phaseTargets=(g:GameState)=>boardChoice(choiceOptions(g),null,g.revision).phaseTiles;
const vineOptions=(g:GameState,mode:'die'|'shop')=>choiceOptions(g).filter(({action,target})=>
 (mode==='shop'?action.type==='extension':action.type==='use-die'&&action.dieId===g.dice.players['seat-1'][0].id)&&!!startVineDiscard(action,target,g.revision));

async function importGame(p:Page,g:GameState,hotseat=true){
 await p.goto('/');
 await expect(revision(p)).toBeVisible();
 await tap(p.getByRole('button',{name:'⚙ 게임 준비',exact:true}));
 const contents=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game:g,logs:[],undo:serializeTurnHistory(g,[],beginHistory(g,[],true)),view:{hotseat,zoom:1,focus:false,table:true,boardZooms:{}}});
 await p.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'board-choice.json',mimeType:'application/json',buffer:Buffer.from(contents)});
 await expect.poll(()=>save(p)).toEqual(g);
 await tap(p.locator('.in-game-settings>summary'));
 await p.getByLabel('상단 턴 안내 따라오기',{exact:true}).uncheck();
 await tap(p.locator('.in-game-settings>summary'));
}

for(const [shield,count] of [[14,2],[14,3],[15,4]] as const)test(`hotseat ${count}: phase shield ${shield} selects and places on the boards`,async({page},info)=>{
 const g=shieldPlacementFixture(shield,count),targets=phaseTargets(g),a=targets[0];
 await importGame(page,g);
 await expect(page.locator('.estate-panel')).toHaveCount(count);
 const prompt=shield===14?'번호 타일 중 원하는 타일을 선택하세요.':'검은 타일 중 원하는 타일을 선택하세요.';
 await guidance(page,prompt);
 await expect(page.getByRole('button',{name:/^방패(?:14|15) · .*직접 배치/})).toHaveCount(0);
 const opposite=(shield===14?g.market.blackDepot:g.market.numberedDepots.flatMap(d=>d.slots.map(s=>s.tileId))).find(Boolean)!;
 await expect(supply(page,opposite)).toHaveAttribute('aria-disabled','true');
 await expect(supply(page,a.tileId)).toHaveAttribute('aria-disabled','false');
 await tap(supply(page,a.tileId));
 await guidance(page,'배치할 곳을 선택하세요.');
 await expect(supply(page,a.tileId)).toHaveAttribute('aria-pressed','true');
 await expect(cell(page,a.cellId)).toHaveAttribute('aria-disabled','false');
 const illegal=g.players[0].duchy.cells.find(c=>!c.tileId&&!targets.some(t=>t.tileId===a.tileId&&t.cellId===c.id))!;
 await expect(cell(page,illegal.id)).toHaveAttribute('aria-disabled','true');
 expect(await save(page)).toEqual(g);
 await tap(page.getByRole('button',{name:'다른 타일 선택',exact:true}));
 await guidance(page,prompt);
 await tap(supply(page,a.tileId));
 if(count!==3){
  await page.locator('.common-board-panel').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:info.outputPath(`shield-${shield}-supply.png`)});
  await estate(page).locator('.estate-original-board').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:info.outputPath(`shield-${shield}-destination.png`)});
 }
 await tap(cell(page,a.cellId));
 await expect.poll(()=>save(page)).toEqual(step(g,a.action));
});

for(const mode of ['die','shop'] as const)test(`vineyard ${mode}: no discard before explicit confirmation`,async({page},info)=>{
 const g=fullVineStorageFixture(mode==='shop'),option=vineOptions(g,mode)[0];
 const draft=startVineDiscard(option.action,option.target,g.revision)!;
 await importGame(page,g);
 if(mode==='die')await tap(page.getByRole('button',{name:/^행동 주사위 1 눈/}));
 const tile=page.getByRole('button',{name:new RegExp(`^포도 ${mode==='shop'?'상점':'공급'}.+?${draft.tileId}$`)});
 await tap(tile);
 await guidance(page,vineyardDiscardGuidance);
 const dialog=page.getByRole('alertdialog',{name:'포도 폐기 확인',exact:true});
 await expect(dialog).toHaveCount(0);
 const indexes=mode==='die'?[1,2]:[0];
 const first=storage(page).nth(indexes[0]);
 await tap(first);
 await expect(first).toHaveAttribute('aria-pressed','true');
 if(mode==='die'){
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(first).toHaveAttribute('aria-pressed','true');
  await tap(storage(page).nth(indexes[1]));
 }
 await expect(dialog).toBeVisible();
 expect(await save(page)).toEqual(g);
 if(mode==='die'){
  await first.evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.keyboard.press('Escape');
  await page.screenshot({path:info.outputPath('vineyard-discard.png')});
 }
 await tap(dialog.getByRole('button',{name:'취소',exact:true}));
 await expect(dialog).toHaveCount(0);
 expect(await save(page)).toEqual(g);
 for(const i of indexes)await tap(storage(page).nth(i));
 const ids=mode==='die'?indexes.map(i=>g.players[0].storage[i]!):[g.players[0].vineyardReserve![0].tileId];
 if(draft.kind!=='vine-discard')throw Error('fixture draft');
 const action=boardChoice(choiceOptions(g),{...draft,discardIds:ids},g.revision).vineAction!;
 await tap(dialog.getByRole('button',{name:'교체 확정',exact:true}));
 await expect.poll(()=>save(page)).toEqual(step(g,action));
 await tap(page.getByRole('button',{name:'이전 행동으로',exact:true}));
 await expect.poll(()=>save(page)).toEqual(g);
});

test('online seats share the committed shield placement and chosen vineyard discard',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});
 const other=await peer.newPage();
 try{
  const json=(body:object)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async route=>{
    const q=route.request(),r=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});
    await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
   });
   await context.routeWebSocket('**/api/rooms/*/live',()=>{});
  }
  for(const kind of [14,15,'vine'] as const){
   const g=kind==='vine'?fullVineStorageFixture():shieldPlacementFixture(kind);
   const owner=await (await fetch(server.url+'/api/rooms',json({name:'영주1',vineyards:kind==='vine',shieldRules:kind!=='vine'}))).json();
   const guest=await (await fetch(`${server.url}/api/rooms/${owner.id}/join`,json({name:'영주2'}))).json();
   const path=join(server.directory,owner.id+'.json');
   const raw=JSON.parse(await readFile(path,'utf8'));raw.game=g;raw.logs=[];raw.history=beginHistory(g,[],true);await writeFile(path,JSON.stringify(raw));
   for(const [p,seat] of [[page,owner],[other,{id:owner.id,token:guest.token}]] as const){
    await p.goto('/');
    await p.evaluate(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),seat);
    await p.goto('/online');
    await expect(revision(p)).toHaveAttribute('data-game-revision',String(g.revision));
   }
   let final:GameState;
   if(kind==='vine'){
    const option=vineOptions(g,'die')[0],draft=startVineDiscard(option.action,option.target,g.revision)!;
    if(draft.kind!=='vine-discard')throw Error('fixture draft');
    await tap(page.locator('.online-controls .online-die').first());
    await tap(page.getByRole('button',{name:new RegExp(`^포도 공급.+?${draft.tileId}$`)}));
    await guidance(page,vineyardDiscardGuidance);
    await tap(storage(page).nth(1));
    await page.reload();
    await expect(storage(page).nth(1)).toHaveAttribute('aria-pressed','true');
    await tap(storage(page).nth(2));
    await expect(revision(other)).toHaveAttribute('data-game-revision',String(g.revision));
    await tap(page.getByRole('button',{name:'온라인 교체 확정',exact:true}));
    final=step(g,boardChoice(choiceOptions(g),{...draft,discardIds:g.players[0].storage.slice(1) as string[]},g.revision).vineAction!);
   }else{
    const a=phaseTargets(g)[0];
    await expect(supply(other,a.tileId)).toHaveAttribute('aria-disabled','true');
    await tap(supply(page,a.tileId));
    await expect(revision(other)).toHaveAttribute('data-game-revision',String(g.revision));
    await expect(cell(page,a.cellId)).toHaveAttribute('aria-disabled','false');
    await tap(cell(page,a.cellId));
    final=step(g,a.action);
   }
   await expect(revision(page)).toHaveAttribute('data-game-revision',String(final.revision));
   await expect(revision(other)).toHaveAttribute('data-game-revision',String(final.revision));
   expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(final);
  }
 }finally{await page.goto('about:blank');await peer.close();await server.close();}
});
