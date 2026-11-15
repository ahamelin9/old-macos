// Do the smaller apps behave? Camera turns the webcam off when its window
// closes, shows the picture again after Retake and downloads on Save; Notes
// keeps its text after the window closes; Safari
// shows search snippets as text, never as outside HTML; Pokémon says when a
// name doesn't exist and offers Try again; Music's volume slider works.
// Safari's search is answered with a canned reply, so it costs no Brave quota.
//
//   node .claude/skills/know-how/app-check.mjs http://127.0.0.1:5199 [outDir]
import { launch, sleep, FAKE_CAMERA } from './cdp.mjs';

const [appUrl = 'http://127.0.0.1:5199', outDir] = process.argv.slice(2);
const inWindow = (title, selector) =>
  `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)})?.querySelector(${JSON.stringify(selector)})`;

const t = await launch(appUrl, outDir, { width: 1400, height: 900, chromeArgs: FAKE_CAMERA });
try {
  // ---- Camera
  // Keep every stream the page asks for, and note downloads instead of saving them
  await t.ev(`(() => {
    window.__streams = [];
    const md = navigator.mediaDevices, get = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await get(c); window.__streams.push(s); return s; };
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () { window.__downloads.push(this.download); };
  })()`);
  await t.openApp('Camera');
  await t.waitFor(`${inWindow('Camera', 'video')}?.videoWidth > 0`, 'camera picture', 15000);
  t.check('the camera shows a picture', true);
  await t.ev(`${inWindow('Camera', '.camera-capture-button')}.click()`);
  await t.waitFor(`${inWindow('Camera', '.camera-photo-preview')}`, 'photo preview', 5000);
  t.check('Take Photo shows the photo', await t.ev(`${inWindow('Camera', '.camera-photo-preview')}.src.startsWith('data:image/jpeg')`));
  await t.ev(`[...${inWindow('Camera', '.camera-photo-actions')}.querySelectorAll('button')].find(b => b.textContent.includes('Save')).click()`);
  const downloads = await t.ev(`window.__downloads`);
  t.check('Save downloads a JPEG', downloads.length === 1 && /^photo-.*\.jpg$/.test(downloads[0]), downloads.join(', '));
  await t.ev(`[...${inWindow('Camera', '.camera-photo-actions')}.querySelectorAll('button')].find(b => b.textContent.includes('Retake')).click()`);
  await sleep(1500);
  t.check('after Retake the camera shows a picture again', await t.ev(`${inWindow('Camera', 'video')}?.videoWidth > 0`));
  await t.ev(`${inWindow('Camera', '.window-close')}.click()`);
  await sleep(500);
  const live = await t.ev(`window.__streams.flatMap(s => s.getTracks()).filter(tr => tr.readyState === 'live').length`);
  const total = await t.ev(`window.__streams.length`);
  t.check('closing Camera turns the webcam off', total > 0 && live === 0, `${live} live track(s) from ${total} stream(s)`);

  // ---- Notes
  await t.openApp('Notes');
  await t.typeInto('.notes-textarea', 'remember the milk');
  await t.ev(`${inWindow('Notes', '.window-close')}.click()`);
  await t.openApp('Notes');
  t.check('Notes keeps its text after closing', (await t.ev(`document.querySelector('.notes-textarea').value`)) === 'remember the milk');
  await t.ev(`${inWindow('Notes', '.window-close')}.click()`);

  // ---- Safari, with a canned search reply
  await t.ev(`(() => {
    const realFetch = window.fetch;
    window.fetch = (url, opts) => {
      if (!String(url).includes('brave-search-worker')) return realFetch(url, opts);
      const body = String(url).includes('nothing') ? {} : { web: { results: [
        { title: 'Tricky', url: 'javascript:window.__clicked=1', description: 'Hello <strong>world</strong> <img src=x onerror="window.__xss=1">' },
        { title: 'Plain', url: 'https://example.com/', description: 'plain &amp; simple' }
      ] } };
      return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    };
  })()`);
  await t.openApp('Safari');
  const search = async (q) => {
    await t.typeInto('.safari-input', q);
    await t.ev(`document.querySelector('.safari-search-box').requestSubmit()`);
    await sleep(800);
  };
  await search('anything');
  const safari = await t.ev(`(() => {
    const r = [...document.querySelectorAll('.safari-result')];
    return { n: r.length, bold: r[0]?.querySelector('strong')?.textContent, imgs: document.querySelectorAll('.safari-results img').length,
      href0: r[0]?.querySelector('a').getAttribute('href'), href1: r[1]?.querySelector('a').getAttribute('href'),
      text1: r[1]?.querySelector('.safari-result-snippet').textContent, xss: window.__xss ?? null };
  })()`);
  t.check('Safari lists the results', safari.n === 2, `${safari.n} results`);
  t.check('matched words are bold', safari.bold === 'world', safari.bold);
  t.check('outside HTML is not run or shown', safari.imgs === 0 && safari.xss === null, `imgs ${safari.imgs}, xss ${safari.xss}`);
  t.check('only web links are links', safari.href0 === null && safari.href1 === 'https://example.com/', `${safari.href0} / ${safari.href1}`);
  t.check('entities read as text', safari.text1 === 'plain & simple', safari.text1);
  await search('nothing');
  t.check('no results says so', await t.ev(`[...document.querySelectorAll('.safari-error')].some(e => e.textContent === 'No results found.')`));

  // ---- Pokémon (two real PokeAPI requests for the missing name, one for Pikachu)
  await t.openApp('Pokemon');
  await t.waitFor(`document.querySelector('.pokemon-name')`, 'first Pokémon', 20000);
  await t.ev(`(() => {
    window.__missingAsks = 0;
    const f = window.fetch;
    window.fetch = (url, opts) => { if (String(url).includes('notapokemonxyz')) window.__missingAsks++; return f(url, opts); };
  })()`);
  await t.typeInto('.search-form input', 'notapokemonxyz');
  await t.ev(`document.querySelector('.search-form').requestSubmit()`);
  await t.waitFor(`document.querySelector('.error-state')`, 'error', 15000);
  t.check('a missing name says so', await t.ev(`document.querySelector('.error-state').textContent.includes('No Pokémon called "notapokemonxyz"')`),
    await t.ev(`document.querySelector('.error-state').textContent`));
  await t.ev(`document.querySelector('.error-state .retry-button').click()`);
  await t.waitFor(`window.__missingAsks === 2 && document.querySelector('.error-state')`, 'error after Try again', 15000);
  t.check('Try again asks again', true);
  await t.typeInto('.search-form input', 'pikachu');
  await t.ev(`document.querySelector('.search-form').requestSubmit()`);
  await t.waitFor(`document.querySelector('.pokemon-name')?.textContent.includes('Pikachu')`, 'Pikachu', 20000);
  t.check('a real name still loads', true);

  // ---- Music volume (shown once the window is wide enough)
  await t.openApp('Music');
  await t.ev(`${inWindow('Music', '.window-maximize')}.click()`);
  await sleep(800);
  t.check('the volume slider shows in a wide window', await t.ev(`${inWindow('Music', '.music-volume')}.getBoundingClientRect().width > 0`));
  await t.typeInto('.music-volume-slider', '30');
  await sleep(200);
  t.check('moving the volume slider keeps its place', (await t.ev(`document.querySelector('.music-volume-slider').value`)) === '30');
  await t.shot('apps.png');
} finally {
  // Music's backend usually isn't running during a check, and PokeAPI answers the missing name with a 404
  t.finish([/Failed to load resource/, /Guest fetch error/]);
  t.close();
}
