// Does the Apple menu work? Drives it in headless Chrome with real mouse,
// key and touch events, and checks that:
//   - the 🍎 is a real button (role menuitem in a menubar, aria-haspopup,
//     aria-expanded), and the menu has its rows and separators in order;
//   - it opens and closes by click, a second click, a click outside and
//     Escape, and the pointer highlights a row;
//   - the keyboard works: Enter, Space, Down and Up open it, Up and Down
//     move (wrapping), Home and End jump, Right and Left open and close the
//     Dock submenu, Enter chooses, Escape and Tab close and give the focus
//     back to the 🍎;
//   - About This Mac shows this browser's cores, memory and display, makes
//     no request and saves nothing, fits its 400x300 window, and More Info…
//     opens Finder once;
//   - System Preferences… twice gives one window, including one the Dock
//     opened, brings it in front of others and back from minimized; Dock
//     Preferences… lands on the Dock pane, also after Show All, and opens
//     Preferences there when it is closed;
//   - Turn Magnification Off/On flips the setting and its own label;
//   - Force Quit lists every other window with its app's icon, minimized
//     ones marked, and closes the chosen one (minimized too); opening it
//     twice gives one window;
//   - Sleep fades to black and wakes on a click (which doesn't also click
//     the Dock under it) and on a key, and is instant with reduced motion;
//   - Restart… asks first: Cancel and Escape leave the page alone, Restart
//     reloads it;
//   - on a 390px phone with touch, a tap opens the menu and Dock ▸, the
//     menu and submenu stay on screen (also at Larger text), System
//     Preferences… and Dock Preferences… open Preferences, and a tap wakes
//     Sleep;
// and saves screenshots of the open menu and About This Mac in light, dark
// and Graphite, on a laptop and a phone, plus Force Quit and the alert.
//
//   node .claude/skills/know-how/apple-menu-check.mjs http://127.0.0.1:5173 [outDir]
//
// No outside requests. About a minute and a half.
import { launch, sleep } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5173', outDir] = process.argv.slice(2);
const KEY = 'macos-1999-settings-v1';
const THEMES = { light: { theme: 'light' }, dark: { theme: 'dark' }, graphite: { theme: 'light', highlight: 'graphite' } };

// ---- Page helpers
const APPLE = `document.querySelector('.mac-menu-bar-apple')`;
const MENU = `document.querySelector('.mac-menu-bar-apple-menu')`;
const SUB = `document.querySelector('.mac-submenu')`;
const row = (label) => `[...document.querySelectorAll('.mac-menu-item')].find(e => e.textContent.trim().startsWith(${JSON.stringify(label)}))`;
const win = (title) => `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)})`;
const FRONT = `[...document.querySelectorAll('.window')].sort((a, b) => +b.style.zIndex - +a.style.zIndex)[0]`;

const isOpen = (t) => t.ev(`!!${MENU}`);
const focusedText = (t) => t.ev(`document.activeElement?.textContent?.trim() ?? ''`);
const appleFocused = (t) => t.ev(`document.activeElement === ${APPLE}`);
const count = (t, title) => t.ev(`[...document.querySelectorAll('.window')].filter(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)}).length`);
const frontTitle = (t) => t.ev(`${FRONT}?.querySelector('.window-title')?.textContent ?? null`);
const box = (t, expr) => t.ev(`(() => { const b = (${expr}).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; })()`);
const clickOn = async (t, expr) => { const b = await box(t, expr); await t.clickAt(b.cx, b.cy); };
const hover = async (t, expr) => { const b = await box(t, expr); await t.s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.cx, y: b.cy }); await sleep(150); };
const closeAll = async (t) => { await t.ev(`document.querySelectorAll('.window-close').forEach(b => b.click())`); await sleep(250); };
const dockClick = (t, label) => t.ev(`[...document.querySelectorAll('.dock-item')].find(d => d.textContent.trim() === ${JSON.stringify(label)}).click()`);

