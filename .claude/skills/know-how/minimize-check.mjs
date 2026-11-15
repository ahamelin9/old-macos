// Does minimize work as in Mac OS X? Drives the site in headless Chrome with
// real mouse, key and touch events, pass/fail only (no screenshots), and
// checks that:
//   - a minimized window stays mounted but hidden: invisible, inert and
//     aria-hidden, and never the front window; Notes keeps its typed text and
//     its very same textarea through minimize and restore;
//   - its Dock tile sits after the divider, just left of the Trash, with the
//     app's icon on a small window and the window's title as its label, and a
//     click on it restores the window in front;
//   - the triangle under an app's icon shows while it has a window (minimized
//     too) and goes when the last one closes;
//   - a click on an app's Dock icon brings its window back (from minimized, or
//     from behind) instead of opening a second one;
//   - the Scale effect: mid-way the window is still visible and part-shrunk,
//     at the end it sits on its tile, hidden; it grows back out on restore;
//     with reduced motion it is instant;
//   - double-clicking the title bar minimizes;
//   - the window buttons are 14px gems whose ×, − and + show only while the
//     pointer is over the group, all three at once; a background window's are
//     grey until hovered; Graphite makes all three grey; dark keeps them;
//   - Music's <audio> keeps playing through minimize and restore, the same
//     element, not reset;
//   - Camera's webcam tracks stop while it is minimized and start again on
//     restore;
//   - Field Guide keeps its search text, and its map is the same size, drawn
//     to its right edge, after a restore (Near Me faked at Portland);
//   - on a 390px touch phone: three minimized windows fold into one tile
//     with a count, the Dock fits on screen, a tap restores the newest, an
//     app's icon restores its own, the buttons show their glyphs and have
//     hit boxes about 30px wide.
//
//   node .claude/skills/know-how/minimize-check.mjs http://127.0.0.1:5173
//
// About a minute. Outside requests: Field Guide's Near Me load (iNaturalist,
// Nominatim, map tiles) and NASA's picture of the day on the phone.
import { launch, sleep, FAKE_CAMERA } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5173'] = process.argv.slice(2);
// The Scale effect takes 250ms (Window/styles.css); wait a little longer
const SETTLE = 450;

// ---- Page helpers
const win = (title) => `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)})`;
const inWin = (title, selector) => `${win(title)}?.querySelector(${JSON.stringify(selector)})`;
const dockItem = (label) => `[...document.querySelectorAll('.dock-item:not(.minimized-window)')].find(d => d.querySelector('.dock-label')?.textContent === ${JSON.stringify(label)})`;
const tileFor = (title) => `document.querySelector('.dock [data-window-ids~="' + ${win(title)}?.dataset.windowId + '"]')`;
const count = (t, title) => t.ev(`[...document.querySelectorAll('.window')].filter(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)}).length`);
const isMinimized = (t, title) => t.ev(`!!${win(title)}?.classList.contains('window-minimized')`);
const box = (t, expr) => t.ev(`(() => { const b = (${expr}).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; })()`);
const moveTo = (t, x, y) => t.s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const minimize = async (t, title) => { await t.ev(`${inWin(title, '.window-minimize')}.click()`); await sleep(SETTLE); };
const closeAll = async (t) => { await t.ev(`document.querySelectorAll('.window-close').forEach(b => b.click())`); await sleep(300); };
/** The scale a transform applies, from its matrix (1 for none) */
const scaleOf = (t, expr) => t.ev(`(() => { const m = getComputedStyle(${expr}).transform; return m === 'none' ? 1 : new DOMMatrix(m).a; })()`);
const css = (t, expr, prop) => t.ev(`getComputedStyle(${expr})[${JSON.stringify(prop)}]`);
/** A token's value on <html>, as the rgb() string getComputedStyle gives for a colour */
const tokenRgb = (t, name) => t.ev(`(() => {
  const probe = document.createElement('div');
  probe.style.color = 'var(${name})';
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
})()`);
const ink = (t, selector) => t.ev(`(() => {
  const b = document.querySelector('.window.window-active ${selector}');
  const probe = document.createElement('div');
  probe.style.color = getComputedStyle(b).getPropertyValue('--window-ink');
  b.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
})()`);
/** Whether each of a window's three buttons draws its glyph now */
const glyphsShown = async (t, windowExpr) => {
  const out = [];
  for (const sel of ['.window-close', '.window-minimize', '.window-maximize']) {
    const colour = await t.ev(`(() => {
      const b = (${windowExpr}).querySelector('${sel}');
      const probe = document.createElement('div');
      probe.style.color = getComputedStyle(b).getPropertyValue('--window-ink');
      b.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    })()`);
    out.push(await t.ev(`getComputedStyle((${windowExpr}).querySelector('${sel}')).backgroundImage.includes(${JSON.stringify(colour)})`));
  }
  return out;
};

