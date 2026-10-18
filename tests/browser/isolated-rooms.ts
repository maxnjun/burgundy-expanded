import { createServer } from "node:http";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RoomStore } from "../../src/server/rooms";
import { roomHandlers } from "../../src/server/room-http";
/** Real HTTP + production handlers/store, isolated files kept as ignored QA artifacts. */
export async function isolatedRooms(){
 await mkdir(join(process.cwd(),".local-data","qa"),{recursive:true});
 const directory=await mkdtemp(join(process.cwd(),".local-data","qa","room-test-"));
 const handlers=roomHandlers(new RoomStore(directory));
 const server=createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(","):value);
   const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
   const match=new URL(request.url).pathname.match(/^\/api\/rooms(?:\/([a-f0-9]{24})(?:\/(join|actions))?)?$/);
   const response=!match?new Response(null,{status:404}):!match[1]?await handlers.create(request):match[2]==="join"?await handlers.join(request,match[1]):match[2]==="actions"?await handlers.act(request,match[1]):await handlers.view(request,match[1]);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('{}');}
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("Test server unavailable");
 return {directory,url:`http://127.0.0.1:${address.port}`,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
