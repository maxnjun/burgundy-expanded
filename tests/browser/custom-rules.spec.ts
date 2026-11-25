import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serializeSavedGame} from '../../src/game/save';
import {beginHistory} from '../../src/game/turn-history';
import {serializeTurnHistory} from '../../src/game/turn-history-cache';
import {boardTarget,directActions} from '../../src/game/direct-actions';
import {settleShieldState} from '../../src/game/core/shield-effects';
import {setShieldLayout,shieldLayout} from '../../src/game/shields';
import {boundary,choose,finishDiceRound,step} from '../fixtures/shields';
import {customGame,customMount,moveTile,officialTerritory} from '../fixtures/custom-rules';
import {isolatedRooms} from './isolated-rooms';
import type {GameState,GameAction} from '../../src/game/types';

const active=()=>'.estate-panel[data-player-id="seat-1"]';
const current=(p:Page):Promise<GameState>=>p.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
async function press(target:Locator){if(await target.page().evaluate(()=>navigator.maxTouchPoints>0))await target.tap();else await target.click();}
async function load(page:Page,game:GameState){
 await page.goto('/');
 await press(page.getByRole('button',{name:'⚙ 게임 준비',exact:true}));
 const save=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{hotseat:true,zoom:1,focus:false,table:true,boardZooms:{}},undo:serializeTurnHistory(game,[],beginHistory(game,[],true))});
 await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'custom-rules.json',mimeType:'application/json',buffer:Buffer.from(save)});
 await expect.poll(()=>current(page)).toEqual(game);
}
function nextPhase(game:GameState){
 const a:GameAction={type:'advance-phase',playerId:'seat-1'};
 let n=step(boundary(game),a);
 for(let i=0;i<30&&n.turn.pendingChoice;i++){
  const options=n.turn.pendingChoice.options;
  const first=options.find(o=>o.id.startsWith('remove:'))??options.find(o=>o.id==='skip')??options[0];
  n=choose(n,o=>o.id===first.id);
 }
 return n.turn.stage==='phase-end'?step(n,a):n;
}

