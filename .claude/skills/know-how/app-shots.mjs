// Before-and-after screenshots of every app, for checking a style change by
// eye, on a laptop and on a phone. Take a set before the change and one
// after, then compare: it lists which shots changed and saves a diff image
// of each (changed pixels in red over a faded copy of the "after" shot) and
// a pair-<name> image with before on the left and after on the right.
//
//   node .claude/skills/know-how/app-shots.mjs <appUrl> <outDir> [App name…]
//   node .claude/skills/know-how/app-shots.mjs --compare <beforeDir> <afterDir> <diffDir>
//
// Per app it saves laptop-<app>-small.png (the 400x300 window it opens in),
// laptop-<app>-max.png (maximized), and, for the five apps the phone dock
// shows, phone-<app>.png and phone-<app>-max.png. Plus laptop-desktop.png
// and phone-desktop.png.
// Math.random is seeded, so window spots and Field Guide's random picks
// repeat; animations are off and the clock is hidden. Live data (NASA's
// picture of the day, iNaturalist) can still change between runs, so take
// two "before" sets and compare them to see the noise first.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const args = process.argv.slice(2);
const slug = (name) => name.replace(/\W+/g, '-').toLowerCase();

// The same "random" numbers on every run, and fixed NASA pictures of the day
// (they change daily). The replies are shaped like science.nasa.gov's APOD
// posts (the apis skill, nasa.md): today (per_page=1), the sidebar's list of
// past days (per_page=20&page=N, three pages, with X-WP-TotalPages), and one
// day's post (image-article/<id>). Every seventh day has no thumbnail.
const SEEDED_RANDOM = `(() => {
  let s = 20261115; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const realFetch = window.fetch;
  const post = (n) => ({
    id: 1000 - n,
    date: new Date(Date.UTC(2026, 10, 15 - n)).toISOString().slice(0, 10) + 'T00:05:00',
    link: 'https://science.nasa.gov/apod/',
    title: { rendered: n ? 'A Test Sky, ' + n + ' days ago' : 'APOD: 2026 November 15 &#8211; A Test Sky' },
    content: { rendered: '<p><strong>Explanation:</strong> ' +
      'A fixed picture for screenshot checks, so the layout can be compared from one run to the next. '.repeat(4) +
      '</p><p>Date: November 15, 2026</p><p>Credit &amp; Copyright: Test Photographer</p><p>Authors &amp; editors: Test</p>' },
    _embedded: { 'wp:featuredmedia': [{ source_url: '/mac-os-background.jpg',
      media_details: { sizes: n % 7 === 6 ? {} : { 'thumbnail-sm': { source_url: '/mac-os-background.jpg' } } } }] }
  });
  const reply = (body, headers = {}) =>
    Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', ...headers } }));
  window.fetch = (url, opts) => {
    const u = String(url);
    if (!u.includes('science.nasa.gov/wp-json/wp/v2/image-article')) return realFetch(url, opts);
    const one = u.match(/image-article\\/(\\d+)/);
    if (one) return reply(post(1000 - Number(one[1])));
    const q = new URL(u).searchParams;
    const per = Number(q.get('per_page') || 10), page = Number(q.get('page') || 1);
    return reply(Array.from({ length: per }, (_, i) => post((page - 1) * per + i)),
      { 'X-WP-Total': String(per * 3), 'X-WP-TotalPages': '3' });
  };
})();`;
const STEADY = `const st = document.createElement('style');
  st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } .menu-status { visibility: hidden !important; }';
  document.head.appendChild(st);`;

// Wait until the window's content has settled: no "Loading" text and images done
const settle = async (t) => {
  for (let i = 0; i < 40; i++) {
    const busy = await t.ev(`(() => {
      const w = [...document.querySelectorAll('.window')].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0];
      if (!w) return false;
      const loading = /loading|connecting|searching/i.test(w.querySelector('.window-content')?.innerText ?? '');
      const images = [...w.querySelectorAll('img')].some(img => !img.complete);
      return loading || images;
    })()`);
    if (!busy) break;
    await sleep(500);
  }
  await sleep(1200);
};

const frontWindow = `[...document.querySelectorAll('.window')].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0]`;

