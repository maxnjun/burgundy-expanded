import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";

test("test deployment uses free compute and external rooms, isolated from production after successful CI",()=>{
 const blueprint=readFileSync(new URL("../../render.yaml",import.meta.url),"utf8");
 const release=readFileSync(new URL("../../.github/workflows/release.yml",import.meta.url),"utf8");
 assert.equal((blueprint.match(/^  - type: web$/gm)||[]).length,1);
 assert.match(blueprint,/name: burgundy-expanded-staging/);
 assert.match(blueprint,/plan: free/);
 assert.match(blueprint,/region: singapore/);
 assert.match(blueprint,/autoDeployTrigger: off/);
 assert.match(blueprint,/numInstances: 1/);
 assert.doesNotMatch(blueprint,/^\s*disk:|sizeGB:|mountPath:/m);
 assert.match(blueprint,/key: BURGUNDY_STORAGE\s+value: upstash/);
 assert.match(blueprint,/key: BURGUNDY_ROOM_NAMESPACE\s+value: staging/);
 for(const key of ["UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])assert.match(blueprint,new RegExp(`key: ${key}\\s+sync: false`));
 assert.doesNotMatch(blueprint,/name: production-rooms|name: burgundy-expanded\s*$/m);
 assert.doesNotMatch(blueprint,/^databases:/m);
 assert.match(release,/staging:[\s\S]*?ENABLE_TEST_DEPLOYMENTS == 'true'[\s\S]*?workflow_run\.conclusion == 'success'/);
 assert.match(release,/production-check:[\s\S]*?ENABLE_PRODUCTION_DEPLOYMENTS == 'true'/);
 assert.doesNotMatch(release,/ENABLE_DEPLOYMENTS == 'true'/);
});
