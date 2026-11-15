// Does dark mode work? Drives the site in headless Chrome, faking the
// computer's light or dark setting with Emulation.setEmulatedMedia, and
// checks that:
//   - a first visit on a dark computer is dark before React has drawn
//     anything (no saved settings, so the early script sets no data-theme),
//     and stays dark with no data-theme at all: the CSS alone does it;
//   - System (the default) follows the computer both ways, live, with no
//     reload, in a window already open;
//   - Light and Dark override the computer, both ways;
//   - dark sets color-scheme: dark (scrollbars, fields, the date picker) and
//     light leaves it as it was;
//   - the choice survives a reload, and the early script had put it on
//     <html> before React drew;
//   - an older save without a theme gets System;
//   - Graphite still turns the Aqua grey in dark;
//   - Restore Defaults goes back to System;
//   - the Appearance pane's three tiles fit at 400x300, at Larger text and
//     on a 390px phone.
//
//   node .claude/skills/know-how/dark-mode-check.mjs http://127.0.0.1:5199 [outDir]
//
// No outside requests. About half a minute.
import { launch, sleep } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5199', outDir] = process.argv.slice(2);
const KEY = 'macos-1999-settings-v1';

// ---- Page helpers
const PREFS = `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Preferences')`;
const FINDER = `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === 'Finder')`;
const os = (t, scheme) => t.s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
const theme = (t) => t.ev(`document.documentElement.getAttribute('data-theme')`);
const saved = (t) => t.ev(`(() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); } catch { return 'blocked'; } })()`);
const scheme = (t) => t.ev(`getComputedStyle(document.documentElement).colorScheme`);
// The relative luminance of an element's background: about 1 for white, near 0 for dark
const LUM = `(c) => { const p = c.match(/[\\d.]+/g).map(Number).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; }`;
const lumOf = (t, expr, prop = 'backgroundColor') => t.ev(`(${LUM})(getComputedStyle(${expr})[${JSON.stringify(prop)}])`);
const finderSurface = (t) => lumOf(t, `${FINDER}.querySelector('.window-content')`);
const isDark = async (t) => (await finderSurface(t)) < 0.05;
const isLight = async (t) => (await finderSurface(t)) > 0.9;
const clickIn = (t, selector, text) => t.ev(`(() => {
  const b = [...${PREFS}.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return 'missing'; b.click(); return 'ok';
})()`);
const markPrefs = (t) => t.ev(`(() => { document.querySelectorAll('[data-shot]').forEach(e => delete e.dataset.shot); ${PREFS}.dataset.shot = '1'; })()`);
const openAppearance = async (t) => {
  if (!(await t.ev(`!!${PREFS}`))) await t.openApp('System Preferences');
  await markPrefs(t);
  await t.ev(`${PREFS}.querySelector('.preferences-show-all').click()`);
  await sleep(100);
  if (await clickIn(t, '.preferences-pane-button', 'Appearance') !== 'ok') throw new Error('no Appearance pane');
  await t.waitFor(`${PREFS}.querySelector('.preferences-title').textContent === 'Appearance'`, 'the Appearance pane', 5000);
};
const pick = async (t, name) => {
  if (await clickIn(t, '.preferences-theme', name) !== 'ok') throw new Error(`no tile "${name}"`);
  await sleep(150);
};
const checked = (t) => t.ev(`[...${PREFS}.querySelectorAll('.preferences-theme')].find(l => l.querySelector('input').checked)?.textContent.trim()`);

// Records, the moment the shared styles arrive (before React draws, and
// before the attributes React sets), whether <html> has data-theme, its
// color-scheme, and how dark a window would be. The same, the moment
// <body> appears, for the early script's attributes.
const RECORD_EARLY = `(() => {
  const lum = ${LUM};
  const probe = () => {
    const d = document.createElement('div');
    d.style.background = 'var(--color-surface)';
    document.documentElement.appendChild(d);
    const l = lum(getComputedStyle(d).backgroundColor);
    d.remove();
    return l;
  };
  new MutationObserver((_, obs) => {
    if (!document.body) return;
    window.__earlyTheme = document.documentElement.getAttribute('data-theme');
    obs.disconnect();
  }).observe(document, { childList: true, subtree: true });
  const styles = new MutationObserver(() => {
    if (!window.__early && getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()) {
      window.__early = {
        theme: document.documentElement.getAttribute('data-theme'),
        scheme: getComputedStyle(document.documentElement).colorScheme,
        surface: probe(),
        reactDrew: !!document.querySelector('#root > *')
      };
      styles.disconnect();
    }
  });
  styles.observe(document, { childList: true, subtree: true });
})();`;

