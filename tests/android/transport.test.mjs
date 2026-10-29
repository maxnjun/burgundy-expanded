import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeRequest} from '../../mobile/transport.ts';
import config from '../../capacitor.config.ts';

test('bundled offline origin matches existing HTTPS/WS server; no remote start URL', () => {
  assert.equal(config.server.url, undefined);
  assert.equal(config.server.hostname, 'burgundy-expanded.onrender.com');
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.appId, 'com.maxnjun.burgundyexpanded');
  assert(!config.android.allowMixedContent);
});
test('native API transport preserves auth, version, revision and request ID', async () => {
  const action = {requestId: 'test-idempotent-request', revision: 15, action: {type: 'end-turn'}};
  const response = await nativeRequest(new Request('https://burgundy-expanded.onrender.com/api/rooms/test/actions', {
    method: 'POST', headers: {Authorization: 'Bearer test-only-seat', 'X-Game-Version': 'test-sha', 'Content-Type': 'application/json'}, body: JSON.stringify(action),
  }), async request => {
    assert.equal(request.headers.authorization, 'Bearer test-only-seat');
    assert.equal(request.headers['x-game-version'], 'test-sha');
    assert.equal(request.headers.Origin, 'https://burgundy-expanded.onrender.com');
    assert.deepEqual(JSON.parse(request.data), action);
    assert.equal(request.disableRedirects, true);
    return {status: 409, headers: {'x-game-version': 'test-sha'}, data: JSON.stringify({error: 'stale revision'}), url: request.url};
  });
  assert.equal(response.status, 409); assert.equal(response.headers.get('x-game-version'), 'test-sha');
  assert.deepEqual(await response.json(), {error: 'stale revision'});
});
test('cancelled API request does not start native HTTP', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(nativeRequest(new Request('https://example.test/api/rooms', {signal: abort.signal}), () => {assert.fail('must not send');}), {name: 'AbortError'});
});
test('timeout does not report a late native response as a new successful action', async () => {
  const abort = new AbortController(); let resolve;
  const pending = nativeRequest(new Request('https://example.test/api/rooms', {signal: abort.signal}), () => new Promise(r => {resolve = r;}));
  abort.abort(); await assert.rejects(pending, {name: 'AbortError'});
  resolve({data: '{}', status: 200, headers: {}, url: 'https://example.test'});
});
test('release build requires external signing; private storage backup disabled', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:screenOrientation="sensorLandscape"/);
  const build = readFileSync('scripts/android-build.mjs', 'utf8');
  assert.match(build, /Release signing requires/);
});
