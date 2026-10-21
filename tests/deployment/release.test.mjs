import {test} from "node:test";
import assert from "node:assert/strict";
import {deployRender,verifiedCI} from "../../scripts/deploy-render.mjs";
const sha="a".repeat(40),hook="https://api.render.com/deploy/srv-fixture?key=fake-test-only",url="https://production.example",staging="https://staging.example";
test("release pins a successful main SHA; failed CI and stale staging block deployment",async()=>{
 const json=value=>Response.json(value);await assert.rejects(verifiedCI("owner/repo",sha,"fake",async()=>json({workflow_runs:[]})),/successful/);
 await verifiedCI("owner/repo",sha,"fake",async()=>json({workflow_runs:[{head_sha:sha,head_branch:"main",event:"push",conclusion:"success"}]}));
 let posted=0,version="old";const request=async(input,options)=>{const u=new URL(input);if(options?.method==="POST"){posted++;assert.equal(u.searchParams.get("ref"),sha);version=sha;return json({});}return json({status:"ok",roomFormat:1,protocol:1,version:u.host==="staging.example"?"old":version});};
 await assert.rejects(deployRender({hook,url,sha,staging},request,async()=>{}),/staging/);assert.equal(posted,0);
 await deployRender({hook,url,sha,staging,rollback:true},request,async()=>{});assert.equal(posted,1);
 await assert.rejects(deployRender({hook,url,sha},async()=>json({roomFormat:2,protocol:1}),async()=>{}),/migration/);
});
