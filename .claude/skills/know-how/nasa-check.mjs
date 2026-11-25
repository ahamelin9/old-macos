// NASA News's sidebar of past days, against live science.nasa.gov, at the
// three sizes every app must work at: the 400x300 window it opens in, that
// window maximized on a laptop, and a 390px phone.
//
//   node .claude/skills/know-how/nasa-check.mjs <appUrl> <outDir> [pictureDay videoDay embedDay]
//
// At each size it checks:
//  - the round ☰ sits in the heading row, centred with the heading and clear
//    of its text, with no bar above it;
//  - the list isn't fetched until the sidebar opens; rows show a date, a clean
//    title and a loaded thumbnail;
//  - scrolling to the bottom loads the next 20 by itself, one page at a time,
//    and a short list doesn't set off a burst;
//  - picking a picture day, an .mp4 day and a YouTube day shows each; a day
//    picked twice is fetched once; the Today row comes back;
//  - search ("rocket") shows a count and matching days, scrolls for more, says
//    when nothing matches, and ✕ or Escape brings back the plain list without
//    fetching it again;
//  - the date box shows 1995-06-20 (Pleiades Star Cluster), and says "No
//    picture on" 1995-06-18, a day APOD skipped.
// Maximized, it also checks a slow reply can't replace a newer pick or search.
// In a narrow window the list must slide over the picture and close when a day
// is picked; in a wide one it sits beside it.
//
// The days default to 2026-11-14 (a picture), 2026-10-28 (NASA's own .mp4) and
// 2026-10-18 (a YouTube embed). They're found by scrolling up to five pages, so
// once they're older than that, pass newer ones (find video days in nasa.md).
// About 15 requests to science.nasa.gov per size, a second or more apart.
import { launch, sleep } from './cdp.mjs';

const [appUrl, outDir, pictureDay = '2026-11-14', videoDay = '2026-10-28', embedDay = '2026-10-18'] = process.argv.slice(2);
if (!appUrl || !outDir) throw new Error('usage: nasa-check.mjs <appUrl> <outDir> [pictureDay videoDay embedDay]');

const front = `[...document.querySelectorAll('.window')].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0]`;
const app = `${front}.querySelector('.nasa-app')`;
const scroller = `${app}.querySelector('.nasa-day-scroll')`;
const row = (date) => `[...${app}.querySelectorAll('.nasa-day')].find(b => b.querySelector('.nasa-day-date')?.textContent === ${JSON.stringify(date)})`;
const rowCount = `${app}.querySelectorAll('.nasa-day').length`;
const expanded = `${app}.querySelector('.nasa-sidebar-toggle').getAttribute('aria-expanded')`;
const shownDate = `${app}.querySelector('.nasa-main .apod-date')?.textContent`;
const shownTitle = `${app}.querySelector('.nasa-main .apod-title')?.textContent`;
const status = `${app}.querySelector('.nasa-main .nasa-status')?.textContent`;
const countText = `${app}.querySelector('.nasa-result-count')?.textContent ?? ''`;
const requests = (part) => `performance.getEntriesByType('resource').filter(e => e.name.includes(${JSON.stringify(part)})).length`;

// Counts list requests in flight, to prove pages load one at a time
const COUNT_LIST_REQUESTS = `(() => {
  const real = window.fetch;
  window.__list = { now: 0, most: 0 };
  window.fetch = (url, opts) => {
    if (!/image-article\\?.*per_page=20/.test(String(url))) return real(url, opts);
    window.__list.now++; window.__list.most = Math.max(window.__list.most, window.__list.now);
    return real(url, opts).finally(() => window.__list.now--);
  };
})()`;
// Holds back the next reply matching a pattern for 2.5 s
const delayNext = (pattern) => `(() => {
  const real = window.fetch;
  let done = false;
  window.fetch = (url, opts) => !done && new RegExp(${JSON.stringify(pattern)}).test(String(url))
    ? (done = true, window.__lateDone = false, new Promise(r => setTimeout(r, 2500)).then(() => real(url, opts)).finally(() => setTimeout(() => { window.__lateDone = true; }, 50)))
    : real(url, opts);
})()`;

