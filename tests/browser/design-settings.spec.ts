import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {vineFixture} from '../fixtures/vineyards';
import {serializeSavedGame} from '../../src/game/save';
import {beginHistory} from '../../src/game/turn-history';
import {isolatedRooms} from './isolated-rooms';

const key='burgundy-expanded:design-1-v1';
const themeKey='burgundy-expanded:estate-theme-v1';
const themeName=(number:number)=>new RegExp(`^디자인 ${number} —`);
const current=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).game);
test('online entry menu visibly contains Design 1 OFF and ON before joining a room',async({page},info)=>{
 await page.goto('/online');const menu=page.locator('.online-game-settings'),options=menu.locator('.online-settings-options');
 await menu.locator('summary').click();const toggle=menu.getByRole('switch',{name:'디자인 1',exact:true}),guidance=menu.getByRole('checkbox',{name:'상단 턴 안내 따라오기',exact:true});
 await expect(toggle).toBeVisible();await expect(toggle).not.toBeChecked();await expect(guidance).toBeChecked();
 for(const enabled of [false,true]){
  await toggle.setChecked(enabled);await expect(page.locator('html')).toHaveAttribute('data-design-1',enabled?'on':'off');
  await expect(toggle).toHaveCount(1);await expect(guidance).toBeChecked();
  const bounds=(await options.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await options.screenshot({path:info.outputPath(`settings-${enabled?'on':'off'}.png`)});
  await page.screenshot({path:info.outputPath(`settings-${enabled?'on':'off'}-viewport.png`)});
 }
 await guidance.uncheck();await page.reload();await menu.locator('summary').click();await expect(toggle).toBeVisible();await expect(toggle).toBeChecked();await expect(guidance).not.toBeChecked();
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('on');
});
async function install(page:Page,game=vineFixture()){
 const saved=serializeSavedGame({format:'burgundy-local-v1',randomAlgorithm:'counter-v1',game,logs:[],view:{zoom:1,focus:false,table:true,boardZooms:{}}});
 await page.addInitScript(s=>{if(!sessionStorage.getItem('design-installed')){localStorage.setItem('burgundy-expanded:local-v1',s);sessionStorage.setItem('design-installed','1');}},saved);
 await page.goto('/');await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));return game;
}
async function select(page:Page,on:boolean,online=false){
 if(online){const settings=page.locator('.online-game-settings');if(!await settings.evaluate(e=>(e as HTMLDetailsElement).open))await settings.locator('summary').click();}
 else await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await page.getByRole('switch',{name:'디자인 1',exact:true}).setChecked(on);
 if(online)await page.locator('.online-game-settings summary').click();else await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-design-1',on?'on':'off');
}
async function selectEstate(page:Page,number:number,online=false){
 const menu=online?page.locator('.online-game-settings summary'):page.getByRole('button',{name:'⚙ 게임 준비',exact:true});
 await menu.click();
 await page.getByRole('radio',{name:themeName(number)}).check();
 await menu.click();
 await expect(page.locator('html')).toHaveAttribute('data-estate-theme',`estate-theme-${number}`);
}

