import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";

test("test deployment provisions one isolated, durable room service after successful CI",()=>{
 const blueprint=readFileSync(new URL("../../render.yaml",import.meta.url),"utf8");
 const release=readFileSync(new URL("../../.github/workflows/release.yml",import.meta.url),"utf8");
 assert.equal((blueprint.match(/^  - type: web$/gm)||[]).length,1);
 assert.match(blueprint,/name: burgundy-expanded-staging/);
 assert.match(blueprint,/plan: 0\.5c-512mb/);
 assert.match(blueprint,/region: singapore/);
 assert.match(blueprint,/autoDeployTrigger: off/);
 assert.match(blueprint,/numInstances: 1/);
 assert.match(blueprint,/mountPath: \/var\/data/);
 assert.match(blueprint,/sizeGB: 1/);
 assert.match(blueprint,/value: \/var\/data\/burgundy-staging/);
 assert.doesNotMatch(blueprint,/name: production-rooms|name: burgundy-expanded\s*$/m);
 assert.doesNotMatch(blueprint,/^databases:/m);
 assert.match(release,/staging:[\s\S]*?ENABLE_TEST_DEPLOYMENTS == 'true'[\s\S]*?workflow_run\.conclusion == 'success'/);
 assert.match(release,/production-check:[\s\S]*?ENABLE_PRODUCTION_DEPLOYMENTS == 'true'/);
 assert.doesNotMatch(release,/ENABLE_DEPLOYMENTS == 'true'/);
});
