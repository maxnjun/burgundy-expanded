import test from 'node:test';
import assert from 'node:assert/strict';
import {configureNativeSave,readLocalSave,writeLocalSave} from '../../src/app/local-save.ts';
const gameKey='burgundy-expanded:local-v1',historyKey='burgundy-expanded:turn-history-v1';
function storage(){const m=new Map([[gameKey,'legacy'],[historyKey,'legacy-undo'],['manual-slot','keep']]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};configureNativeSave(undefined);return m;}
test('browser saves replace the active checkpoint and matching sidecar, preserving other saves',async()=>{
 const m=storage();await writeLocalSave('fresh','fresh-undo');assert.deepEqual(await readLocalSave(),{text:'fresh',history:'fresh-undo'});assert.equal(m.get('manual-slot'),'keep');
});
test('native first read falls back to legacy; completed commit wins over stale WebView cache',async()=>{
 const m=storage();let committed={text:null,history:null};configureNativeSave({read:async()=>committed,write:async s=>{committed=s;}});
 assert.equal((await readLocalSave()).text,'legacy');await writeLocalSave('new-game','new-undo');m.set(gameKey,'legacy');m.set(historyKey,'legacy-undo');assert.deepEqual(await readLocalSave(),{text:'new-game',history:'new-undo'});
});
test('queued old autosaves cannot overwrite a later new game; read waits for commit',async()=>{
 storage();const calls=[];let release,committed={text:null,history:null};configureNativeSave({read:async()=>committed,write:async s=>{calls.push(s.text);if(s.text==='old')await new Promise(r=>release=r);committed=s;}});
 const old=writeLocalSave('old','old-undo');await new Promise(r=>setTimeout(r,0));const fresh=writeLocalSave('fresh','empty-undo');let done=false;fresh.then(()=>done=true);assert.equal(done,false);release();await old;await fresh;assert.deepEqual(calls,['old','fresh']);assert.deepEqual(await readLocalSave(),{text:'fresh',history:'empty-undo'});
});
test('failed native commit keeps old save and allows retry, cache failure cannot hide committed new game',async()=>{
 const m=storage();let fail=true,committed={text:'old',history:'old-undo'};configureNativeSave({read:async()=>committed,write:async s=>{if(fail)throw Error('disk full');committed=s;}});
 await assert.rejects(writeLocalSave('bad','bad-undo'),/disk full/);assert.equal(m.get(gameKey),'legacy');assert.equal((await readLocalSave()).text,'old');fail=false;
 globalThis.localStorage.setItem=()=>{throw Error('cache unavailable');};await writeLocalSave('new','new-undo');assert.deepEqual(await readLocalSave(),{text:'new',history:'new-undo'});configureNativeSave(undefined);
});