const shoot = async (appUrl, outDir, only) => {
  mkdirSync(outDir, { recursive: true });
  for (const [device, width, height] of [['laptop', 1400, 900], ['phone', 390, 844]]) {
    const t = await launch(appUrl, outDir, { width, height });
    try {
      await t.s('Page.addScriptToEvaluateOnNewDocument', { source: SEEDED_RANDOM });
      await t.s('Page.reload');
      await t.waitFor(`document.querySelectorAll('.dock-item').length > 0`, 'the dock');
      await t.ev(STEADY);
      await sleep(800);
      await t.shot(`${device}-desktop.png`);
      const apps = await t.ev(`[...document.querySelectorAll('.dock-item:not(.minimized-window) .dock-label')].map(l => l.textContent.trim())`);
      for (const app of apps) {
        if (only.length && !only.includes(app)) continue;
        await t.openApp(app);
        // Mark the front window, so the shot is of it alone
        await t.ev(`(() => { document.querySelectorAll('[data-shot]').forEach(e => delete e.dataset.shot); ${frontWindow}.dataset.shot = '1'; })()`);
        await settle(t);
        if (device === 'laptop') {
          await t.shot(`laptop-${slug(app)}-small.png`, '[data-shot="1"]');
          await t.ev(`${frontWindow}.querySelector('.window-maximize').click()`);
          await settle(t);
          await t.shot(`laptop-${slug(app)}-max.png`, '[data-shot="1"]');
        } else {
          await t.shot(`phone-${slug(app)}.png`);
          await t.ev(`${frontWindow}.querySelector('.window-maximize').click()`);
          await settle(t);
          await t.shot(`phone-${slug(app)}-max.png`);
        }
        await t.ev(`[...document.querySelectorAll('.window-close')].forEach(b => b.click())`);
        await sleep(300);
      }
    } finally {
      t.close();
    }
  }
  console.log(`saved to ${outDir}`);
};

const compare = async (beforeDir, afterDir, diffDir) => {
  mkdirSync(diffDir, { recursive: true });
  const names = readdirSync(afterDir).filter(f => f.endsWith('.png') && existsSync(join(beforeDir, f)));
  const t = await launch('about:blank', diffDir, { width: 800, height: 600 });
  const rows = [];
  try {
    for (const name of names) {
      const a = readFileSync(join(beforeDir, name)).toString('base64');
      const b = readFileSync(join(afterDir, name)).toString('base64');
      const r = await t.ev(`(async () => {
        const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
        const [a, b] = await Promise.all([load('data:image/png;base64,${a}'), load('data:image/png;base64,${b}')]);
        const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
        const px = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
        const pa = px(a), pb = px(b);
        const out = new OffscreenCanvas(w, h), ox = out.getContext('2d');
        const d = ox.createImageData(w, h);
        let changed = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const diff = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) + Math.abs(pa[i + 3] - pb[i + 3]);
          if (diff > 24) { changed++; d.data.set([255, 0, 0, 255], i); }
          else { const g = 255 - (255 - (pb[i] + pb[i + 1] + pb[i + 2]) / 3) * 0.3; d.data.set([g, g, g, 255], i); }
        }
        ox.putImageData(d, 0, 0);
        const toBase64 = async (canvas) => {
          const buf = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
          let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          return btoa(bin);
        };
        // Before on the left, after on the right
        const pair = new OffscreenCanvas(a.width + b.width + 24, Math.max(a.height, b.height));
        const px2 = pair.getContext('2d');
        px2.fillStyle = '#ff00ff'; px2.fillRect(a.width, 0, 24, pair.height);
        px2.drawImage(a, 0, 0); px2.drawImage(b, a.width + 24, 0);
        return { sizeA: a.width + 'x' + a.height, sizeB: b.width + 'x' + b.height, changed, total: w * h,
          png: changed ? await toBase64(out) : null, pair: changed ? await toBase64(pair) : null };
      })()`);
      const pct = (100 * r.changed / r.total).toFixed(2);
      if (r.png) writeFileSync(join(diffDir, name), Buffer.from(r.png, 'base64'));
      if (r.pair) writeFileSync(join(diffDir, `pair-${name}`), Buffer.from(r.pair, 'base64'));
      rows.push({ name, pct: +pct, note: r.sizeA !== r.sizeB ? `size ${r.sizeA} -> ${r.sizeB}` : '' });
    }
  } finally {
    t.close();
  }
  for (const row of rows.sort((x, y) => y.pct - x.pct)) {
    console.log(`${row.pct > 0 ? 'CHANGED' : 'same   '}  ${String(row.pct).padStart(6)}%  ${row.name}${row.note ? '  ' + row.note : ''}`);
  }
  console.log(`\n${rows.filter(r => r.pct > 0).length} of ${rows.length} shots changed; diff images in ${diffDir}`);
};

if (args[0] === '--compare') await compare(args[1], args[2], args[3]);
else {
  const [appUrl, outDir, ...only] = args;
  if (!appUrl || !outDir) throw new Error('usage: app-shots.mjs <appUrl> <outDir> [App…]  |  --compare <before> <after> <diff>');
  await shoot(appUrl, outDir, only);
}