test('four estate designs preserve the same game, coordinates and public board',async({page},info)=>{
 const game=await install(page,vineFixture(true));
 const estate=page.locator('.estate-panel').first();
 const selection=page.getByRole('button',{name:/^행동 주사위 1 눈/});
 const snapshot=()=>estate.evaluate(board=>Array.from(board.querySelectorAll('[data-estate-fill],[data-estate-grid],[data-estate-tile]'),cell=>{
  const rect=cell.getBoundingClientRect();
  const parent=board.getBoundingClientRect();
  return {
   shape:[cell.getAttribute('points'),cell.getAttribute('d'),cell.getAttribute('fill'),cell.getAttribute('data-estate-tile')],
   pixels:[rect.x-parent.x,rect.y-parent.y,rect.width,rect.height],
  };
 }));
 const common=()=>page.locator('.common-board-panel').evaluate(board=>{
  const style=getComputedStyle(board);
  return [style.background,style.borderImage,board.getBoundingClientRect().width];
 });
 await select(page,true);
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await page.getByLabel('합법 행동 및 안내 문구 상단 고정',{exact:true}).uncheck();
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await selection.click();
 const publicStyle=await common(),backgrounds=new Set<string>();
 const setZoom=async(percent:number)=>{
  await page.getByRole('slider',{name:'전체 배율'}).evaluate((input,value)=>{
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(value));
   input.dispatchEvent(new Event('input',{bubbles:true}));
  },percent);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('burgundy-expanded:local-v1')!).view.zoom)).toBe(percent/100);
 };
 const vineyardLayout=()=>estate.evaluate(board=>{
  const rect=board.querySelector('.estate-original-board')!.getBoundingClientRect();
  const vineyard=board.querySelector('.vineyard-personal')!.getBoundingClientRect();
  return [rect.width,rect.height,vineyard.width,vineyard.height,vineyard.left-rect.right,vineyard.top-rect.top];
 });
 const expectPixels=(actual:number[],baseline:number[])=>actual.forEach((value,index)=>expect(value).toBeCloseTo(baseline[index],2));
 const expectSameGrid=(actual:Awaited<ReturnType<typeof snapshot>>,baseline:Awaited<ReturnType<typeof snapshot>>)=>{
  expect(actual.map(cell=>cell.shape)).toEqual(baseline.map(cell=>cell.shape));
  actual.forEach((cell,index)=>expectPixels(cell.pixels,baseline[index].pixels));
 };
 const layouts=new Map<number,{grid:Awaited<ReturnType<typeof snapshot>>;boards:number[]}>();
 const geometry=await snapshot();
 for(const number of [1,2,3,4]){
  await selectEstate(page,number);
  expect(await common()).toEqual(publicStyle);
  expect(await current(page)).toEqual(game);
  await expect(selection).toHaveAttribute('aria-pressed','true');
  await expect(estate.locator('.vineyard-personal')).toBeVisible();
  await expect(estate.locator('.trade-route-panel')).toBeVisible();
  backgrounds.add(await estate.evaluate(board=>getComputedStyle(board).backgroundImage));
  const decoration=estate.locator('[data-estate-decoration]');
  await expect(decoration).toHaveCount(number===1?0:1);
  if(number!==1){
   await expect(estate.locator('.estate-original-board .live-board-scroll')).toHaveCSS('background-image','none');
   await expect(estate.locator('.estate-heading')).not.toHaveCSS('background-image',/url\(/);
   await expect(decoration).toHaveCSS('pointer-events','none');
   await decoration.locator('image').evaluateAll(async images=>Promise.all(images.map(async source=>{
    const image=new Image();
    image.src=source.getAttribute('href')!;
    await image.decode();
   })));
  }
  for(const zoom of [100,75,150]){
   await setZoom(zoom);
   const state={grid:await snapshot(),boards:await vineyardLayout()};
   expect(state.boards[4]).toBeGreaterThan(0);
   if(number===1)layouts.set(zoom,state);
   else {
    const baseline=layouts.get(zoom)!;
    expectSameGrid(state.grid,baseline.grid);
    expectPixels(state.boards,baseline.boards);
   }
   expect(await decoration.evaluateAll(groups=>groups.every(group=>{
    const svg=group.closest('svg')!;
    const bounds=svg.getBoundingClientRect();
    const cells=Array.from(svg.querySelectorAll('[data-estate-fill]'),cell=>cell.getBoundingClientRect());
    return Array.from(group.querySelectorAll('[data-estate-ornament]')).every(ornament=>{
     const box=ornament.getBoundingClientRect();
     return box.width>0&&box.height>0&&box.left>bounds.left&&box.right<bounds.right&&box.top>bounds.top&&box.bottom<bounds.bottom
       &&cells.every(cell=>box.right<=cell.left||box.left>=cell.right||box.bottom<=cell.top||box.top>=cell.bottom);
    });
   }))).toBe(true);
   if(zoom===100||number===4)await estate.screenshot({path:info.outputPath(`estate-design-${number}-${zoom}.png`)});
  }
  await setZoom(100);
 }
 expect(backgrounds.size).toBe(4);
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await expect(page.locator('.estate-theme-preview')).toHaveCount(4);
 await page.locator('.estate-theme-setting').screenshot({path:info.outputPath('estate-design-settings.png')});
 await page.getByRole('button',{name:'⚙ 게임 준비',exact:true}).click();
 await estate.getByRole('button',{name:'포도1 일꾼 자원',exact:true}).click();
 await expect.poll(async()=>(await current(page)).players[0].workers).toBe(game.players[0].workers+2);
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-estate-theme','estate-theme-4');
 expect(await page.evaluate(k=>localStorage.getItem(k),themeKey)).toBe('estate-theme-4');
 expect(await current(page)).toEqual(game);
 await selectEstate(page,1);
 await expect(page.locator('html')).toHaveAttribute('data-design-1','on');
 expectSameGrid(await snapshot(),geometry);
});
const appearance=(page:Page)=>page.evaluate(()=>{
 const estate=document.querySelector('.estate-panel')!,vine=estate.querySelector('.vineyard-personal')!,die=estate.querySelector('[data-estate-cell] [data-white-die]')!,common=document.querySelector('.common-board-panel')!;
 return {terrains:document.querySelectorAll('[data-terrain-surface]').length,vines:document.querySelectorAll('[data-vine-surface]').length,
  background:getComputedStyle(estate).backgroundImage,wood:getComputedStyle(common).borderImageSource,grid:estate.querySelector('[data-estate-grid]')!.getAttribute('stroke'),
  die:die.querySelector('rect')!.getAttribute('fill'),raised:die.getAttribute('data-die-raised'),
  layers:[1,2,3,4].map(l=>getComputedStyle(vine.querySelector(`.vineyard-cell.layer-${l}`)!).fill),
  grain:common.querySelector('[data-common-paper-grain]')!.getAttribute('width')};
});