// ================= Laptop
let t = await launch(appUrl, undefined, {
  width: 1400, height: 900,
  chromeArgs: [...FAKE_CAMERA, '--autoplay-policy=no-user-gesture-required']
});
try {
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
  await t.ev(`localStorage.removeItem('notes_text')`);

  // ---- Notes: state, the tile, the triangle, hidden but mounted
  t.check('no triangle under Notes before it opens', !(await t.ev(`!!${dockItem('Notes')}.querySelector('.dock-running')`)));
  await t.openApp('Notes');
  t.check('a triangle under Notes once it has a window', await t.ev(`!!${dockItem('Notes')}.querySelector('.dock-running')`));
  await t.typeInto('.notes-textarea', 'kept through minimize');
  await t.ev(`document.querySelector('.notes-textarea').dataset.probe = '1'`);
  const before = await box(t, win('Notes'));
  await minimize(t, 'Notes');
  t.check('minimize keeps the window in the page', (await count(t, 'Notes')) === 1 && (await isMinimized(t, 'Notes')));
  t.check('a minimized window is hidden, inert and aria-hidden', await t.ev(`(() => { const w = ${win('Notes')}; return getComputedStyle(w).visibility === 'hidden' && w.inert && w.getAttribute('aria-hidden') === 'true'; })()`));
  t.check('nothing on screen belongs to it', !(await t.ev(`${win('Notes')}.contains(document.elementFromPoint(${before.cx}, ${before.cy}))`)));
  t.check('it never counts as the front window', !(await t.ev(`${win('Notes')}.classList.contains('window-active')`)) && (await t.ev(`${win('Notes')}.style.zIndex`)) === '');
  t.check('the triangle stays while it is minimized', await t.ev(`!!${dockItem('Notes')}.querySelector('.dock-running')`));

  const tile = tileFor('Notes');
  t.check('its Dock tile has the Notes icon on a small window', await t.ev(`${tile}?.querySelector('.dock-thumb-window img')?.getAttribute('src') === '/notes-icon.png'`));
  t.check('the tile is labelled with the window\'s title', (await t.ev(`${tile}?.querySelector('.dock-label')?.textContent`)) === 'Notes');
  t.check('the icon has loaded', await t.ev(`${tile}.querySelector('img').naturalWidth > 0`));
  const order = await t.ev(`(() => {
    const kids = [...document.querySelector('.dock').children];
    const at = (el) => kids.indexOf(el);
    return { divider: at(document.querySelector('.dock-divider')), tile: at(${tile}), trash: at(${dockItem('Trash')}), last: kids.length - 1 };
  })()`);
  t.check('it sits after the divider, just left of the Trash', order.divider < order.tile && order.tile === order.trash - 1 && order.trash === order.last, JSON.stringify(order));
  const [d, tl, tr] = [await box(t, `document.querySelector('.dock-divider')`), await box(t, `${tile}`), await box(t, dockItem('Trash'))];
  t.check('and on screen too: divider, tile, Trash, left to right', d.right <= tl.x && tl.right <= tr.x, `${Math.round(d.right)} ${Math.round(tl.x)}-${Math.round(tl.right)} ${Math.round(tr.x)}`);

  // The Scale effect landed on the tile
  const landed = await box(t, win('Notes'));
  const icon = await box(t, `${tile}.querySelector('.dock-icon')`);
  t.check('the Scale effect ends with the window on its tile', Math.abs(landed.cx - icon.cx) <= 3 && Math.abs(landed.cy - icon.cy) <= 3 && landed.w <= icon.w + 1,
    `window ${Math.round(landed.cx)},${Math.round(landed.cy)} ${Math.round(landed.w)}w; tile ${Math.round(icon.cx)},${Math.round(icon.cy)} ${Math.round(icon.w)}w`);

  // Restoring from the tile
  await t.ev(`${tile}.click()`);
  await sleep(120);
  const midGrow = await scaleOf(t, win('Notes'));
  t.check('restoring grows it back out of the Dock (part-way at 120ms)', midGrow > 0.12 && midGrow < 1 && (await css(t, win('Notes'), 'visibility')) === 'visible', midGrow.toFixed(2));
  await sleep(SETTLE);
  t.check('the tile click restores it in front, where it was', !(await isMinimized(t, 'Notes')) && (await t.ev(`${win('Notes')}.classList.contains('window-active')`))
    && (await scaleOf(t, win('Notes'))) === 1 && Math.abs((await box(t, win('Notes'))).x - before.x) <= 1);
  t.check('Notes kept its text and its very same textarea', await t.ev(`(() => { const a = document.querySelector('.notes-textarea'); return a.value === 'kept through minimize' && a.dataset.probe === '1'; })()`));
  t.check('its tile has gone', !(await t.ev(`!!document.querySelector('.dock .minimized-window')`)));

  // Mid-way through minimizing
  await t.ev(`${inWin('Notes', '.window-minimize')}.click()`);
  await sleep(120);
  const midShrink = await scaleOf(t, win('Notes'));
  t.check('minimizing shrinks it (part-way and still visible at 120ms)', midShrink > 0.12 && midShrink < 1 && (await css(t, win('Notes'), 'visibility')) === 'visible', midShrink.toFixed(2));
  await sleep(SETTLE);

  // ---- The Dock's app icons use showApp
  await t.ev(`${dockItem('Notes')}.click()`);
  await sleep(SETTLE);
  t.check('a Dock click on Notes restores the minimized window, no second one', (await count(t, 'Notes')) === 1 && !(await isMinimized(t, 'Notes'))
    && (await t.ev(`${win('Notes')}.classList.contains('window-active')`)));
  await t.openApp('Finder');
  await t.ev(`${dockItem('Notes')}.click()`);
  await sleep(200);
  t.check('a Dock click on an app behind brings its window to the front', (await count(t, 'Notes')) === 1 && (await t.ev(`${win('Notes')}.classList.contains('window-active')`)));
  await t.ev(`${dockItem('Notes')}.click()`);
  await sleep(200);
  t.check('a Dock click on the front app does nothing more', (await count(t, 'Notes')) === 1);

  // ---- Double-click the title bar
  const bar = await box(t, inWin('Notes', '.window-header'));
  for (const clickCount of [1, 2]) {
    await t.s('Input.dispatchMouseEvent', { type: 'mousePressed', x: bar.cx, y: bar.cy, button: 'left', buttons: 1, clickCount });
    await t.s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bar.cx, y: bar.cy, button: 'left', buttons: 0, clickCount });
  }
  await sleep(SETTLE);
  t.check('double-clicking the title bar minimizes', await isMinimized(t, 'Notes'));
  t.check('the window behind becomes the front one', await t.ev(`${win('Finder')}.classList.contains('window-active')`));
  await t.ev(`${tileFor('Notes')}.click()`);
  await sleep(SETTLE);
  t.check('one click on the title bar does not', await (async () => {
    const b = await box(t, inWin('Notes', '.window-header'));
    await t.clickAt(b.cx, b.cy);
    await sleep(SETTLE);
    return !(await isMinimized(t, 'Notes'));
  })());

  // ---- Reduced motion: instant
  await t.s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await t.ev(`${inWin('Notes', '.window-minimize')}.click()`);
  await sleep(30);
  t.check('with reduced motion it hides at once, with no Scale effect', (await css(t, win('Notes'), 'visibility')) === 'hidden' && (await css(t, win('Notes'), 'transitionDuration')).split(',').every(s => parseFloat(s) === 0));
  await t.ev(`${tileFor('Notes')}.click()`);
  await sleep(30);
  t.check('and comes back at once', (await css(t, win('Notes'), 'visibility')) === 'visible' && (await scaleOf(t, win('Notes'))) === 1);
  await t.s('Emulation.setEmulatedMedia', { features: [] });

  // ---- The window buttons
  const front = `document.querySelector('.window.window-active')`;
  const back = win('Finder');
  const gem = await box(t, `${front}.querySelector('.window-close')`);
  t.check('the buttons are 14px gems', Math.round(gem.w) === 14 && Math.round(gem.h) === 14, `${gem.w}x${gem.h}`);
  await moveTo(t, 700, 600);
  await sleep(100);
  t.check('no glyphs while the pointer is elsewhere', (await glyphsShown(t, front)).every(s => !s));
  const minBtn = await box(t, `${front}.querySelector('.window-minimize')`);
  await moveTo(t, minBtn.cx, minBtn.cy);
  await sleep(100);
  t.check('over one button, all three show their glyphs', (await glyphsShown(t, front)).every(Boolean), JSON.stringify(await glyphsShown(t, front)));
  t.check('each glyph a darker shade of its own button', (await ink(t, '.window-close')) !== (await ink(t, '.window-minimize')) && (await ink(t, '.window-minimize')) !== (await ink(t, '.window-maximize')));
  await moveTo(t, 700, 600);
  await sleep(100);
  t.check('and they go again when it leaves', (await glyphsShown(t, front)).every(s => !s));

  const idle = await tokenRgb(t, '--color-control-idle');
  const red = await tokenRgb(t, '--color-close');
  t.check('the front window\'s close button is red', (await css(t, `${front}.querySelector('.window-close')`, 'backgroundColor')) === red, red);
  const backColours = [];
  for (const sel of ['.window-close', '.window-minimize', '.window-maximize']) backColours.push(await css(t, `${back}.querySelector('${sel}')`, 'backgroundColor'));
  t.check('a background window\'s buttons are plain grey', backColours.every(c => c === idle), `${backColours.join(' ')} vs ${idle}`);
  const backClose = await box(t, `${back}.querySelector('.window-close')`);
  // Finder may sit under Notes; hover a spot of its buttons that is on top
  const hoverable = await t.ev(`${back}.querySelector('.window-close').contains(document.elementFromPoint(${backClose.cx}, ${backClose.cy}))`);
  if (hoverable) {
    await moveTo(t, backClose.cx, backClose.cy);
    await sleep(100);
    t.check('they turn colour, with glyphs, while hovered', (await css(t, `${back}.querySelector('.window-close')`, 'backgroundColor')) === red && (await glyphsShown(t, back)).every(Boolean));
    await moveTo(t, 700, 600);
  } else {
    t.check('found Finder\'s buttons on top to hover', false);
  }

  await t.ev(`document.documentElement.dataset.highlight = 'graphite'`);
  await sleep(100);
  const graphite = [];
  for (const sel of ['.window-close', '.window-minimize', '.window-maximize']) graphite.push(await css(t, `${front}.querySelector('${sel}')`, 'backgroundColor'));
  const grey = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return Math.max(r, g, b) - Math.min(r, g, b) < 30; };
  t.check('Graphite: all three buttons grey', graphite.every(c => c === graphite[0]) && grey(graphite[0]), graphite.join(' '));
  await t.ev(`document.documentElement.dataset.highlight = 'blue'; document.documentElement.dataset.theme = 'dark'`);
  await sleep(100);
  const darkIdle = await tokenRgb(t, '--color-control-idle');
  t.check('dark: the front window keeps its red, the background one a lighter grey', (await css(t, `${front}.querySelector('.window-close')`, 'backgroundColor')) === red
    && (await css(t, `${back}.querySelector('.window-close')`, 'backgroundColor')) === darkIdle && darkIdle !== idle, darkIdle);
  await t.ev(`document.documentElement.dataset.highlight = 'graphite'`);
  await sleep(100);
  t.check('dark Graphite: grey', grey(await css(t, `${front}.querySelector('.window-close')`, 'backgroundColor')));
  await t.ev(`document.documentElement.dataset.highlight = 'blue'; document.documentElement.dataset.theme = 'light'`);
  await closeAll(t);
  t.check('the triangle goes when its last window closes', !(await t.ev(`!!${dockItem('Notes')}.querySelector('.dock-running')`)));

  // ---- Music keeps playing
  await t.openApp('Music');
  await t.ev(`(() => { const a = ${inWin('Music', 'audio')}; a.dataset.probe = '1'; a.muted = true; a.src = '/Music/i-love-you-forever.mp3'; return a.play(); })()`);
  await t.waitFor(`${inWin('Music', 'audio')}.currentTime > 0.3`, 'the track playing', 10000);
  await minimize(t, 'Music');
  const t1 = await t.ev(`${inWin('Music', 'audio')}.currentTime`);
  await sleep(1000);
  const playing = await t.ev(`(() => { const a = ${inWin('Music', 'audio')}; return { paused: a.paused, time: a.currentTime, probe: a.dataset.probe }; })()`);
  t.check('Music keeps playing while minimized', !playing.paused && playing.time > t1 + 0.5 && playing.probe === '1', `${t1.toFixed(1)}s -> ${playing.time.toFixed(1)}s`);
  await t.ev(`${tileFor('Music')}.click()`);
  await sleep(SETTLE);
  const after = await t.ev(`(() => { const a = ${inWin('Music', 'audio')}; return { paused: a.paused, time: a.currentTime, probe: a.dataset.probe }; })()`);
  t.check('and after a restore: the same <audio>, not paused or reset', !after.paused && after.time >= playing.time && after.probe === '1', `${after.time.toFixed(1)}s`);
  await closeAll(t);

  // ---- Camera's webcam is off while minimized
  await t.ev(`(() => {
    window.__streams = [];
    const md = navigator.mediaDevices, get = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await get(c); window.__streams.push(s); return s; };
  })()`);
  const live = `window.__streams.flatMap(s => s.getTracks()).filter(tr => tr.readyState === 'live').length`;
  await t.openApp('Camera');
  await t.waitFor(`${inWin('Camera', 'video')}?.videoWidth > 0`, 'the camera picture', 15000);
  t.check('Camera is on', (await t.ev(live)) > 0);
  await minimize(t, 'Camera');
  t.check('minimized, every webcam track has stopped', (await t.ev(live)) === 0 && (await t.ev(`window.__streams.length`)) >= 1);
  await t.ev(`${tileFor('Camera')}.click()`);
  await t.waitFor(`${inWin('Camera', 'video')}?.videoWidth > 0 && ${live} > 0`, 'the camera picture again', 15000);
  t.check('restored, the webcam is on again and the picture back', true);
  await closeAll(t);
  t.check('closed, it is off', (await t.ev(live)) === 0);

  // ---- Field Guide: its search text and its map
  await t.setGeolocation(45.5152, -122.6784);
  await t.openApp('Field Guide');
  await t.ev(`${inWin('Field Guide (Flora & Fauna)', '.window-maximize')}.click()`);
  await t.waitFor(`/Portland/.test(document.querySelector('.location-badge')?.textContent)`, 'Near Me finding Portland', 60000);
  await t.clickButton('Show Map');
  await t.waitFor(`document.querySelectorAll('.leaflet-tile-loaded').length > 3`, 'map tiles', 30000);
  await sleep(800);
  const mapSize = () => t.ev(`(() => { const m = document.querySelector('.leaflet-container'); return m.clientWidth + 'x' + m.clientHeight; })()`);
  const drawnToEdge = () => t.ev(`(() => {
    const m = document.querySelector('.leaflet-container').getBoundingClientRect();
    const x = m.right - 6, y = m.top + m.height / 2;
    return [...document.querySelectorAll('.leaflet-tile-loaded')].some(i => { const r = i.getBoundingClientRect(); return r.left <= x && r.right >= x && r.top <= y && r.bottom >= y; });
  })()`);
  const size0 = await mapSize();
  t.check('the map is drawn to its right edge', await drawnToEdge(), size0);
  await t.typeInto('.fieldguide-search-input', 'kept search');
  await t.ev(`document.querySelector('.fieldguide-search-input').dataset.probe = '1'`);
  await minimize(t, 'Field Guide (Flora & Fauna)');
  t.check('minimized, the map keeps its size (Leaflet never sees it shrink)', (await mapSize()) === size0, await mapSize());
  await t.ev(`${tileFor('Field Guide (Flora & Fauna)')}.click()`);
  await sleep(SETTLE + 300);
  t.check('Field Guide keeps its search text, in the same box', await t.ev(`(() => { const i = document.querySelector('.fieldguide-search-input'); return i.value === 'kept search' && i.dataset.probe === '1'; })()`));
  t.check('restored, the map is the same size and drawn to its right edge', (await mapSize()) === size0 && (await drawnToEdge()), await mapSize());
  t.check('and Near Me\'s place is still shown', await t.ev(`/Portland/.test(document.querySelector('.location-badge')?.textContent)`));
} catch (e) {
  t.check('laptop script', false, e.message);
} finally {
  // Music's backend is usually off during a check; map tiles and iNaturalist can 404 or 429
  t.finish([/Failed to load resource/, /Guest fetch error/]);
  t.close();
}

