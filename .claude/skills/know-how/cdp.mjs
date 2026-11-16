// Headless Chrome, driven over the DevTools protocol, for checking the site in
// a real browser without the browser pane. It needs only Node 22+ (built-in
// WebSocket and fetch) and Google Chrome, with no npm packages.
//
// From a script run in the repo root (no machine path baked in):
//   import { pathToFileURL } from 'node:url';
//   const { launch, sleep } = await import(pathToFileURL('.claude/skills/know-how/cdp.mjs').href);
//   const t = await launch('http://127.0.0.1:5173', outDir, { width: 1400, height: 1000 });
//   try {
//     await t.openApp('Field Guide');
//     await t.waitFor(`document.querySelectorAll('.species-card').length > 0`, 'species list');
//     t.check('lists species', await t.ev(`document.querySelectorAll('.species-card').length`) > 0);
//     await t.shot('field-guide.png', '.window');
//   } finally { t.finish(); t.close(); }
//
// Outside APIs get canned replies by default (see "Canned replies" below), so
// a check makes no live calls. CHECK_LIVE=1 lets requests through to the real
// services; CHECK_RECORD=1 does too, and saves what came back as the new
// canned replies. Screenshots are skipped unless CHECK_SHOTS=1.
//
// See know-how's checking.md, "Proving a change in a real browser".
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Chrome flags for a fake webcam (a test pattern) that needs no permission prompt */
export const FAKE_CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---- Canned replies
// Every reply from an outside host is saved per check script in
// fixtures/<script>.json.gz: { recordedAt, replies: { "GET url": [reply, …] } }.
// A key holds the replies in the order they came, so a 429 then a 200 plays
// back the same way. Pictures and video are never saved: a picture gets a
// 1x1 PNG, a video an empty body. The site's own /api (the Spotify backend)
// is never recorded, as it hands out tokens; in replay it answers 503, as
// when the backend is off.
const MODE = process.env.CHECK_RECORD === '1' ? 'record' : process.env.CHECK_LIVE === '1' ? 'live' : 'replay';
/** True when replies are canned (the default), so a check can skip pacing meant for live APIs */
export const CANNED = MODE === 'replay';
/** True when requests go to the real services without being saved (CHECK_LIVE=1) */
export const LIVE = MODE === 'live';
export const SHOTS = process.env.CHECK_SHOTS === '1';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const NEVER_RECORD = /^https:\/\/(api|accounts)\.spotify\.com\//;
const DROP_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-expose-headers', 'alt-svc', 'report-to', 'nel', 'strict-transport-security']);
const fixtureName = basename(process.argv[1] || 'check', '.mjs');
const fixtureFile = join(FIXTURES, `${fixtureName}.json.gz`);
let store = { recordedAt: null, replies: {} };
// In replay a check falls back on the other checks' replies: with instant
// replies an app can ask for something its own (slower) recording never did
let shared = {};
if (MODE === 'replay') {
  const read = (f) => JSON.parse(gunzipSync(readFileSync(join(FIXTURES, f))).toString());
  if (existsSync(fixtureFile)) store = read(`${fixtureName}.json.gz`);
  if (existsSync(FIXTURES)) for (const f of readdirSync(FIXTURES)) {
    if (!f.endsWith('.json.gz') || f === `${fixtureName}.json.gz`) continue;
    const other = read(f);
    shared = { ...other.replies, ...shared };
    store.recordedAt ??= other.recordedAt;
  }
}
if (MODE === 'record') store.recordedAt = new Date().toISOString();
// Replies a replay had to fetch live because none was saved (see apiFetch
// and Fetch.requestPaused); saved to this check's file so the next run is canned
let filled = 0;
const saveStore = () => {
  if (MODE !== 'record' && !filled) return;
  // A check that asked nothing outside needs no file
  if (!Object.keys(store.replies).length) { rmSync(fixtureFile, { force: true }); return; }
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(fixtureFile, gzipSync(JSON.stringify(store)));
};
// Bodies are kept as text when they are text (far smaller once gzipped)
const isText = (type = '') => /json|text|javascript|xml|html/.test(type);
const bodyOf = (r) => r.text !== undefined ? Buffer.from(r.text).toString('base64') : (r.body ?? '');
const keyOf = (method, url, postData) => `${method} ${url}${postData ? ` ${postData}` : ''}`;
/** Adds a reply to the store, keeping the longest sequence any one browser saw */
const remember = (seen, key, reply) => {
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  const list = (store.replies[key] ??= []);
  if (n >= list.length) list.push(reply);
};
const replay = (seen, key) => {
  const list = store.replies[key] ?? shared[key];
  if (!list?.length) return null;
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  return list[Math.min(n, list.length - 1)];
};
const nodeSeen = new Map();
/**
 * fetch() for a check's own spot-checks from Node: canned in replay (from the
 * same store as the page), live with CHECK_LIVE=1, saved with CHECK_RECORD=1.
 */
