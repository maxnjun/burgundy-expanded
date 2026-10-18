import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoot = resolve(tmpdir());
const output = mkdtempSync(join(tempRoot, "burgundy-core-tests-"));
try {
  const compile = spawnSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.core-tests.json", "--outDir", output], { cwd: root, stdio: "inherit" });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = spawnSync(process.execPath, ["--test", ...["core", "placement", "practice", "phases", "save", "ship", "effects", "scenarios", "market", "optional-rules", "computer", "rooms", "room-http", "additional-hexes", "solo-scoring"].map(name => join(output, `tests/core/${name}.test.js`))], { cwd: root, stdio: "inherit" });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  }
} finally {
  // Remove only this runner's newly created and verified temporary directory.
  const local = relative(tempRoot, resolve(output));
  if (!local.startsWith("..") && dirname(resolve(output)) === tempRoot && basename(output).startsWith("burgundy-core-tests-")) rmSync(output, { recursive: true, force: true });
}
