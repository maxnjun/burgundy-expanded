import {test,expect,type Page} from '@playwright/test';
import {createPracticeSession} from '../../src/game/practice';
import {serializeSavedGame} from '../../src/game/save';
const key='burgundy-expanded:local-v1';
const saved=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
async function load(page:Page,count=2,ai=false){
 const g=createPracticeSession({names:['제어A','제어B','제어C','제어D'].slice(0,count),seed:'turn-control',officialSlots:true,shieldRules:true,vineyards:true,inns:true,tradeRoutes:true,whiteCastles:true,fullEffects:true,boardIds:Array(count).fill('se:base:2')});
 const game={...g,players:g.players.map(p=>({...p,silver:30,workers:30}))};
 await page.addInitScript(v=>{if(!localStorage.getItem('burgundy-expanded:local-v1'))localStorage.setItem('burgundy-expanded:local-v1',v)},serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{},computerPlayerIds:ai?['seat-2']:[],computerPaused:ai}}));
 await page.goto('/');await expect(page.getByRole('button',{name:/^행동 주사위 1 눈/})).toBeEnabled();
 await expect.poll(async()=>(await saved(page)).game.turn.stage).toBe('player-turn');
}
async function workers(page:Page,index=1){await page.getByRole('button',{name:new RegExp(`^행동 주사위 ${index} 눈`)}).click();await page.getByRole('button',{name:'일꾼 자원',exact:true}).click();}
for(const count of [2,3,4])test(`turn controls ${count}p red order, snapshots, cancel, branch and turn boundary`,async({page},info)=>{
 await load(page,count,true);const controls=page.getByLabel('차례 제어',{exact:true}),undo=controls.getByRole('button',{name:'되돌리기',exact:true}),step=controls.getByRole('button',{name:'이전 행동으로',exact:true}),end=controls.getByRole('button',{name:'턴 종료',exact:true});
 await expect(controls.locator('button')).toHaveText(['되돌리기','이전 행동으로','턴 종료']);await expect(undo).toBeDisabled();await expect(step).toBeDisabled();await expect(end).toBeDisabled();
 const baseline=(await saved(page)).game;
 await expect(page.getByRole('button',{name:'저장 파일 내보내기',exact:true})).toHaveCount(0);await expect(page.getByText('장착한 방패 없음',{exact:true})).toHaveCount(0);await expect(page.getByText('방패 확장 · 능력 적용 중',{exact:true})).toHaveCount(0);
 await workers(page);await expect(step).toBeEnabled();await expect(undo).toBeEnabled();const one=(await saved(page)).game;
 await expect(undo).toHaveCSS('background-color','rgb(168, 50, 50)');await undo.hover();await expect(undo).toHaveCSS('background-color','rgb(191, 67, 67)');
 await page.locator('[data-black-depot] .supply-art-tile[aria-disabled=false]').first().click();await expect.poll(async()=>(await saved(page)).game.players[0].silver).toBe(28);
 await step.click();await expect.poll(async()=>(await saved(page)).game).toEqual(one);await step.click();await expect.poll(async()=>(await saved(page)).game).toEqual(baseline);
 await workers(page);const beforeCancel=(await saved(page)).game;page.once('dialog',d=>d.dismiss());await undo.click();expect((await saved(page)).game).toEqual(beforeCancel);page.once('dialog',async d=>{expect(d.message()).toBe('이번 차례의 모든 행동을 취소할까요?');await d.accept();});await undo.click();await expect.poll(async()=>(await saved(page)).game).toEqual(baseline);
 await workers(page);await step.click();await page.getByRole('button',{name:/^행동 주사위 2 눈/}).click();await page.getByRole('button',{name:'일꾼 자원',exact:true}).click();await expect.poll(async()=>(await saved(page)).game.dice.players['seat-1'][1].used).toBe(true);await step.click();await expect.poll(async()=>(await saved(page)).game).toEqual(baseline);
 if(info.project.name==='desktop-1280'){
  for(const width of [1280,800,640]){await page.setViewportSize({width,height:900});expect(await controls.evaluate(el=>{const b=[...el.querySelectorAll('button')].map(e=>e.getBoundingClientRect());return b.every((r,i)=>r.width>0&&(!i||r.left>=b[i-1].right));})).toBe(true);}
  await page.setViewportSize({width:1280,height:900});await page.locator('.direct-toolbar').screenshot({path:`.local-data/turn-controls/${count}p-buttons.png`});await page.screenshot({path:`.local-data/turn-controls/${count}p-game-screen.png`});
 }
 await workers(page);await workers(page,2);await expect(end).toBeEnabled();await end.click();await expect.poll(async()=>(await saved(page)).game.turn.activePlayerId).toBe('seat-2');await expect(undo).toBeDisabled();await expect(step).toBeDisabled();
});
test('settings save export/import and reload reset undo without changing saved game format',async({page})=>{
 await load(page);await workers(page);const checkpoint=await saved(page);await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();const settings=page.locator('.settings-panel');await expect(settings.getByRole('button',{name:'저장 파일 내보내기',exact:true})).toBeVisible();const download=page.waitForEvent('download');await settings.getByRole('button',{name:'저장 파일 내보내기',exact:true}).click();expect((await download).suggestedFilename()).toBe('burgundy-save.json');await settings.screenshot({path:'.local-data/turn-controls/settings-save.png'});
 await page.getByLabel('저장 파일 불러오기',{exact:true}).setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(checkpoint))});await expect(page.locator('.settings-panel')).toHaveCount(0);await expect.poll(async()=>(await saved(page)).game).toEqual(checkpoint.game);await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'이전 행동으로',exact:true})).toBeDisabled();
 const g=(await saved(page)).game;await workers(page,2);await expect(page.getByRole('button',{name:'이전 행동으로',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'되돌리기',exact:true})).toBeDisabled();await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();await expect.poll(async()=>(await saved(page)).game).toEqual(g);await page.reload();await expect(page.getByRole('button',{name:'이전 행동으로',exact:true})).toBeDisabled();
});