test('shield 21 has no dice status and shield 22 grays out until the next phase',async({page},info)=>{
 const roll=(game:GameState)=>step(game,{type:'roll-round',playerId:'seat-1'});
 await load(page,customMount(customMount(customGame(),22),21));
 const control=page.getByLabel('방패21 주사위 변경',{exact:true});
 const shield=(n:number)=>page.locator('[data-mounted-shield="'+n+'"]');
 const dice=page.locator('.direct-dice button');
 const extra=page.getByRole('button',{name:'방패22 · 세 번째 주사위 굴리기',exact:true});
 const used=page.getByRole('button',{name:'방패22 · 이번 페이즈 사용 완료',exact:true});
 await expect(dice).toHaveCount(2);
 await expect(shield(22)).toHaveAttribute('data-shield-dice-status','ready');
 await press(extra);
 await expect(dice).toHaveCount(3);
 await expect(dice.nth(2).locator('[data-die-rolling]')).toHaveCount(1);
 await expect(dice.first().locator('[data-die-rolling]')).toHaveCount(0);
 await expect(dice.first()).toBeDisabled();
 await expect(dice.nth(2)).toBeEnabled();
 expect(await dice.nth(2).textContent()).toBe(["","⚀","⚁","⚂","⚃","⚄","⚅"][(await current(page)).dice.players["seat-1"][2]!.value]);
 await expect(used).toBeDisabled();
 await expect(control).toHaveCount(0);
 await expect(shield(21)).not.toHaveAttribute('data-shield-dice-status',/./);

 await load(page,roll(finishDiceRound(await current(page))));
 await page.reload();
 await expect(dice).toHaveCount(2);
 await expect(control).toHaveCount(0);
 await expect(used).toBeDisabled();
 await expect(shield(22)).toHaveCSS('filter','grayscale(1)');
 await expect(shield(21)).toHaveCSS('filter','none');
 await expect(shield(22).locator('title').last()).toHaveText(/이번 페이즈에 사용 완료/);
 await page.screenshot({path:info.outputPath('shield-dice-used.png')});
 const advance:GameAction={type:'advance-phase',playerId:'seat-1'};
 let next=step(boundary(await current(page)),advance);
 while(next.turn.pendingChoice)next=choose(next,o=>o.id.startsWith('pay:')&&o.id.endsWith(':silver'));
 if(next.turn.stage==='phase-end')next=step(next,advance);
 await load(page,roll(next));
 await expect(dice).toHaveCount(2);
 await expect(extra).toBeEnabled();
 await expect(control).toHaveCount(0);
 await expect(shield(22)).toHaveAttribute('data-shield-dice-status','ready');
 await expect(shield(21).locator('title').last()).toHaveText(/기본 종료 승점 12점/);
});
test('shield 21 purchase pays only the bank and shield 19 discard pays two silver',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off'));
 const mounted=customMount(customMount(customGame(),21),19);
 const {game,tileId}=moveTile(mounted,t=>t.type==='ship',undefined,1);
 await load(page,game);
 const purchase=page.locator('.custom-board-actions details').filter({hasText:'방패 21번 · 상대 저장고 구매'});
 await press(purchase.locator('summary'));
 await press(purchase.getByRole('button',{name:/왕실B의 .* 선택/}));
 await expect(purchase.getByText('은화 2개를 공용 은행에 지불합니다. 판매자 보상은 없습니다.')).toBeVisible();
 await purchase.screenshot({path:info.outputPath('shield-21-bank-payment.png')});
 await press(purchase.getByRole('button',{name:'구매 확정',exact:true}));
 await expect.poll(async()=> (await current(page)).players.map(p=>p.silver)).toEqual([28,30]);
 expect((await current(page)).players[1].storage).not.toContain(tileId);
 await expect(purchase).toHaveCount(0);
 const discard=page.locator('.custom-board-actions details').filter({hasText:'보관 타일 폐기'});
 await press(discard.locator('summary'));
 await press(discard.getByRole('button',{name:/폐기 후보/}));
 await press(discard.getByRole('button',{name:'타일 폐기 확정',exact:true}));
 await expect.poll(async()=> (await current(page)).players.map(p=>p.silver)).toEqual([30,30]);
 expect((await current(page)).market.removedTileIds).toContain(tileId);
 await page.reload();
 await expect.poll(async()=> (await current(page)).players.map(p=>p.silver)).toEqual([30,30]);
 for(const n of [19,21]){
  const mounted=page.locator(`[data-mounted-shield="${n}"]`);
  const art=mounted.locator(`[data-shield-image="${n}"]`);
  await expect(art).toHaveAttribute('href',new RegExp(`shield-${n}\\.png\\?v=[0-9a-f]+`));
  if(info.project.name==='desktop-1280'){
   await press(mounted.locator('..'));
   const detail=page.getByRole('dialog',{name:'방패 상세',exact:true});
   await expect(detail).toContainText(n===19?'타일마다 은화 2개':'판매자에게 별도 보상은 없습니다');
   await page.mouse.move(1,1);
   await expect(page.locator('#tile-effect-tooltip')).toHaveCount(0);
   await detail.screenshot({path:info.outputPath(`shield-${n}-details.png`)});
   await press(detail.getByRole('button',{name:'방패 상세 닫기'}));
  }
 }
 if(info.project.name==='desktop-1280'){
  const board=page.getByRole('group',{name:'왕실A 영지',exact:true});
  const enlarge=page.getByRole('button',{name:'왕실A 영지 확대',exact:true});
  let zoom=100;
  for(const level of [100,160,200]){
   while(zoom<level){await press(enlarge);zoom+=10;}
   await board.screenshot({path:info.outputPath(`shields-estate-${level}.png`)});
  }
 }
});

test('monastery 31 previews the historical refund, cancels, persists and undoes',async({page},info)=>{
 const {game,a,target,region}=officialTerritory();await load(page,game);
 await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
 await press(page.getByRole('button',{name:'영지에서 빈 칸 선택',exact:true}));
 await press(page.locator(`${active()} [data-estate-cell="${target.id}"]`));
 await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
 await expect(page.getByText(/기존 지역 완성 점수 13점 반납/)).toBeVisible();
 if(info.project.name==='desktop-1280')await page.locator('.custom-board-actions').screenshot({path:info.outputPath('monastery-31-refund.png')});
 await press(page.getByRole('button',{name:'색상 변경 취소',exact:true}));
 expect(await current(page)).toEqual(game);
 if(!await page.getByLabel('변경할 빈 영지 칸',{exact:true}).isVisible())await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
 await page.getByLabel('변경할 빈 영지 칸',{exact:true}).selectOption(target.id);
 await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
 await press(page.getByRole('button',{name:'색상 변경 확정',exact:true}));
 const after=step(game,a);
 await expect.poll(()=>current(page)).toEqual(after);
 await page.reload();
 await expect.poll(()=>current(page)).toEqual(after);
 await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));
 await expect.poll(()=>current(page)).toEqual(game);
});

