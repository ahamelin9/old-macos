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
// See know-how's checking.md, "Proving a change in a real browser".
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Chrome flags for a fake webcam (a test pattern) that needs no permission prompt */
export const FAKE_CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * Opens appUrl in a fresh headless Chrome. Screenshots go to outDir (made if
 * missing; a temp folder if omitted). Returns helpers; always call close().
 * chromeArgs adds Chrome flags, e.g. FAKE_CAMERA for a test webcam.
 */
export async function launch(appUrl, outDir, { width = 1280, height = 1000, chromeArgs = [] } = {}) {
  outDir = outDir || mkdtempSync(join(tmpdir(), 'cdp-out-'));
  mkdirSync(outDir, { recursive: true });
  const PORT = 9300 + Math.floor(Math.random() * 500);
  // The profile lives in the system temp folder and is deleted on close()
  const profile = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
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

  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
  }
  if (!version) { chrome.kill(); throw new Error(`Chrome did not start (looked for it at ${CHROME}; set CHROME_PATH to override)`); }
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
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
  await s('Page.navigate', { url: appUrl });
  await sleep(2500);

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
  /** PNG of the page, or of one element (at 2x) when a selector is given. */
  const shot = async (name, selector) => {
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
  /** Click a dock icon by its label ("Field Guide", "Pokemon"...) and wait for a new window. */
  const openApp = async (dockLabel) => {
    const item = `[...document.querySelectorAll('.dock-item')].find(d => d.textContent.trim() === ${JSON.stringify(dockLabel)})`;
    await waitFor(item, `dock item "${dockLabel}"`, 15000);
    const before = await ev(`document.querySelectorAll('.window').length`);
    await ev(`${item}.click()`);
    await waitFor(`document.querySelectorAll('.window').length > ${before}`, `window for "${dockLabel}"`, 10000);
    await sleep(300);
  };
  const openFieldGuide = () => openApp('Field Guide');
  /** A real mouse drag (fires pointer events, so pointer capture works): press, move in steps, release. */
  const drag = async (x1, y1, x2, y2, steps = 8) => {
    const m = (type, x, y) => s('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
    await m('mousePressed', x1, y1);
    for (let i = 1; i <= steps; i++) await m('mouseMoved', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await m('mouseReleased', x2, y2);
    await sleep(150);
  };
  /** A real click at a point (pointerdown, mousedown, click), unlike element.click(). */
  const clickAt = async (x, y) => {
    await s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(150);
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
    const errors = pageErrors.filter(e => !ignore.some(re => re.test(e ?? '')));
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    if (results.includes(false)) process.exitCode = 1;
  };
  const close = () => {
    try { ws?.close(); } catch { /* already closed */ }
    chrome.kill();
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still holding it */ } }, 500);
  };

  return { s, ev, waitFor, shot, check, typeInto, clickButton, openApp, openFieldGuide, drag, clickAt, setGeolocation, denyGeolocation, finish, close, pageErrors, results, outDir };
}
