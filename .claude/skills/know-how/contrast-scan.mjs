// A contrast scan: opens every dock app (maximized), System Preferences'
// panes, the Apple menu (with its Dock submenu and a highlighted row), About
// This Mac, Force Quit and Restart's alert, and lists visible text whose
// colour is too close to what is behind it. Under 4.5:1 fails, or 3:1 for
// large text (24px, or 18.66px bold).
//
//   node .claude/skills/know-how/contrast-scan.mjs <appUrl> [outDir] [--theme dark|light] [--settings '<json>'] [App name…]
//
// App names are the Dock's labels, plus "Apple menu", "About This Mac",
// "Force Quit" and "Restart alert".
//
// The theme defaults to dark. For each element with its own text, it takes
// the text colour and walks up through the backgrounds behind it, blending
// see-through ones, until it reaches an opaque one. Best effort where that
// can't be exact:
//   - a gradient behind the text is judged by its worst colour stop;
//   - text on a picture (a url() background, or an <img>/<video> laid under
//     it) is left out and counted as "on a picture";
//   - text positioned over something that isn't its ancestor (a badge laid
//     over a photo) is judged against its ancestors only.
// Disabled controls are left out (WCAG exempts them), and so is placeholder
// text, and text that is only emoji (they draw in their own colours), and so are the title bar's close, minimize and zoom glyphs: icons on
// Apple's fixed red, yellow and green, the same in both themes. It saves a screenshot of each app, and prints every failure with
// the app, a CSS path, the text, both colours and the ratio. Live data
// (NASA, iNaturalist, PokeAPI) loads as usual: about a dozen requests.
import { launch, sleep } from './cdp.mjs';

const args = process.argv.slice(2);
const take = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : null; };
const THEME = take('--theme') ?? 'dark';
const EXTRA = JSON.parse(take('--settings') ?? '{}');
const [appUrl = 'http://127.0.0.1:5199', outDir, ...only] = args;
const SETTINGS = JSON.stringify({ ...EXTRA, theme: THEME });

const SEED = `try { localStorage.setItem('macos-1999-settings-v1', ${JSON.stringify(SETTINGS)}); } catch {}
  const st = document.createElement('style');
  st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));`;

// Runs in the page: every failing piece of text inside `root`
const SCAN = (rootExpr) => `(() => {
  const root = ${rootExpr};
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (!a) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => (top[k] * top.a + under[k] * under.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const hex = ({ r, g, b, a }) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('') + (a < 1 ? '@' + a.toFixed(2) : '');
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== root && parts.length < 4; e = e.parentElement) {
      const cls = [...e.classList].filter(c => !/^(active|selected|current)$/.test(c)).slice(0, 2).join('.');
      parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
    return parts.join(' > ');
  };
  // The colours behind an element: a list of candidate opaque backgrounds
  // (more than one when a gradient is in the way), or 'picture'
  const behind = (el) => {
    // Each layer is the colours one element paints: one for a flat colour,
    // one per stop for a gradient (each over the element's own colour)
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      if (e.matches('.leaflet-container')) return 'picture';
      const s = getComputedStyle(e);
      const bg = parse(s.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 };
      const img = s.backgroundImage;
      let layer = bg.a > 0 ? [bg] : null;
      if (img && img !== 'none') {
        if (/url\\(/.test(img)) return 'picture';
        const stops = [...img.matchAll(/rgba?\\([^)]+\\)/g)].map(m => parse(m[0])).filter(Boolean);
        if (stops.length) layer = stops.map(stop => over(stop, bg));
      }
      if (layer) {
        layers.push(layer);
        if (layer.every(c => c.a >= 0.999)) break;
      }
      if (!e.parentElement) layers.push([{ r: 255, g: 255, b: 255, a: 1 }]);
    }
    // Blend from the bottom up, keeping every combination of gradient stops
    let out = layers.pop();
    while (layers.length) {
      const top = layers.pop();
      out = out.flatMap(under => top.map(c => over(c, under))).slice(0, 64);
    }
    return out;
  };
  const out = { checked: 0, onPicture: 0, fails: [] };
  const seen = new Set();
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (!own) continue;
    // An emoji draws in its own colours, whatever the text colour says
    if (/^[\\p{Extended_Pictographic}\\uFE0F\\u200D\\s]+$/u.test(own)) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    if (!el.getClientRects().length) continue;
    if (el.closest('button:disabled, input:disabled, select:disabled, [aria-disabled="true"], option, script, style, .window-controls')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(el);
    let fg = parse(s.color);
    if (!fg) continue;
    const bgs = behind(el);
    if (bgs === 'picture') { out.onPicture++; continue; }
    out.checked++;
    const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    let worst = Infinity, worstBg = null;
    for (const bg of bgs) {
      const text = fg.a < 1 ? over(fg, bg) : fg;
      const k = ratio(text, bg);
      if (k < worst) { worst = k; worstBg = bg; }
    }
    if (worst < need) {
      const key = path(el) + '|' + hex(fg) + '|' + hex(worstBg);
      if (seen.has(key)) continue;
      seen.add(key);
      out.fails.push({ where: path(el), text: own.slice(0, 40), fg: hex(fg), bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need, gradient: bgs.length > 1 });
    }
  }
  return out;
})()`;

