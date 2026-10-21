import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {setTimeout as delay} from "node:timers/promises";

export async function verifiedCI(repo,sha,token,request=fetch){
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||! /^[a-f0-9]{40}$/.test(sha))throw Error("Use a full, tested commit SHA");
 const response=await request(`https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=20`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(15_000)});
 if(!response.ok)throw Error("Cannot verify GitHub CI");const data=await response.json();
 if(!data.workflow_runs?.some(r=>r.head_sha===sha&&r.head_branch==="main"&&r.event==="push"&&r.conclusion==="success"))throw Error("This main commit has no successful full CI run");
}
async function health(url,request){const response=await request(new URL("/api/health",url),{cache:"no-store",signal:AbortSignal.timeout(15_000)});if(!response.ok)throw Error("Service health check failed");return response.json();}
export async function deployRender({hook,url,sha,staging,rollback=false},request=fetch,pause=delay){
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error("Full commit SHA required");
 const endpoint=new URL(hook),site=new URL(url);
 if(endpoint.origin!=="https://api.render.com"||!/^\/deploy\/srv-[\w-]+$/.test(endpoint.pathname)||!endpoint.searchParams.get("key")||site.protocol!=="https:")throw Error("Invalid secure deployment configuration");
 const current=await health(site,request);if(current.roomFormat!==1||current.protocol!==1)throw Error("Data compatibility changed; deployment requires a separate migration review");
 if(staging&&!rollback){const tested=await health(staging,request);if(tested.version!==sha||tested.roomFormat!==1||tested.protocol!==1)throw Error("Deploy this exact commit to staging first");}
 endpoint.searchParams.set("ref",sha);
 const response=await request(endpoint,{method:"POST",signal:AbortSignal.timeout(30_000)});if(!response.ok)throw Error("Render rejected deployment; inspect the service dashboard");
 for(let i=0;i<60;i++){await pause(10_000);try{const ready=await health(site,request);if(ready.status==="ok"&&ready.version===sha&&ready.roomFormat===1&&ready.protocol===1)return;}catch{/* Restart downtime is expected with one persistent disk. */}}
 throw Error("Deployment was not verified within 10 minutes; keep the existing volume and inspect Render logs");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.env.DEPLOY_MODE==="production"&&!process.env.STAGING_URL)throw Error("Production needs staging verification");const sha=process.env.DEPLOY_SHA;await verifiedCI(process.env.GITHUB_REPOSITORY,sha,process.env.GITHUB_TOKEN);
 await deployRender({hook:process.env.RENDER_DEPLOY_HOOK,url:process.env.SITE_URL,sha,staging:process.env.STAGING_URL,rollback:process.env.DEPLOY_MODE==="rollback"});console.info("Deployment health and exact commit verified");
 }catch{console.error("Deployment verification failed. Check CI, staging, compatibility and Render logs; no room data was restored or deleted.");process.exitCode=1;}
}