test('Design 1 defaults OFF, switches all surfaces instantly, persists, restores and leaves game unchanged',async({page},info)=>{
 const game=await install(page);await expect(page.locator('html')).toHaveAttribute('data-design-1','off');
 const original=await appearance(page);expect(original.terrains).toBe(0);expect(original.vines).toBe(0);expect(original.die).toBe('#fffbea');expect(original.raised).toBeNull();expect(original.grid).toBe('#e7dfbc');expect(original.wood).toBe('none');expect(original.grain).toBe('23');
 expect(original.layers).toEqual(['rgb(241, 223, 160)','rgb(212, 220, 176)','rgb(171, 191, 149)','rgb(127, 157, 118)']);
 const estate=page.locator('.estate-panel').first();await estate.screenshot({path:info.outputPath('design-off.png')});
 await select(page,true);const enabled=await appearance(page);expect(enabled.terrains).toBeGreaterThan(0);expect(enabled.vines).toBe(48);expect(enabled.raised).toBe('true');expect(enabled.wood).toContain('wood.webp');expect(enabled.background).toContain('parchment.webp');expect(enabled.grain).toBe('83');
 expect(enabled.layers).toEqual(['rgb(39, 102, 74)','rgb(121, 166, 76)','rgb(193, 201, 154)','rgb(233, 198, 108)']);
 expect(await current(page)).toEqual(game);expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('on');
 await estate.screenshot({path:info.outputPath('design-on.png')});await page.reload();await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));await expect(page.locator('[data-terrain-surface]').first()).toBeVisible();expect(await appearance(page)).toEqual(enabled);expect(await current(page)).toEqual(game);
 await select(page,false);expect(await appearance(page)).toEqual(original);await page.reload();await expect(page.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));await expect(page.locator('html')).toHaveAttribute('data-design-1','off');expect(await appearance(page)).toEqual(original);expect(await current(page)).toEqual(game);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();await select(page,true);
 await expect(page.getByRole('button',{name:/^행동 주사위 1 눈/})).toHaveAttribute('aria-pressed','true');
 await estate.getByRole('button',{name:'포도1 일꾼 자원',exact:true}).click();await expect.poll(async()=>(await current(page)).players[0].workers).toBe(game.players[0].workers+2);
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();expect(await current(page)).toEqual(game);
});