const frontWindow = `[...document.querySelectorAll('.window')].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0]`;
const wanted = (name) => !only.length || only.includes(name);
const menuRow = (label) => `[...document.querySelectorAll('.mac-menu-item')].find(e => e.textContent.trim().startsWith(${JSON.stringify(label)}))`;
/** Move the real pointer over an element, so hover handlers run */
const hoverOver = async (t, expr) => {
  const b = await t.ev(`(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await t.s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await sleep(200);
};
/** Choose a row of the Apple menu */
const fromAppleMenu = async (t, label) => {
  await t.ev(`document.querySelector('.mac-menu-bar-apple').click()`);
  await sleep(150);
  await t.ev(`${menuRow(label)}.click()`);
  await sleep(300);
};
const settle = async (t) => {
  for (let i = 0; i < 30; i++) {
    const busy = await t.ev(`(() => { const w = ${frontWindow}; if (!w) return false;
      return /loading|connecting|searching/i.test(w.querySelector('.window-content')?.innerText ?? '') || [...w.querySelectorAll('img')].some(i => !i.complete); })()`);
    if (!busy) break;
    await sleep(500);
  }
  await sleep(800);
};

let total = 0, checked = 0, onPicture = 0;
const report = (label, r) => {
  checked += r.checked; onPicture += r.onPicture; total += r.fails.length;
  console.log(`${r.fails.length ? 'FAIL' : 'ok  '}  ${label}: ${r.checked} pieces of text checked, ${r.onPicture} on a picture, ${r.fails.length} too faint`);
  for (const f of r.fails) console.log(`        ${f.ratio}:1 (needs ${f.need})  ${f.fg} on ${f.bg}${f.gradient ? ' (gradient)' : ''}  ${f.where}  "${f.text}"`);
};

const t = await launch(appUrl, outDir, { width: 1400, height: 900 });
try {
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  await t.s('Page.reload');
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
  await sleep(800);
  console.log(`theme: ${THEME}${Object.keys(EXTRA).length ? ', settings ' + JSON.stringify(EXTRA) : ''}; <html> data-theme=${await t.ev(`document.documentElement.dataset.theme`)}, color-scheme ${await t.ev(`getComputedStyle(document.documentElement).colorScheme`)}\n`);
  report('menu bar', await t.ev(SCAN(`document.querySelector('.mac-menu-bar')`)));
  report('Dock labels (judged on the Dock\'s own glass)', await t.ev(SCAN(`document.querySelector('.dock')`)));
  if (wanted('Apple menu')) {
    await t.ev(`document.querySelector('.mac-menu-bar-apple').click()`);
    await sleep(150);
    await hoverOver(t, menuRow('Dock'));
    await hoverOver(t, `document.querySelector('.mac-submenu .mac-menu-item')`);
    report('the Apple menu, its Dock submenu and a highlighted row', await t.ev(SCAN(`document.querySelector('.mac-menu-bar-apple-menu')`)));
    report('the 🍎, highlighted', await t.ev(SCAN(`document.querySelector('.mac-menu-bar-apple')`)));
    await t.shot('contrast-apple-menu.png');
    await t.ev(`document.querySelector('.mac-menu-bar-apple').click()`);
    await sleep(150);
  }
  const apps = await t.ev(`[...document.querySelectorAll('.dock-item:not(.minimized-window) .dock-label')].map(l => l.textContent.trim())`);
  for (const app of apps) {
    if (only.length && !only.includes(app)) continue;
    await t.openApp(app);
    await t.ev(`(() => { document.querySelectorAll('[data-shot]').forEach(e => delete e.dataset.shot); ${frontWindow}.dataset.shot = '1'; })()`);
    await t.ev(`${frontWindow}.querySelector('.window-maximize').click()`);
    await settle(t);
    report(app, await t.ev(SCAN(frontWindow)));
    await t.shot(`contrast-${app.replace(/\W+/g, '-').toLowerCase()}.png`, '[data-shot="1"]');
    if (app === 'System Preferences') {
      for (const pane of ['Desktop', 'Appearance', 'Dock', 'Date & Time']) {
        await t.ev(`${frontWindow}.querySelector('.preferences-show-all').click()`);
        await sleep(100);
        await t.ev(`[...${frontWindow}.querySelectorAll('.preferences-pane-button')].find(b => b.textContent.includes(${JSON.stringify(pane)})).click()`);
        await sleep(200);
        report(`System Preferences, ${pane}`, await t.ev(SCAN(frontWindow)));
      }
      await t.ev(`${frontWindow}.querySelector('.preferences-show-all').click()`);
      await sleep(100);
      await t.clickButton('Restore Defaults');
      await sleep(300);
      report('System Preferences, the Restore Defaults sheet', await t.ev(SCAN(`${frontWindow}.querySelector('.preferences-sheet')`)));
      await t.shot('contrast-system-preferences-sheet.png', '[data-shot="1"]');
      await t.ev(`[...${frontWindow}.querySelectorAll('.preferences-sheet button')].find(b => b.textContent === 'Cancel').click()`);
    }
    await t.ev(`[...document.querySelectorAll('.window-close')].forEach(b => b.click())`);
    await sleep(300);
  }
  // The windows and the alert the Apple menu opens
  const markFront = () => t.ev(`(() => { document.querySelectorAll('[data-shot]').forEach(e => delete e.dataset.shot); ${frontWindow}.dataset.shot = '1'; })()`);
  if (wanted('About This Mac')) {
    await fromAppleMenu(t, 'About This Mac');
    await markFront();
    await t.ev(`${frontWindow}.querySelector('.window-maximize').click()`);
    await settle(t);
    report('About This Mac', await t.ev(SCAN(frontWindow)));
    await t.shot('contrast-about-this-mac.png', '[data-shot="1"]');
    await t.ev(`[...document.querySelectorAll('.window-close')].forEach(b => b.click())`);
    await sleep(300);
  }
  if (wanted('Force Quit')) {
    await t.openApp('Notes');
    await t.openApp('Calculator');
    await t.ev(`[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Notes').querySelector('.window-minimize').click()`);
    await fromAppleMenu(t, 'Force Quit');
    await markFront();
    await t.ev(`${frontWindow}.querySelector('.window-maximize').click()`);
    await t.ev(`${frontWindow}.querySelector('[role="option"]').click()`);
    await sleep(300);
    report('Force Quit, with a minimized window picked', await t.ev(SCAN(frontWindow)));
    await t.shot('contrast-force-quit.png', '[data-shot="1"]');
    await t.ev(`[...document.querySelectorAll('.window-close')].forEach(b => b.click())`);
    await sleep(300);
  }
  if (wanted('Restart alert')) {
    await fromAppleMenu(t, 'Restart');
    report('Restart\'s alert', await t.ev(SCAN(`document.querySelector('.desktop-alert')`)));
    await t.shot('contrast-restart-alert.png');
    await t.ev(`[...document.querySelectorAll('.desktop-alert button')].find(b => b.textContent === 'Cancel').click()`);
  }
  console.log(`\n${total} piece(s) of text under the bar; ${checked} checked, ${onPicture} left out as on a picture`);
  console.log(`screenshots: ${t.outDir}`);
} finally {
  t.close();
}
