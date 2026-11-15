// Does every app in the dock still open? Opens each one in headless Chrome,
// checks a window appears with content, closes it, and fails on any page error.
// It runs at desktop width, then at phone width (under 800px the dock shows
// only five apps).
//
//   node .claude/skills/know-how/smoke-check.mjs http://127.0.0.1:5173 [outDir]
//
// Screenshots of each window land in outDir (a temp folder if omitted).
import { launch, sleep } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5173', outDir] = process.argv.slice(2);

// Console noise that is expected in headless Chrome, not a bug in the site
const EXPECTED_NOISE = [
  /getUserMedia|NotFoundError|NotAllowedError|Requested device not found|Error accessing (the )?camera/i, // Camera: no webcam
  /Failed to load resource: the server responded with a status of 401/i // Spotify /v1/me without a login
];

// Music's guest mode fetches /api/client_credentials, which locally needs the
// FastAPI backend (npm run backend). Without it, that error is expected.
const backendUp = await fetch('http://127.0.0.1:8000/docs').then(r => r.ok, () => false);
if (!backendUp) {
  console.log('note: the Spotify backend (port 8000) is not running, so Music\'s "Guest fetch error" is expected');
  EXPECTED_NOISE.push(/Guest fetch error/);
}

const run = async (label, width, height) => {
  console.log(`\n== ${label} (${width}x${height})`);
  const t = await launch(appUrl, outDir, { width, height });
  try {
    await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
    const apps = await t.ev(`[...document.querySelectorAll('.dock-item:not(.minimized-window) .dock-label')].map(l => l.textContent.trim())`);
    console.log(`dock: ${apps.join(', ')}`);
    for (const name of apps) {
      try {
        await t.openApp(name);
        const info = await t.ev(`(() => {
          const ws = [...document.querySelectorAll('.window')];
          const w = ws.sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0];
          const c = w?.querySelector('.window-content');
          return { title: w?.querySelector('.window-title')?.textContent, children: c?.children.length ?? 0 };
        })()`);
        await sleep(700);
        await t.shot(`${label}-${name.replace(/\W+/g, '-').toLowerCase()}.png`);
        t.check(`${name} opens`, info.children > 0, `window "${info.title}"`);
        // Close every open window before the next app
        await t.ev(`[...document.querySelectorAll('.window-close')].forEach(b => b.click())`);
        await sleep(300);
      } catch (err) {
        t.check(`${name} opens`, false, err.message);
      }
    }
  } finally {
    t.finish(EXPECTED_NOISE);
    t.close();
    console.log(`screenshots: ${t.outDir}`);
  }
};

await run('desktop', 1400, 900);
await run('phone', 390, 844);
