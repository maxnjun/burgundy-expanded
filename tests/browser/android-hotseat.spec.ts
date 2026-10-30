import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createPracticeSession} from '../../src/game/practice';
import {applyCoreAction} from '../../src/game/core';
import {directActions} from '../../src/game/direct-actions';
import {vineFixture} from '../fixtures/vineyards';
import {vineyardSave} from '../fixtures/android-vineyard';
import {PLAYER_PALETTE} from '../../src/game/player-colors';
import type {GameState} from '../../src/game/types';

const nativeCss=readFileSync('mobile/native.css','utf8');
test.beforeEach(async({page})=>{page.setDefaultTimeout(20_000);});
async function android(page:Page){
 await page.addInitScript(()=>{
  document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.nativeApp='android';document.documentElement.dataset.vineyardLayout=localStorage.getItem('burgundy-expanded:vineyard-layout-v1')??'right';window.dispatchEvent(new Event('burgundy-native-ready'));});
  window.addEventListener('burgundy-vineyard-layout',()=>{document.documentElement.dataset.vineyardLayout=localStorage.getItem('burgundy-expanded:vineyard-layout-v1')??'right';});
  localStorage.setItem('burgundy-expanded:pinned-guidance-v1','off');
 });
 await page.goto('/');await style(page);
}
async function style(page:Page){const s=await page.addStyleTag({content:nativeCss});await s.evaluate(e=>document.head.prepend(e));}
async function state(page:Page):Promise<GameState>{return page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);}
async function load(page:Page,g:GameState){
 const s=JSON.parse(vineyardSave(g));s.view.hotseat=true;
 const setup=page.getByRole('button',{name:'⚙ 게임 준비',exact:true});await setup.click();
 await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'hotseat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await expect(setup).toHaveAttribute('aria-expanded','false');
}
for(const count of [2,3,4])test(`Android hotseat ${count} identities, active board, manual turns, Undo and restore`,async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Android landscape simulation');await page.setViewportSize({width:866,height:364});await android(page);
 await page.getByRole('button',{name:'핫시트 — 한 기기에서 2~4인',exact:true}).click();await page.getByLabel('플레이어 수',{exact:true}).selectOption(String(count));
 const colors=['purple','pink','green','yellow'];
 for(let i=0;i<count;i++){await page.getByLabel(`좌석 ${i+1} 이름`,{exact:true}).fill(`핫시트${i+1}`);await page.getByLabel(`좌석 ${i+1} 색상`,{exact:true}).selectOption(colors[i]);}
 await expect(page.getByLabel('좌석 2 색상',{exact:true}).locator('option[value="purple"]')).toHaveAttribute('disabled','');
 await page.getByLabel('포도밭 확장',{exact:true}).check();await page.getByRole('button',{name:'핫시트 게임 시작',exact:true}).click();
 await expect(page.locator('main')).toHaveAttribute('data-hotseat','true');
 for(let i=0;i<count;i++){
  const id=`seat-${i+1}`;await expect(page.locator('main')).toHaveAttribute('data-active-player',id);
  await expect(page.locator('.estate-panel')).toHaveCount(count);await expect(page.locator('.estate-panel').first()).toHaveAttribute('data-player-id',id);
  await page.locator('[data-can-start="true"]').first().click();await page.getByRole('button',{name:'확정 및 턴 종료',exact:true}).click();
 }
 await expect.poll(async()=>(await state(page)).turn.stage).toBe('player-turn');
 for(let i=0;i<count;i++){
  const before=await state(page),id=before.turn.activePlayerId!,name=before.players.find(p=>p.id===id)!.name;
  await expect(page.getByLabel('현재 핫시트 플레이어')).toContainText(name);await expect(page.locator('.estate-panel').first()).toHaveAttribute('data-player-id',id);
  const color=before.players.find(p=>p.id===id)!.color!;expect(await page.locator('.hotseat-turn>span').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(hex(PLAYER_PALETTE[color].fill));
  await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await page.getByRole('button',{name:`${name} 일꾼 자원`,exact:true}).click();
  await expect.poll(async()=>(await state(page)).dice.players[id][0].used).toBe(true);
  await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(()=>state(page)).toEqual(before);
  for(const n of [1,2]){await page.getByRole('button',{name:new RegExp(`^행동 주사위 ${n} 눈`)}).click();await page.getByRole('button',{name:`${name} 일꾼 자원`,exact:true}).click();}
  await expect(page.locator('main')).toHaveAttribute('data-active-player',id);await expect(page.getByRole('button',{name:'턴 종료',exact:true})).toBeEnabled();
  const game=await state(page);await expect(page.locator('.estate-panel[data-readonly="true"]')).toHaveCount(count-1);for(const control of await page.locator('.estate-panel[data-readonly="true"] .estate-resources button').all())await expect(control).toBeDisabled();
  await page.reload();await style(page);await expect(page.locator('main')).toHaveAttribute('data-hotseat','true');await expect(page.locator('.estate-panel')).toHaveCount(count);await expect(page.locator('.estate-panel').first()).toHaveAttribute('data-player-id',id);
  const setup=page.getByRole('button',{name:'⚙ 게임 준비',exact:true});await setup.click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'저장 파일 내보내기',exact:true}).click();
  const file=await download,path=await file.path();expect(path).toBeTruthy();const saved=JSON.parse(readFileSync(path!,'utf8'));expect(saved.view.hotseat).toBe(true);expect(saved.undo).toBeTruthy();
  await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles(path!);await expect(setup).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'턴 종료',exact:true}).click();await expect.poll(async()=>{const s=await state(page);return s.turn.activePlayerId!==id||s.turn.round!==game.turn.round;}).toBe(true);
 }
 await page.screenshot({path:info.outputPath(`hotseat-${count}-turn.png`)});
});
function hex(s:string){return `rgb(${s.slice(1).match(/../g)!.map(v=>parseInt(v,16)).join(', ')})`;}
test('Android position changes live without consuming selection; zooms and designs keep both layouts',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Android landscape simulation');await page.setViewportSize({width:866,height:364});await android(page);const initial=vineFixture();await load(page,initial);
 const setup=page.getByRole('button',{name:'⚙ 게임 준비',exact:true});await setup.click();await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();await setup.click();
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 const row=page.locator('.common-vineyard-row');
 for(const position of ['right','below']){
  if(await page.getByRole('button',{name:/^행동 주사위 1 눈/}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
  await setup.click();await page.getByLabel('포도밭 공급처 위치',{exact:true}).selectOption(position);await setup.click();
  await expect(row).toHaveCSS('flex-direction',position==='right'?'row':'column');await expect(page.getByRole('button',{name:/^행동 주사위 1 눈/})).toHaveAttribute('aria-pressed','true');expect(await state(page)).toEqual(initial);
  for(const design of [false,true])for(const zoom of [.75,1,1.6,2]){
   await page.evaluate(({design,zoom})=>{localStorage.setItem('burgundy-expanded:design-1-v1',design?'on':'off');const s=JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!);s.view.commonZoom=zoom;localStorage.setItem('burgundy-expanded:local-v1',JSON.stringify(s));},{design,zoom});
   await page.reload();await style(page);await expect(row).toHaveCSS('flex-direction',position==='right'?'row':'column');
   const rect=await row.evaluate(e=>{const a=e.children[0].getBoundingClientRect(),b=e.children[1].getBoundingClientRect();return {gapX:b.left-a.right,gapY:b.top-a.bottom,width:b.width,scroll:e.scrollWidth-e.clientWidth};});
   expect(rect.width).toBeGreaterThan(300);expect(position==='right'?rect.gapX:rect.gapY).toBeGreaterThan(0);if(position==='right')expect(rect.scroll).toBeGreaterThan(100);
  }
  await row.locator(position==='right'?'.vineyard-supply':'.common-board-panel').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`hotseat-layout-${position}.png`)});
 }
 const take=directActions(initial,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='vineyard'&&a.intent.command==='take')!;if(take.type!=='use-die'||take.intent.kind!=='vineyard')throw Error('fixture');
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await page.locator(`.vineyard-supply [data-vine-tile="${take.intent.tileId}"]`).first().click();
 const expected=applyCoreAction(initial,take);expect(expected.ok).toBe(true);if(expected.ok)await expect.poll(()=>state(page)).toEqual(expected.value.state);
});
test('web keeps its existing mode menu and ignores Android position preference',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280');await page.goto('/');await expect(page.getByRole('button',{name:'핫시트 — 한 기기에서 2~4인',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();await expect(page.getByLabel('포도밭 공급처 위치',{exact:true})).toHaveCount(0);await expect(page.getByLabel('플레이 방식',{exact:true}).locator('option[value="computer"]')).toHaveCount(1);
 const g=createPracticeSession({names:['a','b'],seed:'hotseat-web',fullEffects:true});expect(g.config.mode).toBe('competitive');
});
test('Android keyboard height leaves the hotseat start button reachable',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280');await page.setViewportSize({width:866,height:364});await android(page);await load(page,vineFixture());
 await page.getByRole('button',{name:'핫시트 — 한 기기에서 2~4인',exact:true}).click();await page.setViewportSize({width:866,height:127});
 await expect(page.locator('.intro')).toHaveCSS('position','static');const start=page.getByRole('button',{name:'핫시트 게임 시작',exact:true});
 await start.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));expect(await start.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await start.click();await expect(page.getByRole('button',{name:'⚙ 게임 준비',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.locator('main')).toHaveAttribute('data-hotseat','true');await expect.poll(async()=>(await state(page)).status).toBe('setup');
});