export async function apiFetch(url, init = {}) {
  const key = keyOf('GET', url);
  if (MODE === 'replay') {
    let r = replay(nodeSeen, key);
    if (!r) {
      const res = await fetch(url, init);
      const type = res.headers.get('content-type') ?? '';
      const buf = Buffer.from(await res.arrayBuffer());
      r = { status: res.status, headers: { 'content-type': type }, ...(isText(type) ? { text: buf.toString() } : { body: buf.toString('base64') }) };
      remember(new Map(), key, r);
      filled++;
      console.log(`note: no canned reply for ${url}; fetched it live once and saved it`);
      saveStore();
    }
    return new Response(r.status === 204 || r.status === 304 ? null : Buffer.from(bodyOf(r), 'base64'), { status: r.status, headers: r.headers });
  }
  const res = await fetch(url, init);
  if (MODE === 'record') {
    const type = res.headers.get('content-type') ?? '';
    const buf = Buffer.from(await res.clone().arrayBuffer());
    remember(nodeSeen, key, { status: res.status, headers: { 'content-type': type }, ...(isText(type) ? { text: buf.toString() } : { body: buf.toString('base64') }) });
    saveStore();
  }
  return res;
}

/**
 * Opens appUrl in a fresh headless Chrome. Screenshots go to outDir (made if
 * missing; a temp folder if omitted). Returns helpers; always call close().
 * chromeArgs adds Chrome flags, e.g. FAKE_CAMERA for a test webcam.
 */