test('the added slot stays beside the original with one backdrop and both empty silhouettes',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off'));
 const a=customGame(),b=nextPhase(a),slot=shieldLayout(b)!.slots.find(s=>s.index===1)!;
 const group=page.locator(`[data-shield-depot="${slot.depot}"]`),j=(n:number)=>group.locator(`[data-shield-slot="shield:depot:${slot.depot}:${n}"]`);
 await load(page,a);
 await expect(group.locator('[data-shield-slot]')).toHaveCount(1);
 const start=await j(0).getAttribute('transform');
 const n0=shieldLayout(b)!.slots.find(s=>s.depot===slot.depot&&s.index===0)!.shieldNumber!;
 const started=step(b,{type:'roll-round',playerId:'seat-1'});
 const emptyBoth=customMount(customMount(started,n0),slot.shieldNumber!);
 const returned=step(nextPhase(emptyBoth),{type:'roll-round',playerId:'seat-1'});
 const layout=shieldLayout(started)!;
 const extra=layout.boxed.find(n=>n>=19)!;
 const bothNew=setShieldLayout(started,{...layout,slots:layout.slots.map(s=>s.depot===slot.depot&&s.index===0?{...s,shieldNumber:extra}:s),boxed:layout.boxed.map(n=>n===extra?n0:n)});
 for(const [name,game,empty] of [
  ['initial-empty',customMount(a,n0),1],
  ['expanded',started,0],
  ['both-new',bothNew,0],
  ['empty-and-new',customMount(started,n0),1],
  ['both-empty',emptyBoth,2],
  ['returned',returned,0],
 ] as const){
  await load(page,game);
  await expect(group.locator('[data-shield-zone]')).toHaveCount(1);
  await expect(group.locator('[data-empty=true]')).toHaveCount(empty);
  await expect(group.locator('image[data-shield-image]')).toHaveCount((name==='initial-empty'?1:2)-empty);
  if(name==='returned'){
   await expect(j(0).locator(`image[data-shield-image="${n0}"]`)).toHaveCount(1);
   await expect(j(1).locator(`image[data-shield-image="${slot.shieldNumber}"]`)).toHaveCount(1);
  }
  await expect(j(0)).toHaveAttribute('transform',start!);
  if(name!=='initial-empty'){
   await expect(group.locator('[data-shield-horizontal=true]')).toHaveCount(1);
   const [left,right]=await Promise.all([j(0).locator('.shield-outline').boundingBox(),j(1).locator('.shield-outline').boundingBox()]);
   expect(Math.abs(left!.x-right!.x)).toBeGreaterThan(left!.width);
   const translateY=async(slot:Locator)=>(await slot.getAttribute('transform'))?.match(/translate\([^ ]+ ([^ )]+)/)?.[1];
   expect(await translateY(j(0))).toBe(await translateY(j(1)));
  }
  await group.scrollIntoViewIfNeeded();
  await group.screenshot({path:info.outputPath(`shields-${name}.png`)});
  if(name==='expanded'&&info.project.name==='desktop-1280')await page.locator('.common-board-svg').screenshot({path:info.outputPath('common-board-phase-b.png')});
 }
});

test('three-seat side additions clear numbered tiles at regular and larger zooms',async({page},info)=>{
 let game=customGame(3);
 for(let i=0;i<3;i++)game=nextPhase(game);
 game=step(game,{type:'roll-round',playerId:'seat-1'});
 await load(page,game);
 for(const zoom of [100,160,200]){
  const panel=page.locator('.common-board-panel');
  const displayed=panel.locator('.common-board-toolbar button').filter({hasText:/^\d+%$/});
  for(let i=0;i<6&&Number((await displayed.textContent())?.trim().slice(0,-1))<zoom;i++)
   await press(panel.getByRole('button',{name:'공용 보드 확대',exact:true}));
  await expect(displayed).toHaveText(`${zoom}%`);
  for(const depot of [3,5]){
   const shield=panel.locator(`[data-shield-slot="shield:depot:${depot}:1"] .shield-outline`);
   await expect(shield).toBeVisible();
   const bounds=(await shield.boundingBox())!;
   const hits=await panel.locator(`[data-depot="${depot}"] [data-supply-hit]`).evaluateAll(list=>list.map(e=>{
    const {x,y,width,height}=e.getBoundingClientRect();return {x,y,width,height};
   }));
   expect(hits.every(hit=>bounds.x+bounds.width<=hit.x||hit.x+hit.width<=bounds.x||bounds.y+bounds.height<=hit.y||hit.y+hit.height<=bounds.y)).toBe(true);
  }
  if(info.project.name==='android-landscape'){
   const group=panel.locator('[data-shield-depot="3"]');
   await group.scrollIntoViewIfNeeded();await group.screenshot({path:info.outputPath(`three-seat-shields-${zoom}.png`)});
  }
 }
});

