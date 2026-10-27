import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup,mount,placed,choose,step,roundtrip} from '../fixtures/shields';
import {prepareTileEffect,validPendingChoice,immediateOptions} from '../../src/game/core/effects';
import {applyCoreAction,listCoreActionOptions} from '../../src/game/core/engine';
import {createPracticeSession} from '../../src/game/practice';
import {upgradeShieldFiveChoice,prepareShieldFive} from '../../src/game/core/shield-effects';
import {bonusShieldFixture} from '../fixtures/ver3';
import {directActions,boardTarget,directCost} from '../../src/game/direct-actions';
import {upgradeBonusShieldChoice} from '../../src/game/core/effects';
import {createActionLog,readActionLog} from '../../src/game/action-log';
import {beginHistory,recordTurnAction,undoTurn} from '../../src/game/turn-history';
import {shieldLayout} from '../../src/game/shields';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../../src/server/rooms';

test('Ver3 shield5 only offers existing goods that fit; takes the entire type from actual depots',()=>{
 let g=placed(mount(setup(),5),0,{type:'ship',back:'matching-color'});
 const id=g.players[0].duchy.cells.filter(c=>c.tileId&&g.tiles[c.tileId].type==='ship').at(-1)!.tileId!;
 g={...g,players:g.players.map((p,i)=>i?p:{...p,goods:[{type:1,tiles:[{id:'held1',type:1}]},{type:2,tiles:[{id:'held2',type:2}]},{type:3,tiles:[{id:'held3',type:3}]}]}),market:{...g.market,numberedDepots:g.market.numberedDepots.map(d=>({...d,goods:[{id:`type1:${d.number}`,type:1},{id:`type4:${d.number}`,type:4}]}))}};
 g=prepareTileEffect(g,'seat-1',id);g=choose(g,o=>o.id.startsWith('depot:1:'));
 assert.deepEqual(g.turn.pendingChoice!.options.map(o=>o.id),['shield5:skip','shield5:1']);
 assert.equal(applyCoreAction(g,{type:'resolve-choice',playerId:'seat-1',choiceId:g.turn.pendingChoice!.id,optionId:'shield5:4'}).ok,false);
 const legacy={...g,turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,options:[g.turn.pendingChoice!.options[0],...[1,2,3].map(type=>({id:`shield5:${type}`,label:`방패5 · ${type}번 상품 전 공급처에서 수령`,payload:{goodsType:type}}))]}}};
 assert.ok(validPendingChoice(upgradeShieldFiveChoice(legacy)));assert.deepEqual(roundtrip(legacy),g);
 const other=g.players[1].goods;g=choose(g,o=>o.id==='shield5:1');assert.equal(g.players[0].goods.find(s=>s.type===1)!.tiles.length,7);assert.deepEqual(g.players[1].goods,other);assert.ok(g.market.numberedDepots.every(d=>d.goods.every(x=>x.type===4)));
 const empty=prepareShieldFive(g,'seat-1',id);assert.deepEqual(empty.turn.pendingChoice!.options.map(o=>o.id),['shield5:skip']);assert.match(empty.turn.pendingChoice!.options[0].label,/없음/);assert.equal(choose(empty,o=>o.id==='shield5:skip').turn.pendingChoice,null);
});
test('Ver3 shield6 cannot target the owner, including before any target was chosen',()=>{
 const g=mount(setup(),6),a={type:'extension' as const,extensionId:'shields' as const,command:'choose-monastery-target',playerId:'seat-1',payload:{targetPlayerId:'seat-1'}};
 assert.equal(applyCoreAction(g,a).ok,false);const options=listCoreActionOptions(g,'seat-1');assert.ok(options.ok);assert.ok(!options.value.actions.some(x=>x.type==='extension'&&x.command===a.command&&(x.payload as {targetPlayerId:string}).targetPlayerId==='seat-1'));
 const next=step(g,{...a,payload:{targetPlayerId:'seat-2'}});assert.deepEqual(roundtrip(next),next);
});
test('Ver3 explicit harp-seal OFF overrides additional hexes, ON keeps one black-backed tile',()=>{
 for(const geese of [false,true]){const g=createPracticeSession({names:['A','B'],seed:'ver3-geese',additionalHexes:true,geese,officialSlots:true});assert.equal(Object.values(g.tiles).filter(t=>t.type==='livestock'&&t.species==='geese').length,geese?1:0);assert.equal(g.config.extensions.some(e=>e.id==='geese'),geese);assert.deepEqual(roundtrip(g),g);}
});
for(const kind of ['castle','white-castle','vine'] as const)test(`Ver3 ${kind} reward pairs one unused die, spends exact workers, restores and rejects forged/used dice`,()=>{
 const g=bonusShieldFixture(kind);assert.ok(validPendingChoice(g));assert.deepEqual(roundtrip(g),g);
 const a=directActions(g,'seat-1').find(a=>boardTarget(g,a).shield?.dieId===g.dice.players['seat-1'][1].id)!;assert.ok(a);
 const cost=directCost(g,a),n=step(g,a),target=boardTarget(g,a).shield!;
 assert.equal(n.dice.players['seat-1'][0].value,2);assert.equal(n.dice.players['seat-1'][1].used,true);assert.equal(n.players[0].workers,g.players[0].workers-cost);assert.equal(n.dice.whiteDie,3);assert.equal(shieldLayout(n)!.mounted.at(-1)!.cellId,target.castleCellId);
 assert.equal(n.random.cursor,g.random.cursor);assert.deepEqual(roundtrip(n),n);assert.equal(applyCoreAction(n,a).ok,false);
 const payload=JSON.parse(a.type==='resolve-choice'?a.optionId.slice('bonus-shield:'.length):'{}');payload.dieId=g.dice.players['seat-1'][0].id;
 assert.equal(applyCoreAction(g,{...a,optionId:'bonus-shield:'+JSON.stringify(payload)} as typeof a).ok,false);
 const start=beginHistory(g,[],true),history=recordTurnAction(kind==='castle'?start:{...start,past:[{game:g,logs:[]}]},g,n,a,[],[]),restored=undoTurn(history,n,'action');assert.equal(history.past.length,1);assert.deepEqual(restored!.snapshot.game,g);
 const legacy={...g,turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,options:g.turn.pendingChoice!.options.filter(o=>!o.id.startsWith('bonus-shield:'))}}};assert.deepEqual(upgradeBonusShieldChoice(legacy),g);assert.deepEqual(roundtrip(legacy),g);
 const malformed={...legacy,turn:{...legacy.turn,pendingChoice:{...legacy.turn.pendingChoice,options:legacy.turn.pendingChoice.options.slice(1)}}};assert.equal(upgradeBonusShieldChoice(malformed),malformed);assert.throws(()=>roundtrip(malformed));
 const log=readActionLog(createActionLog(g,n,a));assert.equal(log.dice.length,2);assert.equal(log.dice[0].source,kind==='white-castle'?'white':'bonus');assert.equal(log.dice[1].source,'player');assert.equal(log.dice[0].value,log.dice[1].value);
});
test('Ver3 acquired and placed tiles lead structured logs with colored real dice and old text stays readable',()=>{
 const g=setup(),a=directActions(g,'seat-1').find(a=>a.type==='use-die'&&a.intent.kind==='take-tile')!;assert.ok(a);const n=step(g,a),log=readActionLog(createActionLog(g,n,a));assert.equal(log.tileId,a.type==='use-die'&&a.intent.kind==='take-tile'?a.intent.tileId:'');assert.equal(log.dice[0].color,'blue');assert.equal(log.dice[0].source,'player');assert.equal(readActionLog('이전 기록').text,'이전 기록');assert.deepEqual(readActionLog(JSON.stringify({format:'action-log-v1',text:'이전',dice:[{index:1,value:4}]})).dice,[{index:1,value:4}]);
});
test('Ver3 online bonus shield survives restart, peer sync, duplicate and other-seat denial, then Undo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'burgundy-ver3-')),store=new RoomStore(dir),owner=await store.create('A',true),peer=await store.joinRoom(owner.id,'B');const file=join(dir,owner.id+'.json'),room=JSON.parse(await readFile(file,'utf8')),g=bonusShieldFixture();room.game=g;room.history=beginHistory(g,[],true);room.logs=[];await writeFile(file,JSON.stringify(room));
 let v=await store.view(owner.id,owner.token);const a=v.actions.find(a=>a.target.shield?.dieId)!.action;await assert.rejects(()=>store.act(owner.id,peer.token,v.revision,a));const rev=v.revision;v=await store.act(owner.id,owner.token,rev,a,'ver3-request-unique-123');const restarted=new RoomStore(dir);assert.deepEqual((await restarted.view(owner.id,peer.token)).shields,v.shields);assert.deepEqual((await restarted.act(owner.id,owner.token,rev,a,'ver3-request-unique-123')).dice,v.dice);await assert.rejects(()=>restarted.act(owner.id,owner.token,rev,a));v=await restarted.act(owner.id,owner.token,v.revision,{type:'undo-action',playerId:'seat-1'});assert.deepEqual(v.dice,g.dice);assert.deepEqual(v.shields!.mounted,shieldLayout(g)!.mounted);assert.equal(v.logs.length,0);
});
test('Ver3 no unused die or insufficient workers offers no pair, while shield11 remains a no-die reward',()=>{
 const g=bonusShieldFixture();const used={...g,dice:{...g.dice,players:{...g.dice.players,'seat-1':g.dice.players['seat-1'].map(d=>({...d,used:true})) as unknown as typeof g.dice.players[string]}}};
 assert.equal(immediateOptions(used,used.players[0],'castle').filter(o=>o.id.startsWith('bonus-shield:')).length,0);
 const poor={...g,players:g.players.map((p,i)=>i?p:{...p,workers:0})};for(const o of immediateOptions(poor,poor.players[0],'castle').filter(o=>o.id.startsWith('bonus-shield:')))assert.equal((o.payload as unknown as {shield:{steps:number[][]}}).shield.steps.flat().length,0);
 let free=mount(used,11);free={...free,turn:{...free.turn,pendingChoice:{...free.turn.pendingChoice!,options:immediateOptions(free,free.players[0],'castle')}}};
 const a=directActions(free,'seat-1').find(a=>boardTarget(free,a).shield&&!boardTarget(free,a).shield!.dieId)!;assert.ok(a);assert.deepEqual(step(free,a).dice,free.dice);
});
test('Ver3 online new-room harp-seal setting is boolean, persistent and independent of reconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'burgundy-ver3-config-')),store=new RoomStore(dir);
 for(const geese of [false,true]){const a=await store.create('A',false,false,null,false,false,false,[],false,{},geese);await store.joinRoom(a.id,'B');const raw=JSON.parse(await readFile(join(dir,a.id+'.json'),'utf8'));assert.equal(raw.game.config.extensions.some((e:{id:string})=>e.id==='geese'),geese);assert.equal(Object.values(raw.game.tiles).filter(t=>(t as {species?:string}).species==='geese').length,geese?1:0);const v=await store.view(a.id,a.token);assert.deepEqual(await new RoomStore(dir).view(a.id,a.token),v);}
 await assert.rejects(()=>store.create('A',false,false,null,false,false,false,[],false,{},'false'));
});
test('Ver3 either of two unused owned dice may pair, leaving the unchosen die intact',()=>{
 let g=bonusShieldFixture();g={...g,dice:{...g.dice,players:{...g.dice.players,'seat-1':[{...g.dice.players['seat-1'][0],used:false},g.dice.players['seat-1'][1]]}}};g={...g,turn:{...g.turn,pendingChoice:{...g.turn.pendingChoice!,options:immediateOptions(g,g.players[0],'castle')}}};
 for(const i of [0,1]){const a=directActions(g,'seat-1').find(a=>boardTarget(g,a).shield?.dieId===g.dice.players['seat-1'][i].id)!;assert.ok(a);const n=step(g,a);assert.equal(n.dice.players['seat-1'][i].used,true);assert.deepEqual(n.dice.players['seat-1'][1-i],g.dice.players['seat-1'][1-i]);assert.equal(n.players[0].workers,g.players[0].workers-directCost(g,a));}
});