export async function launch(appUrl, outDir, { width = 1280, height = 1000, chromeArgs = [] } = {}) {
  outDir = outDir || mkdtempSync(join(tmpdir(), 'cdp-out-'));
  mkdirSync(outDir, { recursive: true });
  // The profile lives in the system temp folder and is deleted on close()
  const profile = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${width},${height}`, ...chromeArgs, 'about:blank'
  ], { stdio: 'ignore' });

  let ws, nextId = 1;
  const pending = new Map();
  const pageErrors = [];
  const results = [];
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  // Chrome picks a free port and writes it to DevToolsActivePort, so checks
  // running side by side never collide
  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch { await sleep(100); }
  }
  if (!version) { chrome.kill(); throw new Error(`Chrome did not start (looked for it at ${CHROME}; set CHROME_PATH to override)`); }
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  const handlers = {};
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    handlers[msg.method]?.(msg.params);
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description?.split('\n')[0]);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') pageErrors.push(msg.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  /** Send a DevTools command to the page, e.g. s('Emulation.setDeviceMetricsOverride', {...}) */
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  // Headless Chrome won't make its window narrower than about 500px, so set
  // the viewport directly; under 500 wide it also acts as a touch phone.
  await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  // A light computer, whatever this Mac is set to: headless Chrome can take
  // the Mac's dark setting, and the site's System theme would follow it.
  // A check that wants dark sets prefers-color-scheme itself.
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // The same "random" numbers every run (windows open at random spots), so a
  // check sees the same layout each time
  await s('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    let seed = 1999;
    Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  })()` });

  // Canned replies: pause every outside request (and the site's /api) and
  // answer it from the store. Recording, Node fetches it instead and saves
  // the reply, so a request the page gives up on is still saved.
  const misses = [];
  const recording = new Set();   // replies Node is still fetching, saved before close() ends
  if (MODE !== 'live') {
    const seen = new Map();
    const origin = new URL(appUrl.startsWith('http') ? appUrl : 'http://127.0.0.1').origin;
    const outside = (url) => !url.startsWith('data:') && !url.startsWith('blob:') && (!url.startsWith(origin) || url.startsWith(`${origin}/api/`));
    const SKIP_REQUEST_HEADERS = /^(host|origin|referer|cookie|content-length|accept-encoding|connection)$/i;
    const nodeFetch = async (request) => {
      // Our own User-Agent, as Nominatim's rules ask (it turns away HeadlessChrome from Node)
      const headers = { ...Object.fromEntries(Object.entries(request.headers).filter(([k]) => !SKIP_REQUEST_HEADERS.test(k) && !/^user-agent$/i.test(k))), 'User-Agent': 'macos-1999-check/1.0' };
      const res = await fetch(request.url, { method: request.method, headers, body: request.postData });
      const buf = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get('content-type') ?? '';
      return { status: res.status, headers: Object.fromEntries(res.headers), ...(isText(type) ? { text: buf.toString() } : { body: buf.toString('base64') }) };
    };
    handlers['Fetch.requestPaused'] = async ({ requestId, request, resourceType }) => {
      const { url, method, postData } = request;
      const fulfil = (status, headers, body) => s('Fetch.fulfillRequest', {
        requestId, responseCode: status, body,
        responseHeaders: [...Object.entries(headers).filter(([k]) => !DROP_HEADERS.has(k.toLowerCase())).map(([name, value]) => ({ name, value: String(value) })),
          { name: 'access-control-allow-origin', value: '*' }, { name: 'access-control-expose-headers', value: '*' },
          { name: 'access-control-allow-headers', value: '*' }, { name: 'access-control-allow-methods', value: '*' }]
      }).catch(() => {});
      const text = (t) => Buffer.from(t).toString('base64');
      if (!outside(url) || url.startsWith('data:')) return s('Fetch.continueRequest', { requestId }).catch(() => {});
      if (method === 'OPTIONS') return fulfil(204, {}, '');
      if (url.startsWith(`${origin}/api/`) || NEVER_RECORD.test(url)) return fulfil(503, { 'content-type': 'text/plain' }, text('canned: backend off'));
      // An embedded page (YouTube) is never saved: it gets an empty page
      if (resourceType === 'Document') return fulfil(200, { 'content-type': 'text/html' }, text('<!doctype html><title>canned</title>'));
      const media = resourceType === 'Image' || resourceType === 'Media';
      const key = keyOf(method, url, postData);
      let r;
      // Recording, pictures and video load in Chrome as usual; only their
      // status is saved, from Network.responseReceived below
      if (MODE === 'record' && media) return s('Fetch.continueRequest', { requestId }).catch(() => {});
      if (MODE === 'record') {
        const job = nodeFetch(request).catch(e => ({ status: 502, headers: { 'content-type': 'text/plain' }, text: String(e.message) }));
        recording.add(job);
        r = await job;
        recording.delete(job);
        remember(seen, key, r);
      } else {
        r = replay(seen, key);
        if (!r && !media) {
          // Fetched live once and saved: with instant replies an app can ask
          // for something its own (slower) recording never did
          const job = nodeFetch(request).catch(e => ({ status: 502, headers: { 'content-type': 'text/plain' }, text: String(e.message) }));
          recording.add(job);
          r = await job;
          recording.delete(job);
          if (r.status < 500) { remember(new Map(), key, r); filled++; misses.push(url); }
        }
        r ??= { status: 200, headers: { 'content-type': 'image/png' }, media: true };
      }
      const ok = r.status >= 200 && r.status < 300;
      return fulfil(r.status, r.media && ok && resourceType === 'Image' ? { 'content-type': 'image/png' } : r.headers,
        r.media ? (ok && resourceType === 'Image' ? PIXEL : '') : bodyOf(r));
    };
    if (MODE === 'record') {
      const asked = new Map();
      const isMedia = (type) => type === 'Image' || type === 'Media';
      handlers['Network.requestWillBeSent'] = ({ requestId, request, type }) => { if (isMedia(type) && outside(request.url)) asked.set(requestId, request.url); };
      handlers['Network.responseReceived'] = ({ requestId, type, response }) => {
        if (isMedia(type) && outside(response.url)) { asked.delete(requestId); remember(seen, keyOf('GET', response.url), { status: response.status, headers: {}, media: true }); }
      };
      // A missing picture's 404 (GitHub sends it as text) is blocked by Chrome
      // before it counts as a response, so it only shows up as a failure
      handlers['Network.loadingFailed'] = ({ requestId, canceled }) => {
        const url = asked.get(requestId);
        if (url && !canceled) remember(seen, keyOf('GET', url), { status: 404, headers: {}, media: true });
        asked.delete(requestId);
      };
      await s('Network.enable');
    }
    await s('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }, { urlPattern: `${origin}/api/*` }] });
    // The page's clock starts where the recording's did and runs on from
    // there, so "today" is the day the replies were saved
    if (MODE === 'replay' && store.recordedAt) {
      const offset = Date.parse(store.recordedAt) - Date.now();
      await s('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
        const RealDate = Date, offset = ${offset};
        const now = () => RealDate.now() + offset;
        class CannedDate extends RealDate { constructor(...a) { a.length ? super(...a) : super(now()); } static now() { return now(); } }
        globalThis.Date = CannedDate;
      })()` });
    }
  }

  await s('Page.navigate', { url: appUrl });

  /** Evaluate JS in the page and return its value (JSON-serialisable only). */
  const ev = async (expression) => {
    const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 80)} -> ${r.exceptionDetails.exception?.description}`);
    return r.result.value;
  };
  /** Poll until the expression is truthy. Wrapped in !!() so a DOM node never has to be serialised. */
  const waitFor = async (expression, label, timeout = 60000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await ev(`!!(${expression})`)) return true;
      await sleep(300);
    }
    throw new Error(`timed out waiting for ${label}`);
  };
  /**
   * Wait until the page is still: two frames drawn and no finite animation or
   * transition running. Use it instead of a fixed sleep after a click.
   */
  const settle = (timeout = 3000) => ev(`new Promise(done => {
    const end = Date.now() + ${timeout};
    const busy = () => document.getAnimations().some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
    const tick = () => requestAnimationFrame(() => requestAnimationFrame(() => (!busy() || Date.now() > end) ? done(true) : setTimeout(tick, 30)));
    tick();
  })`).catch(() => false);   // the page navigated (Restart): nothing to wait for
  if (appUrl !== 'about:blank') {
    await waitFor(`document.readyState === 'complete' && document.querySelector('.dock-item')`, 'the desktop', 20000);
    await settle();
  }

  /** PNG of the page, or of one element (at 2x) when a selector is given. Skipped unless CHECK_SHOTS=1 or force. */
  const shot = async (name, selector, { force = false } = {}) => {
    if (!SHOTS && !force) return null;
    const params = { format: 'png' };
    if (selector) {
      const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
      params.clip = { ...r, scale: 2 };
    }
    const { data } = await s('Page.captureScreenshot', params);
    const path = join(outDir, name);
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  };
  const check = (name, ok, detail = '') => {
    results.push(!!ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);
  };
  /** Type into a React-controlled input or textarea: set its value the way React notices, then fire input */
  const typeInto = (selector, text) => ev(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return 'missing';
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const clickButton = (text) => ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}))?.click() ?? 'missing'`);
  /** Click a dock icon by its label ("Field Guide", "Pokemon"...) and wait for a new window. Only for an app with no window yet: a click on an open app brings its window back (showApp). */
  const openApp = async (dockLabel) => {
    const item = `[...document.querySelectorAll('.dock-item')].find(d => d.textContent.trim() === ${JSON.stringify(dockLabel)})`;
    await waitFor(item, `dock item "${dockLabel}"`, 15000);
    const before = await ev(`document.querySelectorAll('.window').length`);
    await ev(`${item}.click()`);
    await waitFor(`document.querySelectorAll('.window').length > ${before}`, `window for "${dockLabel}"`, 10000);
    await settle();
  };
  const openFieldGuide = () => openApp('Field Guide');
  /** A real mouse drag (fires pointer events, so pointer capture works): press, move in steps, release. */
  const drag = async (x1, y1, x2, y2, steps = 8) => {
    const m = (type, x, y) => s('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
    await m('mousePressed', x1, y1);
    for (let i = 1; i <= steps; i++) await m('mouseMoved', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await m('mouseReleased', x2, y2);
    await sleep(150);   // not settle(): a check may want to see the animation it started
  };
  /** A real click at a point (pointerdown, mousedown, click), unlike element.click(). */
  const clickAt = async (x, y) => {
    await s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(150);   // not settle(): a check may want to see the animation it started
  };
  /** Grant geolocation and fake a position (Near Me). Call before the page asks. */
  const setGeolocation = async (latitude, longitude, accuracy = 50) => {
    const origin = new URL(appUrl).origin;
    await send('Browser.grantPermissions', { origin, permissions: ['geolocation'] });
    await s('Emulation.setGeolocationOverride', { latitude, longitude, accuracy });
  };
  /** Make the page's geolocation request fail as if the user said no. */
  const denyGeolocation = async () => {
    const origin = new URL(appUrl).origin;
    await send('Browser.resetPermissions');
    await send('Browser.setPermission', { origin, permission: { name: 'geolocation' }, setting: 'denied' });
  };
  /** Report the result. Pass known console noise (regexes) to leave it out of "no page errors". */
  const finish = (ignore = []) => {
    if (misses.length) console.log(`note: ${misses.length} replies had no canned copy; fetched live once and saved to fixtures/${fixtureName}.json.gz (e.g. ${misses[0].slice(0, 100)})`);
    // The canned /api answers 503, as when the backend is off: not an error
    const errors = pageErrors.filter(e => !ignore.some(re => re.test(e ?? '')) && !/status of 503/.test(e ?? ''));
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    if (results.includes(false)) process.exitCode = 1;
  };
  /** Closes Chrome. Recording, it first waits for replies still downloading, then saves them. */
  const close = async () => {
    if (recording.size) await Promise.race([Promise.allSettled([...recording]), sleep(30000)]);
    saveStore();
    try { ws?.close(); } catch { /* already closed */ }
    chrome.kill();
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still holding it */ } }, 500);
  };

  return { s, ev, waitFor, settle, shot, apiFetch, check, typeInto, clickButton, openApp, openFieldGuide, drag, clickAt, setGeolocation, denyGeolocation, finish, close, pageErrors, results, outDir };
}