const VK = { ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Enter: 13, Escape: 27, Tab: 9, Home: 36, End: 35, ' ': 32, a: 65 };
/** A real key press, sent to whatever has the focus */
const press = async (t, key) => {
  const code = { ' ': 'Space', a: 'KeyA' }[key] ?? key;
  const base = { key, code, windowsVirtualKeyCode: VK[key], nativeVirtualKeyCode: VK[key] };
  const text = key === 'Enter' ? '\r' : key.length === 1 ? key : undefined;
  await t.s('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) });
  await t.s('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(120);
};
/** A real tap (touch events; the browser makes the click) */
const tap = async (t, x, y) => {
  await t.s('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await t.s('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
};
const tapOn = async (t, expr) => { const b = await box(t, expr); await tap(t, b.cx, b.cy); };

const openMenu = async (t, how = clickOn) => {
  if (!(await isOpen(t))) await how(t, APPLE);
  await t.waitFor(MENU, 'the Apple menu', 3000);
};
const choose = async (t, label, how = clickOn) => {
  await openMenu(t, how);
  await how(t, row(label));
  await sleep(300);
};
const chooseInDock = async (t, label, how = clickOn) => {
  await openMenu(t, how);
  await how(t, row('Dock'));
  await t.waitFor(SUB, 'the Dock submenu', 3000);
  await how(t, row(label));
  await sleep(300);
};
/** Settings saved before the page's own scripts, then a reload */
const seed = async (t, settings) => {
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(settings))}); } catch {}` });
  await t.s('Page.reload');
  await sleep(800);
  await t.waitFor(`document.querySelectorAll('.dock-item').length > 0 && ${APPLE}`, 'the desktop after reload');
  await sleep(400);
};
/** A screenshot of part of the page, at 2x */
const shotRegion = async (t, name, x, y, width, height) => {
  const { data } = await t.s('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 2 } });
  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  writeFileSync(join(t.outDir, name), Buffer.from(data, 'base64'));
};
/** Every row of the menu and submenu inside the screen */
const offScreen = (t, width) => t.ev(`[...document.querySelectorAll('.mac-menu, .mac-menu-item')].filter(e => e.getClientRects().length)
  .map(e => e.getBoundingClientRect()).filter(r => r.left < 0 || r.right > ${width} || r.top < 0 || r.bottom > innerHeight).length`);
/** The menu open, the Dock submenu open, and its first row under the pointer */
const showMenuForShot = async (t) => {
  await openMenu(t);
  await hover(t, row('Dock'));
  await t.waitFor(SUB, 'the Dock submenu', 3000);
  await hover(t, `${SUB}.querySelector('.mac-menu-item')`);
};

// ================= Laptop
let t = await launch(appUrl, outDir, { width: 1400, height: 900 });
const out = t.outDir;
try {
  await seed(t, THEMES.light);

  // ---- The 🍎 and the menu's rows
  const apple = await t.ev(`(() => { const b = ${APPLE}; return { tag: b.tagName, role: b.getAttribute('role'), popup: b.getAttribute('aria-haspopup'), expanded: b.getAttribute('aria-expanded'), bar: b.closest('[role="menubar"]') ? 'yes' : 'no' }; })()`);
  t.check('the 🍎 is a button: role menuitem in a menubar, aria-haspopup menu, aria-expanded false', apple.tag === 'BUTTON' && apple.role === 'menuitem' && apple.popup === 'menu' && apple.expanded === 'false' && apple.bar === 'yes', JSON.stringify(apple));

  await clickOn(t, APPLE);
  await sleep(200);
  const rows = await t.ev(`[...${MENU}.children].map(e => e.getAttribute('role') === 'separator' ? '-' : e.querySelector('[role="menuitem"]')?.textContent.replace('▸', ' ▸') ?? e.textContent)`);
  const expected = ['About This Mac', '-', 'System Preferences…', 'Dock ▸', '-', 'Force Quit…', '-', 'Sleep', 'Restart…'];
  t.check('a click opens the menu, rows and separators in order', JSON.stringify(rows) === JSON.stringify(expected), rows.join(' | '));
  t.check('open: aria-expanded true, role menu, the menu holds the focus', await t.ev(`${APPLE}.getAttribute('aria-expanded') === 'true' && ${MENU}.getAttribute('role') === 'menu' && document.activeElement === ${MENU}`));
  t.check('the Dock row says it has a submenu', await t.ev(`${row('Dock')}.getAttribute('aria-haspopup') === 'menu' && ${row('Dock')}.getAttribute('aria-expanded') === 'false'`));
  await hover(t, row('Force Quit'));
  t.check('the pointer highlights a row', await t.ev(`${row('Force Quit')}.classList.contains('mac-highlighted')`));
  const look = await t.ev(`(() => { const s = getComputedStyle(${row('Force Quit')}); const m = getComputedStyle(${MENU}); return { bg: s.backgroundImage, color: s.color, menuBg: m.backgroundColor }; })()`);
  t.check('the highlight is the Aqua gradient with white text; the menu is a little see-through', /gradient/.test(look.bg) && look.color === 'rgb(255, 255, 255)' && /rgba\(.*0\.9/.test(look.menuBg), JSON.stringify(look));
  await clickOn(t, APPLE);
  t.check('a second click on the 🍎 closes it', !(await isOpen(t)) && await t.ev(`${APPLE}.getAttribute('aria-expanded') === 'false'`));

  await openMenu(t);
  await t.clickAt(700, 450);
  t.check('a click outside closes it', !(await isOpen(t)));
  await openMenu(t);
  await press(t, 'Escape');
  t.check('Escape closes it and gives the focus back to the 🍎', !(await isOpen(t)) && await appleFocused(t));

  // ---- Keyboard
  await t.ev(`${APPLE}.focus()`);
  await press(t, 'Enter');
  t.check('Enter on the 🍎 opens it at About This Mac', (await isOpen(t)) && (await focusedText(t)) === 'About This Mac', await focusedText(t));
  await press(t, 'ArrowDown');
  t.check('Down skips the separator to System Preferences…', (await focusedText(t)) === 'System Preferences…', await focusedText(t));
  await press(t, 'ArrowDown');
  await press(t, 'ArrowRight');
  t.check('Right on Dock opens the submenu at its first row', (await t.ev(`!!${SUB}`)) && (await focusedText(t)) === 'Turn Magnification Off' && await t.ev(`${row('Dock')}.getAttribute('aria-expanded') === 'true'`), await focusedText(t));
  await press(t, 'ArrowDown');
  t.check('Down moves in the submenu', (await focusedText(t)) === 'Dock Preferences…', await focusedText(t));
  await press(t, 'ArrowDown');
  t.check('and wraps round', (await focusedText(t)) === 'Turn Magnification Off', await focusedText(t));
  await press(t, 'ArrowLeft');
  t.check('Left closes the submenu, back on Dock', !(await t.ev(`!!${SUB}`)) && (await focusedText(t)).startsWith('Dock'), await focusedText(t));
  await press(t, 'Home');
  await press(t, 'ArrowUp');
  t.check('Up from the top wraps to Restart…', (await focusedText(t)) === 'Restart…', await focusedText(t));
  await press(t, 'Home');
  t.check('Home jumps to the top', (await focusedText(t)) === 'About This Mac');
  await press(t, 'End');
  t.check('End jumps to the bottom', (await focusedText(t)) === 'Restart…');
  await press(t, 'Tab');
  t.check('Tab closes it, focus on the 🍎', !(await isOpen(t)) && await appleFocused(t));
  await press(t, 'ArrowUp');
  t.check('Up on the 🍎 opens it at the bottom', (await isOpen(t)) && (await focusedText(t)) === 'Restart…');
  await press(t, 'Escape');
  await press(t, ' ');
  t.check('Space on the 🍎 opens it', (await isOpen(t)) && (await focusedText(t)) === 'About This Mac');
  await press(t, 'Escape');
  await press(t, 'ArrowDown');
  t.check('Down on the 🍎 opens it', (await isOpen(t)) && (await focusedText(t)) === 'About This Mac');

  // ---- About This Mac (chosen with Enter)
  const resourcesBefore = await t.ev(`performance.getEntriesByType('resource').filter(e => /fetch|xmlhttprequest|beacon/.test(e.initiatorType)).length`);
  const storedBefore = await t.ev(`JSON.stringify(Object.entries(localStorage))`);
  await press(t, 'Enter');
  await t.waitFor(win('About This Mac'), 'About This Mac', 5000);
  t.check('Enter on About This Mac opens it, and the focus goes back to the 🍎', (await count(t, 'About This Mac')) === 1 && !(await isOpen(t)) && await appleFocused(t));
  const specs = await t.ev(`(() => {
    const w = ${win('About This Mac')};
    const dd = [...w.querySelectorAll('.about-specs dd')].map(d => d.textContent);
    const r = Math.round(devicePixelRatio * 100) / 100;
    return { dd, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory ?? null, display: screen.width + ' × ' + screen.height + ' at ' + r + '×',
      name: w.querySelector('.about-name')?.textContent, version: w.querySelector('.about-version')?.textContent };
  })()`);
  t.check('About This Mac shows the name and a version line', specs.name === 'macOS 1999' && /Version/.test(specs.version), `${specs.name}, ${specs.version}`);
  t.check('it shows this browser\'s cores, memory and display', specs.dd[0] === `${specs.cores} cores` && specs.dd[1] === (specs.memory ? (specs.memory < 1 ? `About ${specs.memory * 1024} MB` : `About ${specs.memory} GB`) : 'Not shared by this browser') && specs.dd[2] === specs.display, specs.dd.join(' | '));
  await sleep(300);
  t.check('reading the specs made no request and saved nothing',
    (await t.ev(`performance.getEntriesByType('resource').filter(e => /fetch|xmlhttprequest|beacon/.test(e.initiatorType)).length`)) === resourcesBefore && (await t.ev(`JSON.stringify(Object.entries(localStorage))`)) === storedBefore);
  const fit = await t.ev(`(() => { const w = ${win('About This Mac')}; const c = w.querySelector('.window-content'); const r = w.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), scrollsDown: c.scrollHeight > c.clientHeight + 1, scrollsAcross: c.scrollWidth > c.clientWidth + 1 }; })()`);
  t.check('About This Mac fits its 400x300 window without scrolling', fit.w === 400 && fit.h === 300 && !fit.scrollsDown && !fit.scrollsAcross, JSON.stringify(fit));
  await t.ev(`${win('About This Mac')}.dataset.checkAbout = '1'`);
  await t.shot('about-laptop-400x300.png', '[data-check-about]');

  await dockClick(t, 'Notes');
  await sleep(300);
  await choose(t, 'About This Mac');
  t.check('About This Mac again: still one window, brought in front of Notes', (await count(t, 'About This Mac')) === 1 && (await frontTitle(t)) === 'About This Mac');
  await t.ev(`${win('About This Mac')}.querySelector('.window-maximize').click()`);
  await sleep(300);
  const maxFit = await t.ev(`(() => { const c = ${win('About This Mac')}.querySelector('.window-content'); return c.scrollWidth <= c.clientWidth + 1; })()`);
  t.check('About This Mac maximized: nothing sticks out', maxFit);
  await t.ev(`[...${win('About This Mac')}.querySelectorAll('button')].find(b => b.textContent === 'More Info…').click()`);
  await sleep(300);
  t.check('More Info… opens Finder in front', (await count(t, 'Finder')) === 1 && (await frontTitle(t)) === 'Finder');
  await t.ev(`[...${win('About This Mac')}.querySelectorAll('button')].find(b => b.textContent === 'More Info…').click()`);
  await sleep(300);
  t.check('More Info… again: still one Finder', (await count(t, 'Finder')) === 1);

  // ---- System Preferences… and Dock Preferences…
  await closeAll(t);
  await choose(t, 'System Preferences…');
  t.check('System Preferences… opens Preferences', (await count(t, 'Preferences')) === 1 && (await frontTitle(t)) === 'Preferences');
  await dockClick(t, 'Notes');
  await sleep(300);
  await choose(t, 'System Preferences…');
  t.check('System Preferences… twice: one window, brought in front of Notes', (await count(t, 'Preferences')) === 1 && (await frontTitle(t)) === 'Preferences');
  await closeAll(t);
  await dockClick(t, 'System Preferences');
  await sleep(300);
  await dockClick(t, 'Notes');
  await sleep(300);
  await choose(t, 'System Preferences…');
  t.check('it finds a Preferences window the Dock opened', (await count(t, 'Preferences')) === 1 && (await frontTitle(t)) === 'Preferences');
  await t.ev(`${win('Preferences')}.querySelector('.window-minimize').click()`);
  await sleep(250);
  t.check('(Preferences minimized)', !(await t.ev(`!!${win('Preferences')}`)));
  await choose(t, 'System Preferences…');
  t.check('System Preferences… brings a minimized Preferences back, in front', (await count(t, 'Preferences')) === 1 && (await frontTitle(t)) === 'Preferences'
    && !(await t.ev(`[...document.querySelectorAll('.dock-item.minimized-window')].some(d => d.textContent.includes('Preferences'))`)));
  const paneTitle = () => t.ev(`${win('Preferences')}?.querySelector('.preferences-title')?.textContent`);
  await chooseInDock(t, 'Dock Preferences…');
  t.check('Dock Preferences… switches the open Preferences to the Dock pane', (await count(t, 'Preferences')) === 1 && (await paneTitle()) === 'Dock', await paneTitle());
  await t.ev(`${win('Preferences')}.querySelector('.preferences-show-all').click()`);
  await sleep(150);
  await dockClick(t, 'Notes');
  await sleep(300);
  await chooseInDock(t, 'Dock Preferences…');
  t.check('after Show All, Dock Preferences… goes back to the Dock pane, in front', (await paneTitle()) === 'Dock' && (await frontTitle(t)) === 'Preferences', await paneTitle());
  await closeAll(t);
  await chooseInDock(t, 'Dock Preferences…');
  t.check('with Preferences closed, Dock Preferences… opens it at the Dock pane', (await count(t, 'Preferences')) === 1 && (await paneTitle()) === 'Dock', await paneTitle());

  // ---- Magnification
  const magnify = () => t.ev(`document.documentElement.getAttribute('data-dock-magnify')`);
  const savedMagnify = () => t.ev(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) ?? '{}').dockMagnify`);
  await chooseInDock(t, 'Turn Magnification Off');
  t.check('Turn Magnification Off turns it off and saves it', (await magnify()) === 'false' && (await savedMagnify()) === false);
  t.check('the Dock pane\'s checkbox follows', await t.ev(`${win('Preferences')}.querySelector('.preferences-checkbox').checked === false`));
  await openMenu(t);
  await clickOn(t, row('Dock'));
  await t.waitFor(SUB, 'the Dock submenu', 3000);
  t.check('the row now says Turn Magnification On', !!(await t.ev(`!!${row('Turn Magnification On')}`)));
  await clickOn(t, row('Turn Magnification On'));
  await sleep(250);
  t.check('Turn Magnification On turns it back on', (await magnify()) === 'true' && (await savedMagnify()) === true);

  // ---- Force Quit
  await closeAll(t);
  for (const app of ['Notes', 'Calculator', 'Finder']) { await dockClick(t, app); await sleep(250); }
  await t.ev(`${win('Notes')}.querySelector('.window-minimize').click()`);
  await sleep(250);
  await choose(t, 'Force Quit…');
  const FQ = win('Force Quit Applications');
  await t.waitFor(FQ, 'Force Quit', 5000);
  await sleep(300);
  const list = await t.ev(`[...${FQ}.querySelectorAll('[role="option"]')].map(o => ({ name: o.querySelector('.forcequit-name').textContent, icon: o.querySelector('img').naturalWidth > 0, src: o.querySelector('img').getAttribute('src'), minimized: !!o.querySelector('.forcequit-state') }))`);
  t.check('Force Quit lists every other window, minimized ones too', list.map(l => l.name).join(',') === 'Notes,Calculator,Finder', list.map(l => l.name).join(','));
  t.check('each with its app\'s icon, loaded', list.every(l => l.icon) && list[0].src === '/notes-icon.png' && list[2].src === '/finder-icon.webp', list.map(l => l.src).join(','));
  t.check('the minimized one is marked', list[0].minimized && !list[1].minimized);
  const quitButton = `[...${FQ}.querySelectorAll('button')].find(b => b.textContent === 'Force Quit')`;
  t.check('Force Quit is greyed until a window is picked', await t.ev(`${quitButton}.disabled`));
  await clickOn(t, `[...${FQ}.querySelectorAll('[role="option"]')][0]`);
  t.check('a click picks a row', await t.ev(`[...${FQ}.querySelectorAll('[role="option"]')][0].getAttribute('aria-selected') === 'true' && !${quitButton}.disabled`));
  await t.ev(`${FQ}.dataset.checkFq = '1'`);
  await t.shot('forcequit-laptop-light.png', '[data-check-fq]');
  await clickOn(t, quitButton);
  await sleep(250);
  t.check('Force Quit closes the minimized Notes, and it leaves the Dock', (await count(t, 'Notes')) === 0
    && !(await t.ev(`[...document.querySelectorAll('.dock-item.minimized-window')].some(d => d.textContent.includes('Notes'))`))
    && !(await t.ev(`${FQ}.textContent.includes('Notes')`)));
  t.check('and picks the next row', await t.ev(`${FQ}.querySelector('[aria-selected="true"] .forcequit-name')?.textContent === 'Calculator'`));
  await clickOn(t, quitButton);
  await sleep(250);
  t.check('Force Quit closes a showing window', (await count(t, 'Calculator')) === 0 && (await count(t, 'Finder')) === 1);
  await t.ev(`${FQ}.querySelector('[role="listbox"]').focus()`);
  await press(t, 'ArrowDown');
  t.check('Down in the list picks a row from the keyboard', await t.ev(`${FQ}.querySelector('[aria-selected="true"] .forcequit-name')?.textContent === 'Finder'`));
  await dockClick(t, 'Notes');
  await sleep(300);
  await choose(t, 'Force Quit…');
  t.check('Force Quit… again: one window, brought in front', (await count(t, 'Force Quit Applications')) === 1 && (await frontTitle(t)) === 'Force Quit Applications');

  // ---- Sleep
  await closeAll(t);
  const SLEEP = `document.querySelector('.desktop-sleep')`;
  await choose(t, 'Sleep');
  t.check('Sleep puts a screen over everything', await t.ev(`!!${SLEEP}`));
  await sleep(1300);
  t.check('it fades to black', await t.ev(`getComputedStyle(${SLEEP}).opacity === '1' && getComputedStyle(${SLEEP}).backgroundColor === 'rgb(0, 0, 0)'`));
  const finderIcon = await box(t, `[...document.querySelectorAll('.dock-item')].find(d => d.textContent.trim() === 'Finder')`);
  await t.clickAt(finderIcon.cx, finderIcon.cy);
  t.check('a click wakes it, fading back in', await t.ev(`!!document.querySelector('.desktop-sleep-waking')`));
  await sleep(700);
  t.check('and it is gone, without clicking the Finder icon under it', !(await t.ev(`!!${SLEEP}`)) && (await count(t, 'Finder')) === 0);
  await choose(t, 'Sleep');
  await sleep(1300);
  await press(t, 'a');
  await sleep(700);
  t.check('a key wakes it too', !(await t.ev(`!!${SLEEP}`)));
  await t.s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await choose(t, 'Sleep');
  t.check('with reduced motion it is black at once', await t.ev(`!!${SLEEP} && getComputedStyle(${SLEEP}).opacity === '1' && getComputedStyle(${SLEEP}).animationName === 'none'`));
  await press(t, 'Enter');
  t.check('and wakes at once', !(await t.ev(`!!${SLEEP}`)));
  await t.s('Emulation.setEmulatedMedia', { features: [] });

  // ---- Restart
  const ALERT = `document.querySelector('[role="alertdialog"]')`;
  await t.ev(`window.__notRestarted = 1`);
  await choose(t, 'Restart…');
  const alert = await t.ev(`(() => { const a = ${ALERT}; return a && { title: a.querySelector('.desktop-alert-title').textContent, buttons: [...a.querySelectorAll('button')].map(b => b.textContent), focus: document.activeElement.textContent }; })()`);
  t.check('Restart… asks first, in the site\'s own alert', alert?.title === 'Are you sure you want to restart your computer now?' && alert.buttons.join(',') === 'Cancel,Restart', JSON.stringify(alert));
  t.check('with Cancel focused, as the safe choice', alert?.focus === 'Cancel');
  await t.ev(`${ALERT}.dataset.checkAlert = '1'`);
  await t.shot('restart-alert-laptop-light.png', '[data-check-alert]');
  await clickOn(t, `[...${ALERT}.querySelectorAll('button')].find(b => b.textContent === 'Cancel')`);
  await sleep(1000);
  t.check('Cancel closes it and nothing restarts', !(await t.ev(`!!${ALERT}`)) && (await t.ev(`window.__notRestarted`)) === 1);
  await choose(t, 'Restart…');
  await press(t, 'Escape');
  await sleep(800);
  t.check('Escape cancels too', !(await t.ev(`!!${ALERT}`)) && (await t.ev(`window.__notRestarted`)) === 1);
  await choose(t, 'Restart…');
  await clickOn(t, `[...${ALERT}.querySelectorAll('button')].find(b => b.textContent === 'Restart')`);
  t.check('Restart fades the screen', await t.ev(`!!${SLEEP}`).catch(() => true));
  let reloaded = false;
  for (let i = 0; i < 30 && !reloaded; i++) {
    await sleep(300);
    reloaded = await t.ev(`window.__notRestarted === undefined && document.querySelectorAll('.dock-item').length > 0`).catch(() => false);
  }
  t.check('Restart reloads the page', reloaded);
  await sleep(500);

  // ---- Screenshots: the open menu and About This Mac in each look
  for (const [name, settings] of Object.entries(THEMES)) {
    await seed(t, settings);
    await showMenuForShot(t);
    await shotRegion(t, `menu-laptop-${name}.png`, 0, 0, 460, 220);
    await press(t, 'Escape');
    await choose(t, 'About This Mac');
    await t.ev(`${win('About This Mac')}.dataset.checkAbout = '1'`);
    await t.shot(`about-laptop-${name}.png`, '[data-check-about]');
    if (name === 'dark') {
      await dockClick(t, 'Notes');
      await sleep(250);
      await choose(t, 'Force Quit…');
      await clickOn(t, `${win('Force Quit Applications')}.querySelector('[role="option"]')`);
      await t.ev(`${win('Force Quit Applications')}.dataset.checkFq = '1'`);
      await t.shot('forcequit-laptop-dark.png', '[data-check-fq]');
      await choose(t, 'Restart…');
      await t.ev(`${ALERT}.dataset.checkAlert = '1'`);
      await t.shot('restart-alert-laptop-dark.png', '[data-check-alert]');
      await press(t, 'Escape');
    }
    await closeAll(t);
  }
} catch (e) {
  t.check('laptop script', false, e.message);
} finally {
  t.finish();
  t.close();
}

