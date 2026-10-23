import {createServer} from "node:http";
import {isAbsolute} from "node:path";
import {attachRoomSockets} from "./room-websockets.mjs";
import {startupSnapshot} from "./room-backups.mjs";

process.env.NODE_ENV="production";
const {default:next}=await import("next");
const port=Number(process.env.PORT||3000),hostname=process.env.HOST||"0.0.0.0";
if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid PORT");
const app=next({dev:false,hostname,port});await app.prepare();
const storage=process.env.BURGUNDY_STORAGE||"file";
if(storage==="file"){
 if(!process.env.BURGUNDY_DATA_DIR||!isAbsolute(process.env.BURGUNDY_DATA_DIR))throw Error("Set BURGUNDY_DATA_DIR to a persistent absolute directory before production start");
 await startupSnapshot(process.env.BURGUNDY_DATA_DIR);
}else if(storage!=="upstash"||!process.env.UPSTASH_REDIS_REST_URL||!process.env.UPSTASH_REDIS_REST_TOKEN||!process.env.BURGUNDY_ROOM_NAMESPACE)throw Error("Set valid external room storage configuration before production start");
const server=createServer((request,response)=>{
 response.setHeader("X-Content-Type-Options","nosniff");response.setHeader("X-Frame-Options","DENY");response.setHeader("Referrer-Policy","no-referrer");
 response.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 app.getRequestHandler()(request,response).catch(()=>{if(!response.headersSent)response.writeHead(500);response.end();console.error('{"event":"request-error","status":500}');});
});
const version=process.env.GAME_VERSION||process.env.RENDER_GIT_COMMIT||"development";
const closeSockets=attachRoomSockets(server,{port,origin:process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL,version});
await new Promise(resolve=>server.listen(port,hostname,resolve));
console.info(JSON.stringify({event:"server-started",version,port}));
let closing=false;const shutdown=()=>{if(closing)return;closing=true;closeSockets();server.close(async()=>{await app.close();process.exit(0);});setTimeout(()=>process.exit(1),15_000).unref();};
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