for(const count of [2,3,4] as const)test(count+'-seat shared board keeps shield zones clear and centered',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off'));
 const initial=customGame(count,true,true);
 let expanded=initial;
 for(const depot of count===2?[1,3,4,6]:count===3?[1,3,5]:[]){
  const previous=shieldLayout(expanded)!;
  const next=nextPhase(expanded),layout=shieldLayout(next)!;
  const added=layout.slots.find(s=>!previous.slots.some(old=>old.id===s.id))!;
  expanded=setShieldLayout(next,{...layout,slots:layout.slots.map(slot=>slot.id===added.id?{...slot,depot:depot as typeof slot.depot,id:'shield:depot:'+depot+':1'}:slot)});
 }
 if(expanded!==initial)expanded=step(expanded,{type:'roll-round',playerId:'seat-1'});

 const board=page.locator('.common-board-svg');
 const slot=(depot:number)=>board.locator('[data-shield-slot="shield:depot:'+depot+':0"]');
 const verify=async()=>{
  const out=await board.evaluate(svg=>{
   const bounds=(selector:string)=>svg.querySelector(selector)!.getBoundingClientRect();
   const center=({left,right,top,bottom}:DOMRect)=>({x:(left+right)/2,y:(top+bottom)/2});
   const within=(b:DOMRect,p:DOMRect)=>b.left>=p.left-.1&&b.right<=p.right+.1&&b.top>=p.top-.1&&b.bottom<=p.bottom+.1;
   const boardBounds=svg.getBoundingClientRect();
   const unit=boardBounds.width/(svg as SVGSVGElement).viewBox.baseVal.width;
   const zones=[[1,'phase-goods','turn-order','phase-goods-content','turn-order-content'],[4,'region-score','color-bonuses','region-score-panel','color-bonuses']].map(([depot,leftId,rightId,leftContent,rightContent])=>{
    const left=bounds('[data-info-panel="'+leftId+'"]'),right=bounds('[data-info-panel="'+rightId+'"]');
    const zone=bounds('[data-shield-zone="'+depot+'"]'),group=bounds('[data-shield-depot="'+depot+'"]');
    const label=bounds('[data-shield-depot="'+depot+'"] .shield-depot-number');
    const slots=Array.from(svg.querySelectorAll('[data-shield-depot="'+depot+'"] [data-shield-slot]'),el=>({box:el.querySelector('.shield-outline')!.getBoundingClientRect(),empty:el.getAttribute('data-empty')==='true'}));
    return {x:center(zone).x,y:center(zone).y,width:zone.width,height:zone.height,marginLeft:zone.left-left.right,marginRight:right.left-zone.right,
     centered:Math.abs(center(zone).x-center(boardBounds).x)<.1,
     labelCentered:Math.abs(center(label).x-center(zone).x)<.1,
     panelsFit:Math.abs(left.width-right.width)<.1&&within(bounds('[data-'+leftContent+']'),left)&&within(bounds('[data-'+rightContent+']'),right),
     groupFits:within(group,zone),slotSizes:slots.filter(s=>!s.empty).map(s=>[s.box.width/unit,s.box.height/unit]),
     centers:slots.map(s=>(center(s.box).x-center(zone).x)/unit),sameHeight:slots.every(s=>Math.abs(center(s.box).y-center(zone).y)<2*unit)};
   });
   const sideClear=[3,5,6].every(depot=>{
    const zone=svg.querySelector<SVGGeometryElement>('[data-shield-zone="'+depot+'"]')!;
    const inverse=zone.getScreenCTM()!.inverse(),b=zone.getBoundingClientRect();
    const poses=Array.from(svg.querySelectorAll('[data-shield-depot="'+depot+'"] [data-shield-slot] .shield-outline, [data-shield-depot="'+depot+'"] [data-shield-cost]'),el=>el.getBoundingClientRect());
    if(poses.some(p=>!within(p,b)))return false;
    return Array.from(svg.querySelectorAll('[data-depot="'+depot+'"] [data-supply-hit],[data-depot="'+depot+'"] [data-numbered-empty]')).every(tile=>{
     const hit=tile.getBoundingClientRect();
     for(let y=Math.max(hit.top,b.top);y<Math.min(hit.bottom,b.bottom);y+=unit)
      for(let x=Math.max(hit.left,b.left);x<Math.min(hit.right,b.right);x+=unit)
       if(zone.isPointInFill(new DOMPoint(x,y).matrixTransform(inverse)))return false;
     return poses.every(p=>p.right<=hit.left||p.left>=hit.right||p.bottom<=hit.top||p.top>=hit.bottom);
    });
   });
   return {zones,sideClear,mirrorError:Math.abs(zones[0].y+zones[1].y-center(boardBounds).y*2)};
  });
  expect(out.mirrorError).toBeLessThan(.1);
  expect(Math.abs(out.zones[0].x-out.zones[1].x)).toBeLessThan(.1);
  expect(Math.abs(out.zones[0].width-out.zones[1].width)).toBeLessThan(.1);
  expect(Math.abs(out.zones[0].height-out.zones[1].height)).toBeLessThan(.1);
  expect(out.sideClear).toBe(true);
  for(const zone of out.zones){
   expect(zone.marginLeft).toBeGreaterThan(0);
   expect(Math.abs(zone.marginRight-zone.marginLeft)).toBeLessThan(.1);
   expect(zone.centered&&zone.labelCentered&&zone.panelsFit&&zone.groupFits&&zone.sameHeight).toBe(true);
   for(const [width,height] of zone.slotSizes){expect(width).toBeCloseTo(52,2);expect(height).toBeCloseTo(52*1480/1200,2);}
   const expected=zone.centers.length===2?[-35,35]:[0];
   expect(zone.centers).toHaveLength(expected.length);
   for(const [i,x] of zone.centers.entries())expect(x).toBeCloseTo(expected[i],2);
  }
 };

 for(const source of expanded===initial?[initial]:[initial,expanded]){
  const [first,second]=source.dice.players['seat-1'];
  const playerName='가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나';
  const game:GameState={...source,players:count===4?source.players.map(p=>p.id==='seat-1'?{...p,name:playerName}:p):source.players,
   dice:{...source.dice,players:{...source.dice.players,'seat-1':[{...first,value:1},{...second,value:1}]}}};
  await load(page,game);
  if(count===4)await expect(board.locator('[data-region-score-panel] .score-page-total')).toHaveAttribute('aria-label',playerName+' · 현재 누적 0점');
  await verify();
  if(source!==expanded)continue;
  await press(page.getByRole('button',{name:'공용 점수판 다음 페이지',exact:true}));
  await expect(board.locator('[data-score-page="2"]')).toBeAttached();
  await press(page.getByRole('button',{name:/^행동 주사위 1 눈/}));
  await expect(board.locator('[data-shield-depot="4"] [data-worker-cost="6"]')).toHaveCount(2);
  await verify();
  for(let i=0;i<3;i++){
   await press(page.getByRole('button',{name:'공용 보드 확대',exact:true}));
   await verify();
  }
  await press(page.getByRole('button',{name:'공용 보드 배율 복원',exact:true}));
  const topPosition=await slot(1).getAttribute('transform');
  await press(slot(1));
  const castle=page.locator(active()+' [data-estate-cell="'+game.players[0].duchy.startingCastleCellId+'"]');
  await expect(castle).toHaveClass(/direct-legal/);
  await press(castle);
  await expect(slot(1)).toHaveAttribute('data-empty','true');
  await expect(slot(1)).toHaveAttribute('transform',topPosition!);
  await verify();
  const lowerNumber=shieldLayout(game)!.slots.find(s=>s.depot===4&&s.index===0)!.shieldNumber!;
  const lowerPosition=await slot(4).getAttribute('transform');
  await load(page,customMount(game,lowerNumber));
  await expect(slot(4)).toHaveAttribute('data-empty','true');
  await expect(slot(4)).toHaveAttribute('transform',lowerPosition!);
  await verify();
  if(info.project.name==='desktop-1280'&&count===3){
   await page.mouse.move(1,1);
   await expect(page.locator('#tile-effect-tooltip')).toHaveCount(0);
   await expect(page.locator('.direct-toast')).toHaveCount(0);
   await board.screenshot({path:info.outputPath('symmetric-shield-depots.png')});
  }
 }
});
test('shield 20 reserves a board tile and 21 purchases a chosen rival tile',async({page},info)=>{
 let game=customMount(customMount(customGame(),20),21);
 const rival=moveTile(game,t=>t.type==='mine',undefined,1);game=rival.game;
 const tile=game.market.blackDepot.find(Boolean)!;
 await load(page,game);
 await press(page.getByRole('button',{name:'방패 20번 · 공용 타일 찜',exact:true}));
 const mark=page.locator(`.common-board-panel [data-tile-id="${tile}"]`);
 await press(mark);await expect(mark.locator('[data-reserved-by="seat-1"]')).toHaveCount(1);
 if(info.project.name==='desktop-1280')await mark.screenshot({path:info.outputPath('reserved-tile.png')});
 await press(page.getByText('방패 21번 · 상대 저장고 구매',{exact:true}));
 await press(page.getByRole('button',{name:/왕실B의 광산 선택/}));
 await press(page.getByRole('button',{name:'구매 확정',exact:true}));
 await expect.poll(async()=>(await current(page)).players[0].storage).toContain(rival.tileId);
 expect((await current(page)).players[1].silver).toBe(game.players[1].silver);
});