// ================= A 390px phone with touch
t = await launch(appUrl, undefined, { width: 390, height: 844 });
try {
  await t.s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await t.s('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }, { name: 'any-pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' }] }).catch(() => {});
  t.check('(the page sees a touch screen)', await t.ev(`matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches`));
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
  const dockFits = async () => {
    const r = await t.ev(`(() => {
      const d = document.querySelector('.dock').getBoundingClientRect();
      const items = [...document.querySelectorAll('.dock-item')].map(i => i.getBoundingClientRect());
      return { left: d.left, right: d.right, items: items.every(i => i.left >= 0 && i.right <= innerWidth) };
    })()`);
    return { ok: r.left >= 0 && r.right <= 390 && r.items, detail: `${Math.round(r.left)}-${Math.round(r.right)}` };
  };
  const fit0 = await dockFits();
  t.check('the five-app Dock fits a 390px screen', fit0.ok, fit0.detail);
  for (const app of ['Finder', 'Safari', 'Nasa News']) await t.openApp(app);

  // The buttons on a touch screen
  const front = `document.querySelector('.window.window-active')`;
  t.check('the front window shows its glyphs (no hover on a phone)', (await glyphsShown(t, front)).every(Boolean));
  const c = await box(t, `${front}.querySelector('.window-close')`);
  const m = await box(t, `${front}.querySelector('.window-minimize')`);
  const hits = await t.ev(`(() => {
    const w = ${front};
    const at = (x, y) => document.elementFromPoint(x, y)?.className;
    return [at(${c.cx + 13}, ${c.cy}), at(${m.cx - 13}, ${m.cy}), at(${m.cx + 13}, ${m.cy}), at(${c.cx}, ${c.cy + 11}), at(${c.cx - 10}, ${c.cy})];
  })()`);
  t.check('each button\'s hit box is about 30px wide and fills the title bar', hits.join() === 'window-close,window-minimize,window-minimize,window-close,window-close', hits.join(', '));

  for (const app of ['Finder', 'Safari', 'Nasa News']) await minimize(t, app === 'Nasa News' ? 'Nasa News' : app);
  const folded = `document.querySelector('.dock .minimized-window')`;
  const fold = async () => t.ev(`(() => { const f = document.querySelectorAll('.dock .minimized-window'); return { tiles: f.length, count: f[0]?.querySelector('.dock-thumb-count')?.textContent ?? '', icon: f[0]?.querySelector('img')?.getAttribute('src'), label: f[0]?.querySelector('.dock-label')?.textContent }; })()`);
  const f3 = await fold();
  t.check('three minimized windows fold into one tile showing 3', f3.tiles === 1 && f3.count === '3', JSON.stringify(f3));
  t.check('it shows the newest: Nasa News', f3.icon === '/nasa-icon.png' && f3.label === 'Nasa News', JSON.stringify(f3));
  const fit3 = await dockFits();
  t.check('the Dock still fits the screen with three minimized', fit3.ok, fit3.detail);
  const scale = await t.ev(`+getComputedStyle(document.querySelector('.dock')).getPropertyValue('--dock-fit')`);
  t.check('it shrank no more than it had to (icons at least 40px)', (await box(t, `document.querySelector('.dock-icon')`)).w >= 40, `scale ${scale}`);
  t.check('triangles under the three open apps', (await t.ev(`[...document.querySelectorAll('.dock-item:not(.minimized-window)')].filter(d => d.querySelector('.dock-running')).map(d => d.querySelector('.dock-label').textContent).join()`)) === 'Finder,Safari,Nasa News');

  const tap = async (expr) => {
    const b = await box(t, expr);
    await t.s('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.cx, y: b.cy }] });
    await t.s('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(SETTLE);
  };
  await tap(folded);
  const f2 = await fold();
  t.check('a tap on it restores the newest, and it then shows 2 and the one before', !(await isMinimized(t, 'Nasa News')) && f2.count === '2' && f2.icon === '/safari-icon.png', JSON.stringify(f2));
  await tap(dockItem('Finder'));
  const f1 = await fold();
  t.check('Finder\'s own icon restores Finder from the fold, leaving one plain tile', !(await isMinimized(t, 'Finder')) && (await count(t, 'Finder')) === 1 && f1.tiles === 1 && f1.count === '' && f1.label === 'Safari', JSON.stringify(f1));
  t.check('the restored windows are on screen', await t.ev(`[...document.querySelectorAll('.window:not(.window-minimized)')].every(w => { const r = w.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })`));
} catch (e) {
  t.check('phone script', false, e.message);
} finally {
  t.finish([/Failed to load resource/]);
  t.close();
}
