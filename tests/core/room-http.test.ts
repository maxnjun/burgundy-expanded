import { test } from "node:test";
import assert from "node:assert/strict";
import { body, respond } from "../../src/server/room-http";
import { RoomError } from "../../src/server/rooms";
const request=(origin:string,value:string,contentType="application/json")=>new Request("http://localhost:3000/api/rooms",{method:"POST",headers:{Host:"127.0.0.1:3000",Origin:origin,"Content-Type":contentType},body:value});
test("room requests compare browser origin to actual host behind Next's internal URL",async()=>{
  assert.deepEqual(await body(request("http://127.0.0.1:3000",'{"name":"A"}')),{name:"A"});
  await assert.rejects(()=>body(request("https://untrusted.example",'{"name":"A"}')),(e:unknown)=>e instanceof RoomError&&e.status===403);
});
test("room API bounds bytes, requires JSON objects and conceals unexpected exceptions",async()=>{
  await assert.rejects(()=>body(request("http://127.0.0.1:3000",JSON.stringify({text:"x".repeat(33000)}))),(e:unknown)=>e instanceof RoomError&&e.status===413);
  for(const value of ["null","[]","{"])await assert.rejects(()=>body(request("http://127.0.0.1:3000",value)));
  await assert.rejects(()=>body(request("http://127.0.0.1:3000","text","text/plain")));
  const result=await respond(async()=>{throw new Error("private internal detail");});assert.equal(result.status,500);assert.ok(!(await result.text()).includes("private internal detail"));
  assert.equal(result.headers.get("cache-control"),"no-store");
});


test("room errors preserve safe HTTP statuses across development hot reload",async()=>{
  const old=class RoomError extends Error{status=403;};
  const response=await respond(async()=>{throw new old("다른 좌석의 행동");});assert.equal(response.status,403);
  const unknown=await respond(async()=>{throw Object.assign(new Error("secret diagnostic"),{status:403});});assert.equal(unknown.status,500);assert.ok(!(await unknown.text()).includes("secret diagnostic"));
});