test('three action dice, six goods stacks and four storage keys render together',async({page},info)=>{
 let game=customMount(customMount(customGame(),22),23);
 const p=game.players[0],cellId=p.duchy.cells.find(c=>c.terrain==='monastery')!.id;
 game=settleShieldState(moveTile(game,t=>t.type==='monastery'&&t.number===32,cellId).game);
 game={...game,players:game.players.map((p,i)=>i?p:{...p,goods:([1,2,3,4,5,6] as const).map(type=>({type,tiles:[{id:'browser-goods:'+type,type}]}))}),
  dice:{...game.dice,players:{...game.dice.players,[p.id]:[game.dice.players[p.id][0],game.dice.players[p.id][1],{id:p.id+':c',value:4,used:false}]}}};
 await load(page,game);
 const estate=page.locator(active());
 await expect(estate.locator('.estate-dice button')).toHaveCount(3);
 await expect(estate.locator('.goods-storage-slot')).toHaveCount(6);
 await expect(estate.locator('.estate-keyspaces button')).toHaveCount(4);
 if(info.project.name==='desktop-1280')await estate.screenshot({path:info.outputPath('expanded-player-inventory.png')});
});

test('both online seats see only committed province changes and Undo restores the same region',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});
 const other=await peer.newPage();
 try{
  const req=(body:object)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const owner=await (await fetch(server.url+'/api/rooms',req({name:'왕실A'}))).json();
  const guest=await (await fetch(`${server.url}/api/rooms/${owner.id}/join`,req({name:'왕실B'}))).json();
  const {game,a,target,region}=officialTerritory(),path=join(server.directory,owner.id+'.json');
  const room=JSON.parse(await readFile(path,'utf8'));room.game=game;room.logs=[];room.history=beginHistory(game,[],true);await writeFile(path,JSON.stringify(room));
  for(const context of [page.context(),peer]){
   await context.route('**/api/rooms{,/**}',async route=>{
    const q=route.request();const r=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});
    await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
   });
   await context.routeWebSocket('**/api/rooms/*/live',()=>{});
  }
  for(const [p,seat] of [[page,owner],[other,{id:owner.id,token:guest.token}]] as const){
   await p.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),seat);
   await p.goto('/online');
   await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
  }
  expect(directActions(game,'seat-1').some(x=>boardTarget(game,x).recolor?.refund===13)).toBe(true);
  await press(page.getByText('수도원 31번 · 빈 영지 칸 색상 변경',{exact:true}));
  await page.getByLabel('변경할 빈 영지 칸',{exact:true}).selectOption(target.id);
  await page.getByLabel('새 영지 색상',{exact:true}).selectOption(region.terrain);
  await expect(page.getByText(/13점 반납/)).toBeVisible();
  expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(game);
  await press(page.getByRole('button',{name:'색상 변경 확정',exact:true}));
  const expected=step(game,a);
  await expect(other.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(expected.revision));
  expect(JSON.parse(await readFile(path,'utf8')).game).toEqual(expected);
  await page.reload();
  await press(page.getByRole('button',{name:'이전 행동으로',exact:true}));
  await expect.poll(async()=>JSON.parse(await readFile(path,'utf8')).game.players[0].duchy).toEqual(game.players[0].duchy);
  await expect(other.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(expected.revision+1));
 }finally{
  try{await Promise.all([page.goto('about:blank'),other.goto('about:blank')]);await peer.close();}
  finally{await server.close();}
 }
});