const reload = async (t) => {
  await t.s('Page.reload');
  await sleep(800);
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock after reload');
  await sleep(400);
};

let t = await launch('about:blank', outDir, { width: 1400, height: 900 });
const out = t.outDir;
try {
  // ---- A first visit on a dark computer
  await os(t, 'dark');
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: RECORD_EARLY });
  await t.s('Page.navigate', { url: appUrl });
  await sleep(1500);
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
  const early = await t.ev('window.__early');
  t.check('first visit, dark computer: dark as soon as the styles load, before React draws', early && !early.reactDrew && early.surface < 0.05 && early.scheme === 'dark', JSON.stringify(early));
  t.check('…with no data-theme on <html> at that point (nothing saved)', early && early.theme === null);
  t.check('…and nothing is saved', (await saved(t)) === null);
  t.check('React then sets data-theme="system"', (await theme(t)) === 'system');
  await t.openApp('Finder');
  t.check('first visit, dark computer: a window is dark', await isDark(t));
  await t.ev(`document.documentElement.removeAttribute('data-theme')`);
  t.check('with no data-theme at all the CSS alone keeps it dark', await isDark(t));
  await t.ev(`document.documentElement.setAttribute('data-theme', 'system')`);
  t.check('dark sets color-scheme: dark', (await scheme(t)) === 'dark');
  await t.shot('01-first-visit-dark.png');

  // ---- System follows the computer, live
  await t.ev('window.__sameVisit = 1');
  await os(t, 'light');
  await sleep(200);
  t.check('System: the computer turns light, the open window turns light', await isLight(t));
  t.check('…and light leaves color-scheme as it was', (await scheme(t)) === 'normal', await scheme(t));
  await os(t, 'dark');
  await sleep(200);
  t.check('System: the computer turns dark again, so does the window', await isDark(t));
  t.check('…all without a reload', (await t.ev('window.__sameVisit')) === 1);

  // ---- The Appearance pane
  await openAppearance(t);
  const tiles = await t.ev(`[...${PREFS}.querySelectorAll('.preferences-theme')].map(l => l.textContent.trim())`);
  t.check('Appearance offers System, Light and Dark', tiles.join() === 'System,Light,Dark', tiles.join());
  t.check('…above Text size', await t.ev(`(() => { const labels = [...${PREFS}.querySelectorAll('.preferences-label')].map(l => l.textContent); return labels.indexOf('Appearance:') === 0 && labels.indexOf('Text size:') === 1; })()`));
  t.check('System is chosen by default', (await checked(t)) === 'System');
  await t.shot('02-appearance-system-dark.png', '[data-shot="1"]');

  // ---- Light and Dark override the computer
  await pick(t, 'Light');
  t.check('Light on a dark computer: light', await isLight(t) && (await theme(t)) === 'light');
  t.check('…with color-scheme as it was', (await scheme(t)) === 'normal', await scheme(t));
  await t.shot('03-appearance-light.png', '[data-shot="1"]');
  await os(t, 'light');
  await pick(t, 'Dark');
  t.check('Dark on a light computer: dark', await isDark(t) && (await theme(t)) === 'dark');
  t.check('…with color-scheme: dark', (await scheme(t)) === 'dark');
  await os(t, 'dark');
  await os(t, 'light');
  await sleep(200);
  t.check('Dark ignores the computer changing', await isDark(t));
  await t.shot('04-appearance-dark.png', '[data-shot="1"]');
  t.check('saved with the other settings', (await saved(t))?.theme === 'dark', JSON.stringify(await saved(t)));

  // ---- Graphite in dark
  await t.ev(`[...${PREFS}.querySelectorAll('.preferences-option')].find(l => l.textContent.trim() === 'Graphite').click()`);
  await sleep(150);
  const titleBar = await t.ev(`getComputedStyle(document.querySelector('.window-header')).backgroundImage`);
  const greyish = await t.ev(`(() => { const m = ${JSON.stringify(titleBar)}.match(/rgb\\((\\d+), (\\d+), (\\d+)\\)/); return m && Math.abs(m[3] - m[1]) < 30; })()`);
  t.check('Graphite in dark: grey title bars', greyish, titleBar);
  t.check('…and still dark windows', await isDark(t));
  await t.shot('05-graphite-dark.png');
  await t.ev(`[...${PREFS}.querySelectorAll('.preferences-option')].find(l => l.textContent.trim() === 'Blue').click()`);

  // ---- The choice survives a reload, set before React draws
  await reload(t);
  t.check('after a reload: Dark is still on (computer light)', (await theme(t)) === 'dark' && (await t.ev('window.__earlyTheme')) === 'dark', `early ${await t.ev('window.__earlyTheme')}`);
  const afterReload = await t.ev('window.__early');
  t.check('…and dark as soon as the styles load', afterReload && afterReload.surface < 0.05, JSON.stringify(afterReload));
  await t.openApp('Finder');
  t.check('…and a window is dark', await isDark(t));
  await openAppearance(t);
  t.check('…and the Dark tile is chosen', (await checked(t)) === 'Dark');

  // ---- Restore Defaults goes back to System
  await t.ev(`${PREFS}.querySelector('.preferences-show-all').click()`);
  await sleep(100);
  await t.clickButton('Restore Defaults');
  await sleep(300);
  await t.shot('06-restore-sheet-dark.png', '[data-shot="1"]');
  await t.ev(`[...${PREFS}.querySelectorAll('.preferences-sheet button')].find(b => b.textContent === 'Restore Defaults').click()`);
  await sleep(300);
  t.check('Restore Defaults: back to System', (await theme(t)) === 'system' && (await saved(t)) === null);
  t.check('…which follows the light computer', await isLight(t));
  await os(t, 'dark');
  await sleep(200);
  t.check('…and turns dark with it', await isDark(t));

  // ---- An older save, from before dark mode
  await t.ev(`localStorage.setItem(${JSON.stringify(KEY)}, '{"textSize":"larger","highlight":"graphite"}')`);
  await reload(t);
  t.check('an older save without a theme gets System', (await theme(t)) === 'system' && (await t.ev(`document.documentElement.dataset.textSize`)) === 'larger');
  await t.openApp('Finder');
  t.check('…so a dark computer still gets dark', await isDark(t));
  await t.ev(`localStorage.removeItem(${JSON.stringify(KEY)})`);
} catch (e) { t.check('script', false, e.message); }
finally { t.finish(); t.close(); }

