// Does System Preferences work? Drives it in headless Chrome and checks that
// each setting changes what it should, at once, in windows already open;
// that each survives a reload, and that the early script in index.html had
// put it on <html> before React drew anything; that a picture upload is
// shrunk to a JPEG in IndexedDB, shows on the desktop and survives a reload;
// that a text file, a 26 MB file and a broken picture are turned away; that
// Remove Picture and Restore Defaults (with its Cancel and Escape) work; that
// the site still loads with the defaults when localStorage throws, and keeps
// an upload for the visit when IndexedDB is off; and that the window works at
// 400x300 (also at Larger text), maximized, at its 300px minimum, and
// maximized on a 390px phone, where the Dock must still fit.
//
//   node .claude/skills/know-how/preferences-check.mjs http://127.0.0.1:5199 [outDir]
//
// Run it from the repo root: it uploads public/mac-os-background.jpg.
// No outside requests. About a minute.
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5199', outDir] = process.argv.slice(2);
const KEY = 'macos-1999-settings-v1';
const PHOTO = resolve('public/mac-os-background.jpg'); // 6016x3760

const DEFAULT_ATTRS = {
  'data-wallpaper': 'photo', 'data-theme': 'system', 'data-text-size': 'medium', 'data-highlight': 'blue', 'data-dock-size': 'medium',
  'data-dock-magnify': 'true', 'data-clock': '12', 'data-clock-seconds': 'false'
};

