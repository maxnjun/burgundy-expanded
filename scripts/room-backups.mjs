import {mkdir,readdir,readFile,writeFile,lstat} from "node:fs/promises";
import {join,resolve} from "node:path";
import {createHash,randomBytes} from "node:crypto";
import {pathToFileURL} from "node:url";

const hash=raw=>createHash("sha256").update(raw).digest("hex");
async function roomFile(directory,name){
 if(!/^[a-f0-9]{24}\.json$/.test(name)||(await lstat(join(directory,name))).isSymbolicLink())throw Error("Invalid room path");
 const raw=await readFile(join(directory,name));if(raw.length>2_100_000)throw Error("Room too large");
 let room;try{room=JSON.parse(raw);}catch{throw Error("Invalid private room JSON");}if(!room||room.version!==1||`${room.id}.json`!==name||!room.game||!Array.isArray(room.tokens)||room.tokens.length!==2)throw Error("Unsupported room format; keep the original data and stop deployment");
 return raw;
}
async function emptyDirectory(directory){await mkdir(directory,{recursive:true,mode:0o700});if((await readdir(directory)).length)throw Error("Destination must be empty; existing data is never overwritten");}
export async function snapshotRooms(source,destination){
 source=resolve(source);destination=resolve(destination);if(source===destination)throw Error("Separate backup destination required");
 await mkdir(source,{recursive:true,mode:0o700});
 const files=(await readdir(source)).filter(n=>/^[a-f0-9]{24}\.json$/.test(n)).sort();
 const entries=await Promise.all(files.map(async name=>({name,raw:await roomFile(source,name)})));
 await emptyDirectory(destination);const manifest={format:1,roomFormat:1,createdAt:new Date().toISOString(),files:[]};
 for(const {name,raw} of entries){await writeFile(join(destination,name),raw,{flag:"wx",mode:0o600});manifest.files.push({name,sha256:hash(raw)});}
 await writeFile(join(destination,"manifest.json"),JSON.stringify(manifest),{flag:"wx",mode:0o600});return manifest.files.length;
}
export async function restoreRooms(source,destination){
 const manifest=JSON.parse(await readFile(join(source,"manifest.json"),"utf8"));
 if(manifest.format!==1||manifest.roomFormat!==1||!Array.isArray(manifest.files)||new Set(manifest.files.map(f=>f.name)).size!==manifest.files.length)throw Error("Unsupported backup manifest");
 const files=await Promise.all(manifest.files.map(async f=>{const raw=await roomFile(source,f.name);if(hash(raw)!==f.sha256)throw Error("Backup checksum mismatch");return {name:f.name,raw};}));
 await emptyDirectory(destination);for(const {name,raw} of files)await writeFile(join(destination,name),raw,{flag:"wx",mode:0o600});return files.length;
}
export async function startupSnapshot(directory){
 const destination=join(directory,"snapshots",`${Date.now()}-${randomBytes(3).toString("hex")}`);
 const count=await snapshotRooms(directory,destination);console.info(JSON.stringify({event:"room-snapshot",rooms:count}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const [, ,command,source,destination]=process.argv;if(!source||!destination||!["snapshot","restore"].includes(command))throw Error("Usage: node scripts/room-backups.mjs snapshot|restore SOURCE EMPTY_DESTINATION");
 const count=await(command==="snapshot"?snapshotRooms:restoreRooms)(source,destination);console.info(JSON.stringify({event:command,rooms:count}));}catch(error){console.error(error.message);process.exitCode=1;}
}