// ---- The tiles fit: 400x300, Larger text, a 390px phone
const fits = (t) => t.ev(`(() => {
  const w = ${PREFS}, box = w.getBoundingClientRect();
  const out = [...w.querySelectorAll('.preferences-themes, .preferences-theme')].filter(e => { const r = e.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; }).map(e => e.className);
  const body = w.querySelector('.preferences-body');
  if (body.scrollWidth > body.clientWidth + 1) out.push('scrolls sideways');
  return out;
})()`);
for (const [label, width, height, settings] of [['small', 1400, 900, '{"theme":"dark"}'], ['small-larger', 1400, 900, '{"theme":"dark","textSize":"larger"}'], ['phone', 800, 844, '{"theme":"dark"}']]) {
  t = await launch(appUrl, out, { width, height });
  try {
    await t.ev(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(settings)})`);
    await reload(t);
    await openAppearance(t);
    if (label === 'phone') {
      await t.s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await sleep(400);
      await t.ev(`${PREFS}.querySelector('.window-maximize').click()`);
      await sleep(300);
    }
    const size = await t.ev(`(() => { const r = ${PREFS}.getBoundingClientRect(); return r.width + 'x' + r.height; })()`);
    const o = await fits(t);
    t.check(`${label} (${size}): the three tiles fit`, o.length === 0, o.join(', '));
    await t.shot(`07-tiles-${label}.png`, label === 'phone' ? undefined : '[data-shot="1"]');
  } catch (e) { t.check('script', false, e.message); }
  finally { t.finish(); t.close(); }
}
console.log(`screenshots: ${out}`);