// ---- Page helpers
const PREFS = `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Preferences')`;
const attrs = (t) => t.ev(`Object.fromEntries([...document.documentElement.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]))`);
const style = (t, selector, prop) => t.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return e ? getComputedStyle(e)[${JSON.stringify(prop)}] : null; })()`);
const saved = (t) => t.ev(`(() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); } catch { return 'blocked'; } })()`);
const desktopBackground = (t) => t.ev(`document.querySelector('.desktop').style.background`);
const clock = (t) => t.ev(`document.querySelectorAll('.menu-status .status-item')[1]?.textContent`);
const clickIn = (t, selector, text) => t.ev(`(() => {
  const b = [...${PREFS}.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.includes(${JSON.stringify(text)}));
  if (!b) return 'missing'; b.click(); return 'ok';
})()`);
const showAll = (t) => t.ev(`${PREFS}.querySelector('.preferences-show-all').click()`);
const openPane = async (t, name) => {
  await showAll(t);
  await sleep(100);
  if (await clickIn(t, '.preferences-pane-button', name) !== 'ok') throw new Error(`no pane "${name}"`);
  await t.waitFor(`${PREFS}.querySelector('.preferences-title').textContent === ${JSON.stringify(name)}`, `the ${name} pane`, 5000);
};
const choose = async (t, text) => {
  if (await clickIn(t, '.preferences-option', text) !== 'ok') throw new Error(`no choice "${text}"`);
  // The Dock eases to a new size over 0.2 s
  await sleep(450);
};
const markPrefs = (t) => t.ev(`(() => { document.querySelectorAll('[data-shot]').forEach(e => delete e.dataset.shot); ${PREFS}.dataset.shot = '1'; })()`);
const openPrefs = async (t) => {
  await t.openApp('System Preferences');
  await markPrefs(t);
};
/** Hand a file to the Desktop pane's file input, as if picked in the dialog */
const pickFile = async (t, path) => {
  const { root } = await t.s('DOM.getDocument', { depth: 0 });
  const { nodeId } = await t.s('DOM.querySelector', { nodeId: root.nodeId, selector: '.preferences-file' });
  await t.s('DOM.setFileInputFiles', { nodeId, files: [path] });
};
/** The picture saved in IndexedDB: its type and size, or null */
const storedPicture = (t) => t.ev(`new Promise(done => {
  const r = indexedDB.open('macos-1999', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('desktop');
  r.onerror = () => done('error');
  r.onsuccess = () => {
    const get = r.result.transaction('desktop').objectStore('desktop').get('picture');
    get.onsuccess = async () => {
      const blob = get.result; r.result.close();
      if (!(blob instanceof Blob)) return done(null);
      const bmp = await createImageBitmap(blob);
      done({ type: blob.type, width: bmp.width, height: bmp.height });
    };
  };
})`);
const paneMessage = (t) => t.ev(`${PREFS}.querySelector('.preferences-error')?.textContent ?? ''`);
/** Anything wider than the Preferences window, or a body that scrolls sideways */
const overflow = (t) => t.ev(`(() => {
  const w = ${PREFS}; const box = w.getBoundingClientRect();
  const body = w.querySelector('.preferences-body');
  const out = [...w.querySelectorAll('.preferences-app *')].filter(e => e.getClientRects().length)
    .filter(e => { const r = e.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; })
    .map(e => e.className || e.tagName);
  if (body.scrollWidth > body.clientWidth + 1) out.push('preferences-body scrolls sideways');
  return out.slice(0, 5);
})()`);
const hover = (t, x, y) => t.s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const dockScale = async (t) => {
  const r = await t.ev(`(() => { const b = document.querySelector('.dock-icon').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await hover(t, r.x, r.y);
  await sleep(450);
  const m = await style(t, '.dock-icon', 'transform');
  await hover(t, 700, 300);
  await sleep(450);
  return m === 'none' ? 1 : Number(m.match(/matrix\(([^,]+)/)?.[1]);
};

// Records <html>'s data-* attributes the moment <body> appears: after the
// early script in <head>, before React has drawn anything
const RECORD_EARLY = `new MutationObserver((_, obs) => {
  if (!document.body) return;
  obs.disconnect();
  window.__early = Object.fromEntries([...document.documentElement.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]));
  window.__earlyDesktop = !!document.querySelector('.desktop');
}).observe(document, { childList: true, subtree: true });`;

const reload = async (t) => {
  await t.s('Page.reload');
  await sleep(800);
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock after reload');
  await sleep(500);
};

// ================= Each setting, saving, reloading, the picture, Restore Defaults
let t = await launch(appUrl, outDir, { width: 1400, height: 900 });
const out = t.outDir;
try {
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: RECORD_EARLY });
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
  t.check('a first visit has the defaults on <html>', JSON.stringify(await attrs(t)) === JSON.stringify(DEFAULT_ATTRS), JSON.stringify(await attrs(t)));
  t.check('a first visit shows the photo', /wallpaper-photo/.test(await desktopBackground(t)));
  t.check('a first visit shows 12-hour time', /^\d{1,2}:\d{2} [AP]M$/.test(await clock(t)), await clock(t));
  t.check('nothing is saved until something changes', (await saved(t)) === null);

  // A window that was open before any change, to prove changes reach it
  await t.openApp('Finder');
  const finderSize = () => t.ev(`getComputedStyle([...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Finder').querySelector('.sidebar-item')).fontSize`);
  const finderBefore = await finderSize();

  await openPrefs(t);
  const panes = await t.ev(`[...${PREFS}.querySelectorAll('.preferences-pane-name')].map(e => e.textContent)`);
  t.check('Show All lists the four panes', panes.join() === 'Desktop,Appearance,Dock,Date & Time', panes.join());
  t.check('Show All is greyed out on the grid', await t.ev(`${PREFS}.querySelector('.preferences-show-all').disabled`));
  await t.shot('01-grid.png', '[data-shot="1"]');

  // ---- Desktop
  await openPane(t, 'Desktop');
  t.check('the pane says the picture never leaves the browser', /never uploaded/.test(await t.ev(`${PREFS}.innerText`)));
  const swatches = await t.ev(`${PREFS}.querySelectorAll('.preferences-swatch').length`);
  t.check('Desktop offers the photo and seven others', swatches === 8, swatches);
  await clickIn(t, '.preferences-swatch', 'Ripple');
  await sleep(200);
  t.check('a preset becomes the desktop', /wallpaper-ripple/.test(await desktopBackground(t)) && /radial-gradient/.test(await style(t, '.desktop', 'backgroundImage')));
  t.check('the chosen swatch is marked', await t.ev(`[...${PREFS}.querySelectorAll('.preferences-swatch')].find(b => b.textContent === 'Ripple').getAttribute('aria-pressed') === 'true'`));
  await t.shot('02-desktop-pane.png', '[data-shot="1"]');

  // ---- Appearance (dark mode has its own check: dark-mode-check.mjs)
  await openPane(t, 'Appearance');
  await choose(t, 'Larger');
  t.check('Larger sets data-text-size', (await attrs(t))['data-text-size'] === 'larger');
  const sizes = { menu: await style(t, '.mac-menu-bar', 'fontSize'), title: await style(t, '.window-title', 'fontSize'), dock: await style(t, '.dock-label', 'fontSize') };
  t.check('Larger scales the menu bar, window titles and Dock labels by 1.3', sizes.menu === '16.9px' && sizes.title === '16.9px' && sizes.dock === '14.3px', JSON.stringify(sizes));
  const finderAfter = await finderSize();
  t.check('a window already open follows at once', parseFloat(finderAfter) > parseFloat(finderBefore), `${finderBefore} -> ${finderAfter}`);
  await choose(t, 'Graphite');
  t.check('Graphite sets data-highlight', (await attrs(t))['data-highlight'] === 'graphite');
  const title = await style(t, '.window-header', 'backgroundImage');
  t.check('Graphite turns the title bar grey', /rgb\(130, 140, 154\).*rgb\(100, 110, 124\)/.test(title), title);
  t.check('Graphite turns the window buttons grey', (await style(t, '.window-close', 'backgroundColor')) === 'rgb(148, 157, 171)');
  t.check('Graphite turns a chosen radio button grey', /rgb\(153, 162, 175\)/.test(await t.ev(`getComputedStyle(${PREFS}.querySelector('.preferences-radio:checked')).backgroundImage`)));
  await t.shot('03-appearance-larger-graphite.png', '[data-shot="1"]');
  await t.shot('03b-desktop-larger-graphite.png');
  // Dark last, as the Graphite checks above read light's title bar
  if (await clickIn(t, '.preferences-theme', 'Dark') !== 'ok') throw new Error('no Dark tile');
  await sleep(150);
  t.check('Dark sets data-theme and darkens the window', (await attrs(t))['data-theme'] === 'dark' && (await style(t, '.window-content', 'backgroundColor')) !== 'rgb(255, 255, 255)');

  // ---- Dock
  await openPane(t, 'Dock');
  await choose(t, 'Small');
  t.check('Small Dock icons are 36px', (await style(t, '.dock-icon', 'width')) === '36px');
  await choose(t, 'Large');
  t.check('Large Dock icons are 64px', (await style(t, '.dock-icon', 'width')) === '64px');
  t.check('icons magnify under the pointer', Math.abs(await dockScale(t) - 1.3) < 0.01);
  await choose(t, 'Icons grow');
  t.check('Magnification off: icons stay their size', (await dockScale(t)) === 1);
  t.check('…and data-dock-magnify says so', (await attrs(t))['data-dock-magnify'] === 'false');
  await t.shot('04-dock.png');

  // ---- Date & Time
  await openPane(t, 'Date & Time');
  await choose(t, '24-hour');
  await sleep(1100);
  t.check('24-hour time in the menu bar', /^\d{2}:\d{2}$/.test(await clock(t)), await clock(t));
  await choose(t, 'Show seconds');
  await sleep(1100);
  t.check('seconds in the menu bar', /^\d{2}:\d{2}:\d{2}$/.test(await clock(t)), await clock(t));

  const CHANGED = { wallpaper: 'ripple', theme: 'dark', textSize: 'larger', highlight: 'graphite', dockSize: 'large', dockMagnify: false, clock: '24', clockSeconds: true };
  t.check('saved as one JSON value under the versioned key', JSON.stringify(await saved(t)) === JSON.stringify(CHANGED), JSON.stringify(await saved(t)));

  // ---- Reload
  const before = await attrs(t);
  await reload(t);
  const early = await t.ev('window.__early');
  t.check('the early script set every setting before React drew', JSON.stringify(early) === JSON.stringify(before) && !(await t.ev('window.__earlyDesktop')), JSON.stringify(early));
  t.check('after a reload: the same attributes', JSON.stringify(await attrs(t)) === JSON.stringify(before));
  t.check('after a reload: Ripple on the desktop', /wallpaper-ripple/.test(await desktopBackground(t)));
  t.check('after a reload: Larger text', (await style(t, '.mac-menu-bar', 'fontSize')) === '16.9px');
  t.check('after a reload: a Large Dock that does not magnify', (await style(t, '.dock-icon', 'width')) === '64px' && (await dockScale(t)) === 1);
  t.check('after a reload: 24-hour time with seconds', /^\d{2}:\d{2}:\d{2}$/.test(await clock(t)), await clock(t));
  await t.shot('05-after-reload.png');

  // ---- Upload a picture
  await openPrefs(t);
  await openPane(t, 'Desktop');
  await pickFile(t, PHOTO);
  await t.waitFor(`/blob:/.test(document.querySelector('.desktop').style.background)`, 'the picture on the desktop', 20000);
  t.check('an upload shows on the desktop', true);
  t.check('…and as the chosen swatch', await t.ev(`[...${PREFS}.querySelectorAll('.preferences-swatch')].find(b => b.textContent === 'Your Picture')?.getAttribute('aria-pressed') === 'true'`));
  const stored = await storedPicture(t);
  t.check('it is kept in IndexedDB as a JPEG, shrunk to 2560 wide', stored?.type === 'image/jpeg' && stored.width === 2560 && stored.height === 1600, JSON.stringify(stored));
  t.check('Remove Picture is offered', (await clickIn(t, 'button', 'Remove Picture')) === 'ok');
  await t.waitFor(`/wallpaper-photo/.test(document.querySelector('.desktop').style.background)`, 'the photo back', 5000);
  t.check('Remove Picture puts the photo back and empties IndexedDB', (await storedPicture(t)) === null && (await saved(t)).wallpaper === 'photo');
  t.check('…and its swatch goes', !(await t.ev(`[...${PREFS}.querySelectorAll('.preferences-swatch')].some(b => b.textContent === 'Your Picture')`)));
  await reload(t);
  t.check('…and it stays that way after a reload', /wallpaper-photo/.test(await desktopBackground(t)));
  // Upload it again, for the reload and Restore Defaults checks
  await openPrefs(t);
  await openPane(t, 'Desktop');
  await pickFile(t, PHOTO);
  await t.waitFor(`/blob:/.test(document.querySelector('.desktop').style.background)`, 'the picture again', 20000);
  await t.shot('06-upload.png');
  await reload(t);
  await t.waitFor(`/blob:/.test(document.querySelector('.desktop').style.background)`, 'the picture after reload', 10000);
  t.check('an upload survives a reload', true);
  await t.shot('07-upload-after-reload.png');

  // ---- Files it turns away
  await openPrefs(t);
  await openPane(t, 'Desktop');
  const text = join(out, 'notes.txt'), huge = join(out, 'huge.jpg'), broken = join(out, 'broken.png');
  writeFileSync(text, 'not a picture');
  writeFileSync(huge, Buffer.alloc(26 * 1024 * 1024));
  writeFileSync(broken, Buffer.from('this is not really a PNG'));
  for (const [file, expect, name] of [[text, /isn't a picture/, 'a text file'], [huge, /26 MB/, 'a 26 MB file'], [broken, /couldn't be opened/, 'a broken picture']]) {
    await pickFile(t, file);
    await t.waitFor(`${expect}.test(${PREFS}.querySelector('.preferences-error')?.textContent ?? '')`, `the message for ${name}`, 10000).catch(() => {});
    const msg = await paneMessage(t);
    t.check(`turns away ${name}, saying why, and keeps the picture`, expect.test(msg) && /blob:/.test(await desktopBackground(t)), msg);
  }
  await t.shot('08-turned-away.png', '[data-shot="1"]');

  // ---- Restore Defaults
  await showAll(t);
  await clickIn(t, 'button', 'Restore Defaults');
  await t.waitFor(`${PREFS}.querySelector('.preferences-sheet')`, 'the sheet', 3000);
  t.check('the sheet focuses Cancel', await t.ev(`document.activeElement?.textContent === 'Cancel'`));
  // It slides down for 0.2 s; a shot before then shows only its buttons
  await sleep(400);
  t.check('the sheet shows its question', await t.ev(`(() => { const q = ${PREFS}.querySelector('.preferences-sheet-title').getBoundingClientRect(), s = ${PREFS}.querySelector('.preferences-sheet-backdrop').getBoundingClientRect(); return q.top >= s.top && q.height > 0; })()`));
  await t.shot('09-sheet.png', '[data-shot="1"]');
  await t.s('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(200);
  t.check('Escape closes the sheet and changes nothing', !(await t.ev(`!!${PREFS}.querySelector('.preferences-sheet')`)) && (await attrs(t))['data-text-size'] === 'larger');
  await clickIn(t, 'button', 'Restore Defaults');
  await sleep(300);
  await clickIn(t, '.preferences-sheet button', 'Cancel');
  await sleep(200);
  t.check('Cancel changes nothing', (await attrs(t))['data-highlight'] === 'graphite' && /blob:/.test(await desktopBackground(t)));
  await clickIn(t, 'button', 'Restore Defaults');
  await sleep(300);
  await clickIn(t, '.preferences-sheet .mac-button-primary', 'Restore Defaults');
  await t.waitFor(`!${PREFS}.querySelector('.preferences-sheet')`, 'the sheet to close', 5000);
  await sleep(300);
  t.check('Restore Defaults puts every setting back', JSON.stringify(await attrs(t)) === JSON.stringify(DEFAULT_ATTRS), JSON.stringify(await attrs(t)));
  t.check('…removes the picture and the saved settings', /wallpaper-photo/.test(await desktopBackground(t)) && (await storedPicture(t)) === null && (await saved(t)) === null);
  t.check('…and the clock is 12-hour again', /^\d{1,2}:\d{2} [AP]M$/.test(await clock(t)));
  await t.shot('10-restored.png');
  await reload(t);
  t.check('…and stays that way after a reload', JSON.stringify(await attrs(t)) === JSON.stringify(DEFAULT_ATTRS) && /wallpaper-photo/.test(await desktopBackground(t)));
} catch (e) { t.check('script', false, e.message); }
finally { t.finish(); t.close(); }

// ================= Storage switched off: localStorage and IndexedDB both throw
const BLOCK = `for (const name of ['localStorage', 'indexedDB']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });`;
t = await launch(appUrl, out, { width: 1400, height: 900 });
try {
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: BLOCK });
  await reload(t);
  t.check('blocked storage: the site loads with the defaults', JSON.stringify(await attrs(t)) === JSON.stringify(DEFAULT_ATTRS) && /wallpaper-photo/.test(await desktopBackground(t)));
  await openPrefs(t);
  await openPane(t, 'Appearance');
  await choose(t, 'Large');
  t.check('blocked storage: a change still applies for the visit', (await attrs(t))['data-text-size'] === 'large');
  t.check('…and the window says it won\'t be kept', /won't keep settings/.test(await t.ev(`${PREFS}.innerText`)));
  await openPane(t, 'Desktop');
  t.check('blocked IndexedDB: the Desktop pane says pictures last only this visit', /can't keep pictures/.test(await t.ev(`${PREFS}.innerText`)));
  await pickFile(t, PHOTO);
  await t.waitFor(`/blob:/.test(document.querySelector('.desktop').style.background)`, 'the picture', 20000);
  t.check('blocked IndexedDB: an upload still shows for the visit', true);
  await t.shot('11-storage-blocked.png');
} catch (e) { t.check('script', false, e.message); }
finally { t.finish(); t.close(); }

// ================= Sizes: 400x300, at Larger, maximized, the 300px minimum
t = await launch(appUrl, out, { width: 1400, height: 900 });
const views = ['Desktop', 'Appearance', 'Dock', 'Date & Time'];
const slug = (s) => s.replace(/\W+/g, '-').toLowerCase();
const eachView = async (t, label) => {
  await showAll(t);
  await sleep(150);
  const grid = await overflow(t);
  t.check(`${label}: Show All fits`, grid.length === 0, grid.join(', '));
  await t.shot(`${slug(`${label}-grid`)}.png`, '[data-shot="1"]');
  for (const v of views) {
    await openPane(t, v);
    const o = await overflow(t);
    t.check(`${label}: ${v} fits`, o.length === 0, o.join(', '));
    await t.shot(`${slug(`${label}-${v}`)}.png`, '[data-shot="1"]');
  }
};
try {
  await openPrefs(t);
  const size = await t.ev(`(() => { const r = ${PREFS}.getBoundingClientRect(); return r.width + 'x' + r.height; })()`);
  t.check('it opens 400x300', size === '400x300', size);
  await eachView(t, 'small');
  await t.ev(`localStorage.setItem(${JSON.stringify(KEY)}, '{"textSize":"larger"}')`);
  await reload(t);
  await openPrefs(t);
  await eachView(t, 'small-larger');
  await t.ev(`localStorage.removeItem(${JSON.stringify(KEY)})`);
  await reload(t);
  await openPrefs(t);
  await t.ev(`${PREFS}.querySelector('.window-maximize').click()`);
  await sleep(300);
  await eachView(t, 'max');
  await t.ev(`${PREFS}.querySelector('.window-maximize').click()`);
  await sleep(300);
  // Drag the resize handle to the 300px minimum: the narrow layout
  const r = await t.ev(`(() => { const b = ${PREFS}.getBoundingClientRect(); return { x: b.right - 6, y: b.bottom - 6 }; })()`);
  await t.drag(r.x, r.y, r.x - 150, r.y);
  const narrow = await t.ev(`${PREFS}.getBoundingClientRect().width`);
  t.check('the window narrows to 300px', narrow === 300, narrow);
  await showAll(t);
  await sleep(150);
  t.check('narrow: group names sit above their icons', (await t.ev(`getComputedStyle(${PREFS}.querySelector('.preferences-group')).flexDirection`)) === 'column');
  await eachView(t, 'narrow');
} catch (e) { t.check('script', false, e.message); }
finally { t.finish(); t.close(); }

// ================= A 390px phone. The phone Dock leaves out System
// Preferences, so it is opened 800px wide, then the screen narrows.
t = await launch(appUrl, out, { width: 800, height: 844 });
try {
  await openPrefs(t);
  await t.s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  await t.ev(`${PREFS}.querySelector('.window-maximize').click()`);
  await sleep(300);
  const w = await t.ev(`${PREFS}.getBoundingClientRect().width`);
  t.check('phone: maximized, it is the screen\'s width', w === 390, w);
  await eachView(t, 'phone');
  // The Dock at each size: never wider than at Medium (it was 402px before any of this)
  const dockWidth = () => t.ev(`Math.round(document.querySelector('.dock').getBoundingClientRect().width)`);
  await openPane(t, 'Dock');
  const medium = await dockWidth();
  await choose(t, 'Large');
  t.check('phone: Large stays Medium, so five apps fit as before', (await style(t, '.dock-icon', 'width')) === '48px' && (await dockWidth()) === medium, `${await dockWidth()} vs ${medium}`);
  await choose(t, 'Small');
  t.check('phone: a Small Dock fits inside the screen', (await dockWidth()) <= 390, await dockWidth());
  await t.shot('phone-dock-small.png');
  await choose(t, 'Medium');
} catch (e) { t.check('script', false, e.message); }
finally { t.finish(); t.close(); }
console.log(`screenshots: ${out}`);
