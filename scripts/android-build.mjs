import {existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const kind = process.argv[2] ?? 'debug';
assert(['debug', 'release'].includes(kind));
const tools = path.resolve('.local-data/android/tools');
const bundledJava = path.join(tools, 'java');
const java = process.env.JAVA_HOME || (existsSync(bundledJava) ? path.join(bundledJava, readdirSync(bundledJava)[0]) : '');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(tools, 'sdk');
assert(existsSync(path.join(java, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')), 'Install JDK21 and set JAVA_HOME');
assert(existsSync(path.join(sdk, 'platforms/android-36')), 'Install Android SDK platform 36 and set ANDROID_HOME');
if (kind === 'release') for (const name of ['BURGUNDY_KEYSTORE', 'BURGUNDY_KEYSTORE_PASSWORD', 'BURGUNDY_KEY_ALIAS', 'BURGUNDY_KEY_PASSWORD']) {
  assert(process.env[name], `Release signing requires ${name} (use secure local environment; never commit keys)`);
}
writeFileSync('android/local.properties', `sdk.dir=${sdk.replaceAll('\\', '/')}\n`);
const task = `assemble${kind === 'debug' ? 'Debug' : 'Release'}`;
const command = process.platform === 'win32' ? 'cmd.exe' : './gradlew';
const args = process.platform === 'win32' ? ['/d', '/c', `gradlew.bat ${task} --console=plain --no-daemon`] : [task, '--console=plain', '--no-daemon'];
const run = spawnSync(command, args, {
  cwd: path.resolve('android'), stdio: 'inherit',
  env: {...process.env, JAVA_HOME: java, ANDROID_HOME: sdk, GRADLE_USER_HOME: path.resolve('.local-data/android/gradle')},
});
if (run.status !== 0) process.exit(run.status ?? 1);
const version = JSON.parse(readFileSync('mobile/version.json', 'utf8'));
const output = `.local-data/android/apk/burgundy-expanded-${version.versionName}-${version.versionCode}-${kind}.apk`;
mkdirSync(path.dirname(output), {recursive: true});
copyFileSync(`android/app/build/outputs/apk/${kind}/app-${kind}.apk`, output);
console.log(`APK: ${path.resolve(output)}`);