test('theme switches preserve a live vineyard placement preview, real dice and undo',async({page})=>{
 await install(page);await select(page,true);
 await page.getByRole('button',{name:/^행동 주사위 1 눈/}).click();
 await page.locator('.vineyard-supply [data-vine-supply-kind=depot] button').first().click();
 await expect.poll(async()=>(await current(page)).players[0].vineyardReserve.length).toBe(1);
 const taken=await current(page),id=taken.players[0].vineyardReserve[0].tileId;
 await page.getByRole('button',{name:/^행동 주사위 2 눈/}).click();const board=page.locator('.vineyard-personal').first(),slot=board.locator('[data-vine-slot=V01]');
 await board.getByRole('button',{name:`보관 포도 ${id}`,exact:true}).click();await slot.click();await expect(slot).toHaveAttribute('data-vine-preview','true');expect(await current(page)).toEqual(taken);
 await selectEstate(page,2);await expect(slot).toHaveAttribute('data-vine-preview','true');await expect(slot.locator('[data-connected-vine=true]')).toHaveCount(1);expect(await current(page)).toEqual(taken);
 await selectEstate(page,3);await expect(slot).toHaveAttribute('data-vine-preview','true');await board.getByRole('button',{name:'돌려서 배치',exact:true}).click();await board.getByRole('button',{name:'포도 배치 확정',exact:true}).click();
 await expect(slot).toHaveAttribute('data-occupied','true');const placed=await current(page);expect(placed.vineyards.players['seat-1'].placed[0]).toMatchObject({tileId:id,slotId:'V01',flipped:true});expect(placed.dice.players['seat-1'].every((d:{used:boolean})=>d.used)).toBe(true);
 await page.reload();await expect(slot).toHaveAttribute('data-occupied','true');await expect(page.locator('html')).toHaveAttribute('data-design-1','on');
 await expect(page.locator('html')).toHaveAttribute('data-estate-theme','estate-theme-3');
 await page.getByRole('button',{name:'이전 행동으로',exact:true}).click();expect(await current(page)).toEqual(taken);
});

test('online peers independently switch and persist estate designs without a room revision or state change',async({page,browser,baseURL},info)=>{
 const server=await isolatedRooms(),peer=await browser.newContext({...info.project.use,baseURL});
 try{
  const owner=await(await fetch(server.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'디자인A',vineyards:true})})).json();
  const guest=await(await fetch(`${server.url}/api/rooms/${owner.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'디자인B'})})).json();
  const file=join(server.directory,owner.id+'.json'),raw=JSON.parse(await readFile(file,'utf8')),game={...vineFixture(),revision:raw.game.revision+10};raw.game=game;raw.history=beginHistory(game,[],true);raw.logs=[];await writeFile(file,JSON.stringify(raw));
  for(const context of [page.context(),peer])await context.route('**/api/rooms{,/**}',async r=>{const q=r.request(),res=await fetch(server.url+new URL(q.url()).pathname,{method:q.method(),headers:{...q.headers(),host:new URL(server.url).host,origin:server.url},body:q.postData()??undefined});await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});});
  await page.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),owner);await peer.addInitScript(s=>localStorage.setItem('burgundy-online-seat-v1',JSON.stringify(s)),{id:owner.id,token:guest.token});
  const other=await peer.newPage();await page.goto('/online');await other.goto('/online');
  for(const p of [page,other]){await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));await expect(p.locator('html')).toHaveAttribute('data-design-1','off');}
  await select(page,true,true);await expect(page.locator('[data-terrain-surface]').first()).toBeVisible();await expect(other.locator('[data-terrain-surface]')).toHaveCount(0);
  await page.reload();await other.reload();await expect(page.locator('html')).toHaveAttribute('data-design-1','on');await expect(other.locator('html')).toHaveAttribute('data-design-1','off');
  await select(other,true,true);await select(page,false,true);await expect(page.locator('[data-terrain-surface]')).toHaveCount(0);await expect(other.locator('[data-terrain-surface]').first()).toBeVisible();
  await selectEstate(page,2,true);await selectEstate(other,4,true);
  await page.reload();await other.reload();
  await expect(page.locator('html')).toHaveAttribute('data-estate-theme','estate-theme-2');
  await expect(other.locator('html')).toHaveAttribute('data-estate-theme','estate-theme-4');
  await expect(page.locator('.estate-panel [data-estate-ornament="crest"]').first()).toBeVisible();
  await expect(other.locator('.estate-panel [data-estate-ornament="compass"]').first()).toBeVisible();
  for(const p of [page,other])await expect(p.locator('.common-board-panel [data-estate-decoration]')).toHaveCount(0);
  for(const p of [page,other])await expect(p.locator('[data-game-revision]')).toHaveAttribute('data-game-revision',String(game.revision));
  expect(JSON.parse(await readFile(file,'utf8')).game).toEqual(game);
  await other.locator('.online-game-settings summary').click();await other.locator('.online-settings-options').screenshot({path:info.outputPath('online-design-setting.png')});
 }finally{await peer.close();await server.close();}
});