const sizes = [
  { name: 'laptop-small', width: 1400, height: 900, maximize: false },
  { name: 'laptop-max', width: 1400, height: 900, maximize: true },
  { name: 'phone', width: 390, height: 844, maximize: false }
];

for (const size of sizes) {
  console.log(`\n== ${size.name}`);
  const t = await launch(appUrl, outDir, { width: size.width, height: size.height });
  const step = (name) => `${size.name}: ${name}`;
  const shot = (name) => t.shot(`${size.name}-${name}.png`, size.name === 'phone' ? undefined : '.window');

  // A real click at the element's middle, after checking nothing covers it there
  const realClick = async (el, label) => {
    const at = await t.ev(`(() => {
      const el = ${el};
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      const x = r.x + Math.min(r.width / 2, 60), y = r.y + r.height / 2;
      return { x, y, onTop: el.contains(document.elementFromPoint(x, y)) };
    })()`);
    if (!at) throw new Error(`no ${label} to click`);
    if (!at.onTop) throw new Error(`${label} is covered by something else`);
    await t.clickAt(at.x, at.y);
  };
  const openSidebar = async () => {
    if ((await t.ev(expanded)) === 'false') {
      await sleep(350); // a list sliding away still covers the ☰
      await realClick(`${app}.querySelector('.nasa-sidebar-toggle')`, 'the ☰ button');
    }
    await t.waitFor(`${expanded} === 'true'`, 'the sidebar to open', 5000);
    await sleep(350); // the slide
  };
  const narrow = () => t.ev(`getComputedStyle(${app}.querySelector('.nasa-sidebar')).position === 'absolute'`);
  const scrollToEnd = async () => {
    const before = await t.ev(rowCount);
    await t.ev(`${scroller}.scrollTop = ${scroller}.scrollHeight`);
    await t.waitFor(`${rowCount} > ${before} || ${app}.querySelector('.nasa-list-note')?.textContent.startsWith("That's every")`, 'the next page', 20000);
    await t.waitFor(`!${app}.querySelector('.nasa-day-scroll .nasa-list-note')?.textContent.startsWith('Loading')`, 'loading to finish', 20000);
    return (await t.ev(rowCount)) - before;
  };
  const pick = async (date) => {
    await openSidebar();
    for (let page = 0; page < 5 && !(await t.ev(`!!${row(date)}`)); page++) await scrollToEnd();
    await realClick(row(date), `the ${date} row`);
    await t.waitFor(`${shownDate} === ${JSON.stringify(date)}`, `${date} to show`, 20000);
  };
  const searchFor = async (words) => {
    await openSidebar();
    await t.typeInto(`[data-check="1"] .nasa-search-field`, words);
  };
  const goToDate = async (date) => {
    await openSidebar();
    await t.typeInto(`[data-check="1"] .nasa-date-field`, date);
  };

  try {
    await t.ev(COUNT_LIST_REQUESTS);
    await t.openApp('Nasa News');
    await t.ev(`${app}.dataset.check = '1'`);
    if (size.maximize) await t.ev(`${front}.querySelector('.window-maximize').click()`);
    await t.waitFor(`${app}.querySelector('.apod-title')`, "today's picture", 20000);
    const today = await t.ev(shownDate);

    // The ☰: a real button, round and 34px, in the heading row, clear of the title
    const button = await t.ev(`(() => {
      const b = ${app}.querySelector('.nasa-sidebar-toggle'), h = ${app}.querySelector('.nasa-title');
      const br = b.getBoundingClientRect(), hr = h.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(h);
      const lines = [...range.getClientRects()];
      const s = getComputedStyle(b);
      return {
        tag: b.tagName, label: b.getAttribute('aria-label'), controls: !!document.getElementById(b.getAttribute('aria-controls')),
        inRow: b.parentElement.classList.contains('nasa-heading-row'), size: Math.round(br.width) + 'x' + Math.round(br.height),
        round: s.borderRadius, blur: s.backdropFilter,
        centreGap: Math.round(Math.abs((br.top + br.bottom) / 2 - (hr.top + hr.bottom) / 2)),
        clearOfText: lines.every(l => l.right <= br.left - 4), titleLines: lines.length,
        toolbar: !!${app}.querySelector('.mac-toolbar'),
        firstInContent: Math.round(br.top - ${front}.querySelector('.window-content').getBoundingClientRect().top)
      };
    })()`);
    t.check(step('☰ is a real button with a label, aria-expanded and aria-controls'),
      button.tag === 'BUTTON' && button.label && button.controls && (await t.ev(expanded)) === 'false');
    t.check(step('☰ is round, 34px, glassy, in the heading row, centred with it and clear of its text, no bar above'),
      button.inRow && button.size === '34x34' && button.round === '50%' && /blur/.test(button.blur) &&
      button.centreGap <= 2 && button.clearOfText && !button.toolbar, JSON.stringify(button));
    t.check(step('no list request before the sidebar opens'), (await t.ev(requests('per_page=20'))) === 0);
    // The title shows before the picture has downloaded: wait, so the shot isn't blank
    await t.waitFor(`(() => { const i = ${app}.querySelector('.apod-image'); return !i || (i.complete && i.naturalWidth > 0); })()`, "today's picture", 20000);
    await shot('01-today');

    // Open: the first page, and no burst
    await openSidebar();
    await t.waitFor(`${rowCount} >= 20`, 'the first page of days', 20000);
    await sleep(3000);
    const settled = await t.ev(`(() => {
      const root = ${scroller}.getBoundingClientRect(), end = ${app}.querySelector('.nasa-list-end').getBoundingClientRect();
      return { requests: ${requests('per_page=20')}, endBelow: Math.round(end.top - root.bottom) };
    })()`);
    t.check(step('opening loads one page, and only loads more while the end is in view'),
      settled.requests >= 1 && settled.requests <= 3 && settled.endBelow > 200, JSON.stringify(settled));
    await t.waitFor(`[...${app}.querySelectorAll('.nasa-day img.nasa-thumb')].slice(0, 3).every(i => i.complete && i.naturalWidth > 0)`, 'thumbnails', 20000);
    const rows = await t.ev(`[...${app}.querySelectorAll('.nasa-day')].slice(1, 21).map(b => ({
      date: b.querySelector('.nasa-day-date').textContent, title: b.querySelector('.nasa-day-title').textContent }))`);
    t.check(step('rows show a date and a clean title'),
      rows.length >= 19 && rows.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.title && !/APOD:|&#|&amp;/.test(r.title)),
      `${rows[0].date} "${rows[0].title}"`);
    t.check(step('Today is not listed twice'), !rows.some(r => r.date === today));
    t.check(step('the first rows show a loaded thumbnail'),
      await t.ev(`[...${app}.querySelectorAll('.nasa-day')].slice(1, 3).every(b => { const i = b.querySelector('img.nasa-thumb'); return i && i.complete && i.naturalWidth > 0; })`));
    const isNarrow = await narrow();
    const layout = await t.ev(`(() => {
      const s = ${app}.querySelector('.nasa-sidebar').getBoundingClientRect(), m = ${app}.querySelector('.nasa-main').getBoundingClientRect();
      const w = ${front}.getBoundingClientRect(), a = ${app};
      return { overlaps: s.left < m.right - 1, inside: s.left >= w.left - 1 && s.right <= w.right + 1,
        noSideScroll: a.scrollWidth <= a.clientWidth, listHeight: Math.round(${scroller}.getBoundingClientRect().height) };
    })()`);
    t.check(step(isNarrow ? 'narrow: the list slides over the picture' : 'wide: the list sits beside the picture'),
      (isNarrow ? layout.overlaps : !layout.overlaps) && layout.inside && layout.noSideScroll && layout.listHeight >= 100, JSON.stringify(layout));
    t.check(step('the layout is the one this width should have'), isNarrow === !size.maximize);
    await shot('02-sidebar');

    // Scrolling to the end loads the next 20, one page at a time
    const pagesBefore = await t.ev(requests('per_page=20'));
    const added = await scrollToEnd();
    t.check(step('scrolling to the bottom loads the next 20 by itself'),
      added === 20 && (await t.ev(requests('per_page=20'))) === pagesBefore + 1, `+${added}`);
    await shot('03-scrolled');

    await pick(pictureDay);
    await t.waitFor(`${app}.querySelector('.nasa-main img.apod-image')?.complete && ${app}.querySelector('.nasa-main img.apod-image').naturalWidth > 0`, 'the picture', 20000);
    t.check(step(`${pictureDay} shows its picture`), /^https:\/\/assets\.science\.nasa\.gov\//.test(await t.ev(`${app}.querySelector('.nasa-main img.apod-image').src`)), await t.ev(shownTitle));
    t.check(step(isNarrow ? 'narrow: picking a day closes the list' : 'wide: the list stays open'),
      (await t.ev(expanded)) === (isNarrow ? 'false' : 'true'));
    await shot('04-picture-day');

    await pick(videoDay);
    const video = await t.ev(`${app}.querySelector('.nasa-main video.apod-video')?.src ?? null`);
    t.check(step(`${videoDay} shows its .mp4`), /\.mp4(\?|$)/.test(video ?? ''), video);
    await shot('05-video-day');

    await pick(embedDay);
    const embed = await t.ev(`${app}.querySelector('.nasa-main iframe.apod-video')?.src ?? null`);
    t.check(step(`${embedDay} shows its YouTube video`), /^https:\/\/www\.youtube\.com\/embed\//.test(embed ?? ''), embed);
    await shot('06-embed-day');

    const asked = await t.ev(requests('image-article/'));
    await pick(pictureDay);
    t.check(step('a day picked twice is fetched once'), (await t.ev(requests('image-article/'))) === asked);

    if (size.maximize) {
      const [slow, fast] = await t.ev(`[...${app}.querySelectorAll('.nasa-day')].slice(4, 6).map(b => b.querySelector('.nasa-day-date').textContent)`);
      await t.ev(delayNext('image-article\\/\\d+'));
      await realClick(row(slow), `the ${slow} row`);
      await realClick(row(fast), `the ${fast} row`);
      await t.waitFor(`${shownDate} === ${JSON.stringify(fast)}`, `${fast} to show`, 20000);
      await t.waitFor('window.__lateDone', 'the late reply', 10000);
      await t.settle();
      t.check(step('a late reply for an earlier pick is dropped'), (await t.ev(shownDate)) === fast, `picked ${slow} then ${fast}; shows ${await t.ev(shownDate)}`);
    }

    // Search
    const plainRows = await t.ev(rowCount);
    const plainRequests = await t.ev(requests('per_page=20'));
    if (size.maximize) {
      // A slow reply for an older search mustn't replace a newer one
      await t.ev(delayNext('search=horsehead'));
      await searchFor('horsehead');
      await sleep(700); // past the 400 ms pause, so the horsehead request goes out
      await searchFor('rocket');
    } else {
      await searchFor('rocket');
    }
    await t.waitFor(`/^[\\d,]+ days$/.test(${countText})`, 'the result count', 20000);
    await t.waitFor(`${rowCount} >= 20`, 'the results', 20000);
    const count = await t.ev(countText);
    t.check(step('search shows a count and 20 matching days, without the Today row'),
      Number(count.replace(/\D/g, '')) > 100 && (await t.ev(rowCount)) === 20 && !(await t.ev(`!!${app}.querySelector('.nasa-day-today')`)), count);
    t.check(step('search asked for rocket, title matches first'), (await t.ev(requests('search=rocket&orderby=relevance'))) === 1);
    if (size.maximize) {
      await t.waitFor('window.__lateDone', 'the late search reply', 10000);
      await t.settle();
      t.check(step('a late reply for an older search is dropped'),
        (await t.ev(countText)) === count && !(await t.ev(`[...${app}.querySelectorAll('.nasa-day-title')].some(e => /horsehead/i.test(e.textContent))`)));
    }
    await shot('07-search');
    const moreFound = await scrollToEnd();
    t.check(step('scrolling the results loads 20 more'), moreFound === 20 && (await t.ev(requests('search=rocket&orderby=relevance&page=2'))) + (await t.ev(requests('page=2&search=rocket'))) >= 1, `+${moreFound}`);
    t.check(step('never more than one list request at a time'), (await t.ev('window.__list.most')) === 1, `most at once: ${await t.ev('window.__list.most')}`);

    // Clear with ✕ (Escape on the phone): the plain list, as it was, not fetched again
    if (size.name === 'phone') {
      await t.ev(`document.querySelector('[data-check="1"] .nasa-search-field').focus()`);
      await t.s('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await t.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    } else {
      await realClick(`${app}.querySelector('.nasa-search-clear')`, 'the ✕');
    }
    await t.waitFor(`!!${app}.querySelector('.nasa-day-today')`, 'the plain list', 5000);
    t.check(step(`${size.name === 'phone' ? 'Escape' : '✕'} brings back the plain list without fetching it again`),
      (await t.ev(rowCount)) === plainRows && (await t.ev(`${app}.querySelector('.nasa-search-field').value`)) === '' &&
      (await t.ev(requests('per_page=20'))) === plainRequests + (await t.ev(`performance.getEntriesByType('resource').filter(e => /per_page=20.*search=/.test(e.name)).length`)),
      `${await t.ev(rowCount)} rows`);

    await searchFor('zzqxv');
    await t.waitFor(`/No days match/.test(${countText})`, '"No days match"', 20000);
    t.check(step('a search with no results says "No days match"'), (await t.ev(`${app}.querySelectorAll('.nasa-day').length`)) === 0, await t.ev(countText));
    await shot('08-no-match');
    await realClick(`${app}.querySelector('.nasa-search-clear')`, 'the ✕');
    await t.waitFor(`!!${app}.querySelector('.nasa-day-today')`, 'the plain list', 5000);

    // The date box
    await goToDate('1995-06-20');
    await t.waitFor(`${shownDate} === '1995-06-20'`, '1995-06-20', 20000);
    await t.waitFor(`${app}.querySelector('.nasa-main img.apod-image')?.complete && ${app}.querySelector('.nasa-main img.apod-image').naturalWidth > 0`, 'the picture', 20000);
    t.check(step('the date box shows 1995-06-20, Pleiades Star Cluster, with its own picture'),
      (await t.ev(shownTitle)) === 'Pleiades Star Cluster' && /pleiades2\.gif$/.test(await t.ev(`${app}.querySelector('.nasa-main img.apod-image').src`)),
      await t.ev(shownTitle));
    t.check(step(isNarrow ? 'narrow: picking a date closes the list' : 'wide: the list stays open'),
      (await t.ev(expanded)) === (isNarrow ? 'false' : 'true'));
    await shot('09-date');

    await goToDate('1995-06-18');
    await t.waitFor(`/No picture on 1995-06-18/.test(${status})`, '"No picture on"', 20000);
    t.check(step('a day APOD skipped says "No picture on 1995-06-18."'), true, await t.ev(status));
    await shot('10-gap-day');

    // Back to today
    await openSidebar();
    await realClick(`${app}.querySelector('.nasa-day-today')`, 'the Today row');
    await t.waitFor(`${shownDate} === ${JSON.stringify(today)}`, 'today', 5000);
    t.check(step('the Today row returns to today, and empties the date box'), (await t.ev(`${app}.querySelector('.nasa-date-field').value`)) === '');
    if (!isNarrow) await shot('11-back-to-today');
    else { await openSidebar(); await shot('11-sidebar-top'); }
  } catch (e) {
    t.check(step('script'), false, e.message);
    await t.shot(`${size.name}-failed.png`).catch(() => {});
  } finally {
    // A YouTube embed in headless Chrome logs its own noise
    t.finish([/youtube|doubleclick|googleads|ytimg/i]);
    t.close();
  }
}
