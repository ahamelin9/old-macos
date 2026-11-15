// Does the window manager behave like a Mac? Drags, resizes, minimizes,
// restores and maximizes real windows with real mouse events, then checks
// each window keeps its place, comes to the front when clicked, and fits on
// a phone.
//
//   node .claude/skills/know-how/window-check.mjs http://127.0.0.1:5199 [outDir]
import { launch, sleep } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5199', outDir] = process.argv.slice(2);

// The frame of the window whose title is `title`, or null if it isn't shown
const frameOf = (t, title) => t.ev(`(() => {
  const w = [...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)});
  if (!w) return null;
  const r = w.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), z: +w.style.zIndex };
})()`);
const same = (a, b) => !!a && !!b && ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= 1);
const fmt = (f) => (f ? `${f.x},${f.y} ${f.w}x${f.h}` : 'not shown');
const clickIn = (t, title, selector) => t.ev(`[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)})?.querySelector(${JSON.stringify(selector)})?.click()`);
const restoreFromDock = (t, title) => t.ev(`[...document.querySelectorAll('.dock-item.minimized-window')].find(d => d.textContent.includes(${JSON.stringify(title)}))?.click()`);

// ---- Desktop
let t = await launch(appUrl, outDir, { width: 1400, height: 900 });
try {
  await t.openApp('Finder');
  const start = await frameOf(t, 'Finder');

  // Drag by the title bar
  await t.drag(start.x + start.w / 2, start.y + 12, start.x + start.w / 2 + 150, start.y + 12 + 80);
  const moved = await frameOf(t, 'Finder');
  t.check('dragging the title bar moves the window', moved.x === start.x + 150 && moved.y === start.y + 80, `${fmt(start)} -> ${fmt(moved)}`);

  // Resize from the bottom-right handle
  await t.drag(moved.x + moved.w - 4, moved.y + moved.h - 4, moved.x + moved.w - 4 + 100, moved.y + moved.h - 4 + 60);
  const resized = await frameOf(t, 'Finder');
  t.check('the corner handle resizes the window', Math.abs(resized.w - (moved.w + 100)) <= 1 && Math.abs(resized.h - (moved.h + 60)) <= 1, fmt(resized));

  // Minimize, then restore from the dock
  await clickIn(t, 'Finder', '.window-minimize');
  await sleep(200);
  t.check('minimize hides the window', (await frameOf(t, 'Finder')) === null);
  await restoreFromDock(t, 'Finder');
  await sleep(300);
  const restored = await frameOf(t, 'Finder');
  t.check('restoring from the dock keeps its place and size', same(restored, resized), `${fmt(resized)} -> ${fmt(restored)}`);

  // Maximize, minimize, restore: still maximized; un-maximize goes back
  await clickIn(t, 'Finder', '.window-maximize');
  await sleep(200);
  const maxed = await frameOf(t, 'Finder');
  t.check('maximize fills the desktop width', maxed.w >= 1398 && maxed.y >= 26, fmt(maxed));
  await clickIn(t, 'Finder', '.window-minimize');
  await sleep(200);
  await restoreFromDock(t, 'Finder');
  await sleep(300);
  const maxedAgain = await frameOf(t, 'Finder');
  t.check('a maximized window comes back maximized', same(maxedAgain, maxed), `${fmt(maxed)} -> ${fmt(maxedAgain)}`);
  await clickIn(t, 'Finder', '.window-maximize');
  await sleep(200);
  const unmaxed = await frameOf(t, 'Finder');
  t.check('un-maximize returns to the frame from before', same(unmaxed, resized), `${fmt(resized)} -> ${fmt(unmaxed)}`);

  // Clicking inside a window that is behind brings it to the front
  await t.openApp('Notes');
  const notes = await frameOf(t, 'Notes');
  const finder = await frameOf(t, 'Finder');
  t.check('a new window opens in front', notes.z > finder.z, `Notes z ${notes.z}, Finder z ${finder.z}`);
  const spot = await t.ev(`(() => {
    const w = [...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Finder');
    const r = w.querySelector('.window-content').getBoundingClientRect();
    for (let y = r.top + 10; y < r.bottom - 10; y += 15)
      for (let x = r.left + 10; x < r.right - 10; x += 15)
        if (w.contains(document.elementFromPoint(x, y))) return { x, y };
    return null;
  })()`);
  if (spot) {
    await t.clickAt(spot.x, spot.y);
    const after = await frameOf(t, 'Finder');
    const notesAfter = await frameOf(t, 'Notes');
    t.check('clicking inside a window behind brings it to the front', after.z > notesAfter.z, `Finder z ${after.z}, Notes z ${notesAfter.z}`);
  } else {
    t.check('found a visible spot of Finder to click', false);
  }
  await t.shot('windows-desktop.png');
} catch (e) {
  t.check('desktop script', false, e.message);
} finally {
  t.finish();
  t.close();
}

// ---- Phone
t = await launch(appUrl, outDir, { width: 390, height: 844 });
try {
  for (const app of ['Finder', 'Field Guide']) {
    await t.openApp(app);
    const f = await t.ev(`(() => {
      const ws = [...document.querySelectorAll('.window')].sort((a, b) => +b.style.zIndex - +a.style.zIndex);
      const r = ws[0].getBoundingClientRect();
      const c = ws[0].querySelector('.window-close').getBoundingClientRect();
      return { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), closeX: Math.round(c.x) };
    })()`);
    t.check(`${app} fits on a 390px phone, close button on screen`, f.x >= 0 && f.right <= 390 && f.closeX >= 0, `x ${f.x}, right ${f.right}, close at ${f.closeX}`);
    await t.shot(`windows-phone-${app.replace(/\W+/g, '-').toLowerCase()}.png`);
    await t.ev(`document.querySelectorAll('.window-close').forEach(b => b.click())`);
    await sleep(300);
  }
} catch (e) {
  t.check('phone script', false, e.message);
} finally {
  t.finish();
  t.close();
}
