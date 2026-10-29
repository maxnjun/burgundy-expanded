import {cp, mkdir, readFile, writeFile, symlink, rename} from 'node:fs/promises';
import {spawnSync, execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const version = JSON.parse(await readFile('mobile/version.json', 'utf8'));
assert(Number.isSafeInteger(version.versionCode) && version.versionCode > 0);
assert(/^[a-f0-9]{40}$/.test(version.onlineVersion), 'Pin the compatible deployed server SHA in mobile/version.json');
const stage = path.join(root, '.local-data/android', `export-${Date.now()}`);
await mkdir(stage, {recursive: true});
await cp('src', path.join(stage, 'src'), {recursive: true, filter: source => path.resolve(source) !== path.resolve('src/app/api')});
await cp('public', path.join(stage, 'public'), {recursive: true});
for (const file of ['package.json', 'tsconfig.json']) await cp(file, path.join(stage, file));
await symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
await writeFile(path.join(stage, 'next.config.mjs'), `export default {output:'export',trailingSlash:true,turbopack:{root:${JSON.stringify(root)}}};\n`);
await cp('mobile/runtime.tsx', path.join(stage, 'src/app/native-runtime.tsx'));
await cp('mobile/transport.ts', path.join(stage, 'src/app/transport.ts'));
await cp('mobile/native.css', path.join(stage, 'src/app/native.css'));
const layoutFile = path.join(stage, 'src/app/layout.tsx');
const layout = await readFile(layoutFile, 'utf8');
assert(layout.includes('<DesignProvider>{children}'), 'Root layout changed: review Android integration');
await writeFile(layoutFile, 'import NativeRuntime from "./native-runtime";\nimport "./native.css";\n' + layout.replace('<DesignProvider>{children}', '<DesignProvider><NativeRuntime/>{children}'));
const run = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', stage], {
  cwd: stage, stdio: 'inherit', env: {...process.env, NEXT_PUBLIC_GAME_VERSION: version.onlineVersion},
});
if (run.status !== 0) process.exit(run.status ?? 1);
// Copy this build only. Capacitor uses this exact directory, avoiding stale assets.
await writeFile(path.join(stage, 'out/android-build.json'), JSON.stringify({
  ...version, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), builtAt: new Date().toISOString(),
}));
const web = path.join(root, '.local-data/android/web');
try {
  await readFile(path.join(web, 'android-build.json'));
  await rename(web, path.join(root, '.local-data/android', `previous-web-${Date.now()}`));
} catch (error) {if (error.code !== 'ENOENT') throw error;}
await cp(path.join(stage, 'out'), web, {recursive: true, errorOnExist: true, force: false});
console.log(`Android offline web export: ${stage}/out`);
