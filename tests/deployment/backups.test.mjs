import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {gzipSync} from "node:zlib";
import {snapshotRooms,restoreRooms,roomStorageStatus} from "../../scripts/room-backups.mjs";

test("private snapshots restore exactly and reject overwrites, corruption and future formats",async()=>{
 const root=await mkdtemp(join(tmpdir(),"burgundy-backup-")),source=join(root,"source"),backup=join(root,"backup"),target=join(root,"restored"),name="a".repeat(24)+".json";
 await mkdir(source);const raw=JSON.stringify({version:1,id:"a".repeat(24),game:{revision:12},tokens:["hash",null]});await writeFile(join(source,name),raw);
 assert.equal(await snapshotRooms(source,backup),1);assert.equal(await restoreRooms(backup,target),1);assert.equal(await readFile(join(target,name),"utf8"),raw);
 await assert.rejects(restoreRooms(backup,target),/empty/);await writeFile(join(backup,name),raw+" ");await assert.rejects(restoreRooms(backup,join(root,"bad")),/checksum/);
 await writeFile(join(source,name),raw.replace('"version":1','"version":2'));await assert.rejects(snapshotRooms(source,join(root,"future")),/Unsupported/);
 const manifest=JSON.parse(await readFile(join(backup,"manifest.json"),"utf8"));manifest.files[0].name="../outside.json";await writeFile(join(backup,"manifest.json"),JSON.stringify(manifest));await assert.rejects(restoreRooms(backup,join(root,"outside")),/path/);
});

test("cold archives are included in inventory, checksum snapshots and lossless restore",async()=>{
 const root=await mkdtemp(join(tmpdir(),"burgundy-backup-")),source=join(root,"source"),archive=join(source,"archive"),id="b".repeat(24),name=id+".json";
 await mkdir(archive,{recursive:true});const raw=JSON.stringify({version:1,id,game:{status:"finished",revision:90},tokens:["hash","guest"]});await writeFile(join(archive,name+".gz"),gzipSync(raw));
 const status=await roomStorageStatus(source);assert.equal(status.rooms,1);assert.equal(status.archived,1);assert.equal(status.finished,1);assert.ok(status.availableBytes>0);assert.equal(JSON.stringify(status).includes("hash"),false);
 const backup=join(root,"snapshot"),restored=join(root,"restored");assert.equal(await snapshotRooms(source,backup),1);assert.equal(await restoreRooms(backup,restored),1);assert.equal(await readFile(join(restored,name),"utf8"),raw);
 // A crash after reactivation can leave an older archive: the current live file wins.
 const latest=raw.replace('"revision":90','"revision":91');await writeFile(join(source,name),latest);assert.equal(await snapshotRooms(source,join(root,"second")),1);assert.equal(await readFile(join(root,"second",name),"utf8"),latest);
 await writeFile(join(archive,"c".repeat(24)+".json.gz"),"corrupted archive");await assert.rejects(snapshotRooms(source,join(root,"corrupt")));
});