// ================= Phone, with touch
t = await launch(appUrl, outDir, { width: 390, height: 844 });
try {
  await t.s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await seed(t, THEMES.light);

  await tapOn(t, APPLE);
  t.check('phone: a tap on the 🍎 opens the menu', await isOpen(t));
  await tapOn(t, row('Dock'));
  t.check('phone: a tap on Dock ▸ opens its submenu', await t.ev(`!!${SUB}`));
  const place = await t.ev(`${SUB}.className`);
  t.check('phone: the menu and the submenu stay on screen', (await offScreen(t, 390)) === 0, place);
  await tapOn(t, row('Dock'));
  t.check('phone: a second tap leaves it open', await t.ev(`!!${SUB}`));
  await tapOn(t, row('System Preferences'));
  await sleep(300);
  const prefs = await t.ev(`(() => { const w = ${win('Preferences')}; if (!w) return null; const r = w.getBoundingClientRect(); return { x: Math.round(r.x), right: Math.round(r.right) }; })()`);
  t.check('phone: System Preferences… opens Preferences, on screen', !!prefs && prefs.x >= 0 && prefs.right <= 390 && !(await isOpen(t)), JSON.stringify(prefs));
  await t.ev(`${win('Preferences')}.dataset.checkPrefs = '1'`);
  await t.shot('phone-preferences-from-menu.png');
  await chooseInDock(t, 'Dock Preferences…', tapOn);
  t.check('phone: Dock Preferences… shows the Dock pane in the same window', (await count(t, 'Preferences')) === 1 && (await t.ev(`${win('Preferences')}.querySelector('.preferences-title').textContent`)) === 'Dock');
  await closeAll(t);

  await choose(t, 'Sleep', tapOn);
  await sleep(1300);
  await tap(t, 195, 400);
  await sleep(700);
  t.check('phone: a tap wakes Sleep', !(await t.ev(`!!document.querySelector('.desktop-sleep')`)));

  for (const [name, settings] of Object.entries(THEMES)) {
    await seed(t, settings);
    await tapOn(t, APPLE);
    await tapOn(t, row('Dock'));
    await t.waitFor(SUB, 'the Dock submenu', 3000);
    t.check(`phone, ${name}: menu and submenu on screen`, (await offScreen(t, 390)) === 0);
    await t.shot(`menu-phone-${name}.png`);
    await tapOn(t, row('Dock'));
    await t.clickAt(300, 600);
    await choose(t, 'About This Mac', tapOn);
    const about = await t.ev(`(() => { const w = ${win('About This Mac')}; const c = w.querySelector('.window-content'); const r = w.getBoundingClientRect();
      return { x: Math.round(r.x), right: Math.round(r.right), across: c.scrollWidth > c.clientWidth + 1 }; })()`);
    t.check(`phone, ${name}: About This Mac fits`, about.x >= 0 && about.right <= 390 && !about.across, JSON.stringify(about));
    await t.ev(`${win('About This Mac')}.dataset.checkAbout = '1'`);
    await t.shot(`about-phone-${name}.png`, '[data-check-about]');
    await closeAll(t);
  }

  await seed(t, { theme: 'light', textSize: 'larger' });
  await tapOn(t, APPLE);
  await tapOn(t, row('Dock'));
  await t.waitFor(SUB, 'the Dock submenu', 3000);
  const placeLarger = await t.ev(`${SUB}.className`);
  t.check('phone, Larger text: menu and submenu still on screen', (await offScreen(t, 390)) === 0, placeLarger);
  await t.shot('menu-phone-larger.png');
} catch (e) {
  t.check('phone script', false, e.message);
} finally {
  t.finish();
  t.close();
}
console.log(`screenshots: ${out}`);
