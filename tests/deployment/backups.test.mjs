import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {snapshotRooms,restoreRooms} from "../../scripts/room-backups.mjs";

test("private snapshots restore exactly and reject overwrites, corruption and future formats",async()=>{
 const root=await mkdtemp(join(tmpdir(),"burgundy-backup-")),source=join(root,"source"),backup=join(root,"backup"),target=join(root,"restored"),name="a".repeat(24)+".json";
 await mkdir(source);const raw=JSON.stringify({version:1,id:"a".repeat(24),game:{revision:12},tokens:["hash",null]});await writeFile(join(source,name),raw);
 assert.equal(await snapshotRooms(source,backup),1);assert.equal(await restoreRooms(backup,target),1);assert.equal(await readFile(join(target,name),"utf8"),raw);
 await assert.rejects(restoreRooms(backup,target),/empty/);await writeFile(join(backup,name),raw+" ");await assert.rejects(restoreRooms(backup,join(root,"bad")),/checksum/);
 await writeFile(join(source,name),raw.replace('"version":1','"version":2'));await assert.rejects(snapshotRooms(source,join(root,"future")),/Unsupported/);
 const manifest=JSON.parse(await readFile(join(backup,"manifest.json"),"utf8"));manifest.files[0].name="../outside.json";await writeFile(join(backup,"manifest.json"),JSON.stringify(manifest));await assert.rejects(restoreRooms(backup,join(root,"outside")),/path/);
});
