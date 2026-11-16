// Planes: the live map, the chosen plane's panel, place search, Near Me and
// Find a Plane, in the 400x300 window it opens in and maximized.
//
//   node .claude/skills/know-how/planes-check.mjs <appUrl> [outDir]
//
// The sky is made up here, so the check never depends on what is flying:
// the page's fetch answers /api/planes, adsbdb, planespotters and the "over"
// lookup from the SKY below. Only the place search (Photon) and the cards'
// pictures (Wikipedia) use canned replies from fixtures/. It checks:
//  - the map opens over the visitor's own location when it is to be had
//    (never New York first), and over New York when it isn't; a filter
//    hides and shows each kind of aircraft, with counts; it draws one
//    marker a plane turned to its track, a grey one on the ground, and shows
//    both credits (OpenStreetMap, adsb.lol);
//  - a clicked plane's panel: airline, the usual route only when the plane is
//    somewhere that route goes, aircraft, altitude, speed;
//  - the chosen plane leaves a trail of where it has been heard;
//  - planes glide between updates, are asked for again about every 10 s, and
//    are not asked for while the window is minimized;
//  - a searched place moves the map and asks for planes there; Near Me says
//    so when location is refused;
//  - Find a Plane: a ticket number (UA188) is translated to the callsign, a
//    type lists how many are up, an unknown one says "not being picked up",
//    a busy service says so, and a row shows that plane on the map; a found
//    plane says what it is over (one lookup, on a single result or a clicked
//    row), "Open sea" where nothing is mapped, and nothing when the lookup fails;
//  - each plane is drawn in the shape of its kind; the chosen one shows its
//    photo, linked and credited; Find a Plane opens on Spotter's Picks, whose
//    pictures are one Wikipedia call and whose cards look a type up when
//    clicked and opens the aircraft's page (story, picture, facts, a world
//    map of where each is), with the military card and a card with none flying;
//  - on a 390px phone: Planes is the last of the Dock's five, nothing spills,
//    the place box is 16px, the tabs, location button and filter are big
//    enough to tap, the filter lies in a row, the chosen plane is a sheet at
//    the bottom, and Spotter's Picks are two across;
//  - in the small window the panel lies over the map and nothing spills
//    sideways; maximized it sits beside the map.
// About 50 s, 11 of them proving a minimized window stays quiet.
import { launch, sleep } from './cdp.mjs';

const [appUrl, outDir] = process.argv.slice(2);
if (!appUrl) throw new Error('usage: planes-check.mjs <appUrl> [outDir]');

const UAL188 = { hex: 'a254dd', flight: 'UAL188  ', r: 'N24979', t: 'B789', category: 'A5', alt_baro: 10550, gs: 480, track: 158.89, baro_rate: 1300, lat: 40.69, lon: -74.17, seen_pos: 0.2 };
const DAL999 = { hex: 'c0ffee', flight: 'DAL999  ', r: 'N999DL', t: 'A321', category: 'A3', alt_baro: 36000, gs: 450, track: 270, baro_rate: 0, lat: 40.75, lon: -73.9, seen_pos: 0.1 };
const PARKED = { hex: 'abc123', r: 'N123AB', t: 'C172', category: 'A1', alt_baro: 'ground', gs: 0, lat: 40.72, lon: -74.05, seen_pos: 1 };
const A380S = [
  { hex: 'aaa001', flight: 'UAE1    ', r: 'A6-EUV', t: 'A388', alt_baro: 38000, gs: 490, track: 310, lat: 48.1, lon: 20.3 },
  { hex: 'aaa002', flight: 'BAW11   ', r: 'G-XLEA', t: 'A388', alt_baro: 36000, gs: 480, track: 95, lat: 44.2, lon: 38.5 },
  { hex: 'aaa003', flight: 'QFA1    ', r: 'VH-OQA', t: 'A388', alt_baro: 'ground', gs: 12, lat: -33.94, lon: 151.18 },
];
const airport = (iata, city, latitude, longitude) => ({ iata_code: iata, icao_code: `K${iata}`, municipality: city, name: `${city} Airport`, latitude, longitude });
const route = (icao, iata, airline, origin, destination) => ({ response: { flightroute: { callsign: icao, callsign_icao: icao, callsign_iata: iata, airline: { name: airline }, origin, destination } } });
const SKY = {
  planes: {
    'callsign/UAL188': [UAL188],
    'type/A388': A380S,
    mil: [
      { hex: 'ae0001', flight: 'RCH123  ', r: '02-1110', t: 'C17', alt_baro: 31000, gs: 430, track: 80, lat: 38.9, lon: -77.0 },
      { hex: 'ae0002', r: '59-1502', t: 'K35R', alt_baro: 'ground', gs: 0, lat: 47.6, lon: -117.6 },
    ],
  },
  // What planespotters sends for the one airframe it has a photo of
  photos: {
    a254dd: { photos: [{ id: '2004988', thumbnail: { src: 'https://t.plnspttrs.net/20214/2004988_t.jpg', size: { width: 200, height: 133 } },
      thumbnail_large: { src: 'https://t.plnspttrs.net/20214/2004988_280.jpg', size: { width: 420, height: 280 } },
      link: 'https://www.planespotters.net/photo/2004988/n24979-united-airlines-boeing-787-9-dreamliner', photographer: 'OMGcat' }] },
  },
  adsbdb: {
    'callsign/UAL188': route('UAL188', 'UA188', 'United Airlines', airport('EWR', 'New York', 40.6925, -74.1687), airport('JNB', 'Johannesburg', -26.1392, 28.246)),
    'callsign/UA188': route('UAL188', 'UA188', 'United Airlines', airport('EWR', 'New York', 40.6925, -74.1687), airport('JNB', 'Johannesburg', -26.1392, 28.246)),
    // A reused flight number: the list says Los Angeles to Honolulu, the plane is over New York
    'callsign/DAL999': route('DAL999', 'DL999', 'Delta Air Lines', airport('LAX', 'Los Angeles', 33.9425, -118.408), airport('HNL', 'Honolulu', 21.3187, -157.9225)),
    'aircraft/a254dd': { response: { aircraft: { type: '787 9', manufacturer: 'Boeing', registered_owner: 'United Airlines', registered_owner_country_name: 'United States' } } },
  },
};

// The page's fetch, answering the two plane services from SKY. window.__sky
// keeps every path asked, and `status` makes /api/planes refuse.
const FAKE_SKY = `(() => {
  const SKY = ${JSON.stringify(SKY)};
  const NEAR = ${JSON.stringify([UAL188, DAL999, PARKED])};
  const real = window.fetch;
  window.__sky = { asked: [], status: 200, placeStatus: 200 };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  window.fetch = (url, opts) => {
    const u = String(url);
    const planes = u.match(/\\/api\\/planes\\/v2\\/(.+)$/);
    if (planes) {
      window.__sky.asked.push(planes[1]);
      if (window.__sky.status !== 200) return Promise.resolve(json({ error: 'refused' }, window.__sky.status));
      // UAL188 is a little further along its way each time the sky is asked for, so it leaves a trail
      if (planes[1].startsWith('point/')) {
        const n = window.__sky.asked.filter(p => p.startsWith('point/')).length - 1;
        return Promise.resolve(json({ ac: NEAR.map(p => p.hex === 'a254dd' ? { ...p, lat: p.lat - 0.02 * n, lon: p.lon + 0.008 * n } : p) }));
      }
      return Promise.resolve(json({ ac: SKY.planes[planes[1]] ?? [] }));
    }
    const adsbdb = u.match(/api\\.adsbdb\\.com\\/v0\\/(.+)$/);
    if (adsbdb) {
      window.__sky.asked.push('adsbdb:' + adsbdb[1]);
      const known = SKY.adsbdb[adsbdb[1]];
      return Promise.resolve(known ? json(known) : json({ response: 'unknown' }, 404));
    }
    const photo = u.match(/api\\.planespotters\\.net\\/pub\\/photos\\/hex\\/(.+)$/);
    if (photo) {
      window.__sky.asked.push('photo:' + photo[1]);
      // A beat late, as the real one is, so the skeleton can be seen
      return new Promise(resolve => setTimeout(() => resolve(json(SKY.photos[photo[1]] ?? { photos: [] })), 700));
    }
    const place = u.match(/nominatim\\.openstreetmap\\.org\\/reverse\\?lat=([-\\d.]+)&lon=([-\\d.]+)/);
    if (place) {
      window.__sky.asked.push('place:' + place[1] + ',' + place[2]);
      if (window.__sky.placeStatus !== 200) return Promise.resolve(json({}, window.__sky.placeStatus));
      // UAL188 is over New Jersey, the A380 UAE1 over Hungary, BAW11 over the Black Sea
      if (place[1].startsWith('40.')) return Promise.resolve(json({ display_name: 'New Jersey, United States', address: { state: 'New Jersey', country: 'United States' } }));
      if (place[1].startsWith('48.')) return Promise.resolve(json({ display_name: 'Great Plain and North, Hungary', address: { state: 'Great Plain and North', country: 'Hungary' } }));
      return Promise.resolve(json({ error: 'Unable to geocode' }));
    }
    return real(url, opts);
  };
})()`;

const app = `document.querySelector('.planes-app')`;
const win = `${app}.closest('.window')`;
const text = (selector) => `(${app}.querySelector(${JSON.stringify(selector)})?.textContent ?? '')`;
const asked = (part) => `window.__sky.asked.filter(p => p.startsWith(${JSON.stringify(part)}))`;
const marker = (label) => `[...${app}.querySelectorAll('.planes-marker')].find(m => m.title === ${JSON.stringify(label)})`;
const fact = (name) => `([...${app}.querySelectorAll('.planes-facts dt')].find(d => d.textContent === ${JSON.stringify(name)})?.nextElementSibling.textContent ?? null)`;
const tab = (name) => `[...${app}.querySelectorAll('.planes-tab')].find(b => b.textContent === ${JSON.stringify(name)})`;

const t = await launch(appUrl, outDir, { width: 1400, height: 900 });
try {
  await t.ev(FAKE_SKY);
  const find = async (query) => {
    await t.typeInto('.planes-app .planes-field', query);
    await t.ev(`${app}.querySelector('.planes-find-button').click()`);
    await t.waitFor(`!${app}.querySelector('.planes-find-button').disabled || ${text('.planes-find-button')} === 'Find'`, `Find to finish for ${query}`, 8000);
    await t.waitFor(`${text('.planes-find-button')} === 'Find'`, `Find to finish for ${query}`, 8000);
  };

  // ---- The window it opens in: 400x300
  await t.openApp('Planes');
  await t.waitFor(`/3 planes in view/.test(${text('.planes-status')})`, 'three planes on the map', 15000);
  const first = await t.ev(`window.__sky.asked[0]`);
  t.check('with no location to be had, it opens over New York, asking for planes around the middle of the map', /^point\/40\.71\/-74\.01\/\d+$/.test(first), first);
  t.check('one marker a plane', (await t.ev(`${app}.querySelectorAll('.planes-marker').length`)) === 3);
  t.check('each turned to its track', (await t.ev(`${marker('UAL188')}.querySelector('.planes-glyph').style.transform`)) === 'rotate(159deg)'
    && (await t.ev(`${marker('DAL999')}.querySelector('.planes-glyph').style.transform`)) === 'rotate(270deg)');
  const shapes = await t.ev(`['UAL188', 'DAL999', 'N123AB'].map(l => [...${app}.querySelectorAll('.planes-marker')].find(m => m.title === l)).map(m => [...m.classList].find(c => /^planes-marker-(heavy|jet|light|four|prop|helicopter)$/.test(c)).slice(14) + ' ' + m.offsetWidth).join(', ')`);
  t.check('each drawn in the shape and size of its kind', shapes === 'heavy 30, jet 24, light 18', shapes);
  // The filter by kind
  const kind = (name) => `[...${app}.querySelectorAll('.planes-kind')].find(b => b.getAttribute('aria-label').startsWith(${JSON.stringify(name)}))`;
  const kinds = await t.ev(`[...${app}.querySelectorAll('.planes-kind')].map(b => b.getAttribute('aria-label') + (b.getAttribute('aria-pressed') === 'true' ? '' : ' (hidden)')).join('; ')`);
  t.check('the filter counts each kind in view, all shown to begin with', kinds === 'Light planes: 1 in view; Helicopters: 0 in view; Turboprops: 0 in view; Jets: 1 in view; Wide-body jets: 1 in view; Four-engine giants: 0 in view', kinds);
  await t.ev(`${kind('Jets')}.click()`);
  await t.waitFor(`!${marker('DAL999')}`, 'the jet to go', 3000);
  t.check('hiding a kind takes its planes off the map and says how many are left', (await t.ev(`${app}.querySelectorAll('.planes-marker').length`)) === 2
    && (await t.ev(text('.planes-status'))) === 'Showing 2 of 3 planes in view' && (await t.ev(`${kind('Jets')}.getAttribute('aria-pressed')`)) === 'false', await t.ev(text('.planes-status')));
  t.check('the filter fits on the small map, clear of the credit line', await t.ev(`(() => { const k = ${app}.querySelector('.planes-kinds').getBoundingClientRect(), c = ${app}.querySelector('.leaflet-control-attribution').getBoundingClientRect(), m = ${app}.querySelector('.planes-canvas').getBoundingClientRect(); return k.bottom <= c.top && k.bottom <= m.bottom && k.left >= m.left; })()`));
  await t.ev(`${kind('Jets')}.click()`);
  await t.waitFor(`${marker('DAL999')}`, 'the jet back', 3000);
  t.check('and showing it again brings them back', (await t.ev(text('.planes-status'))) === '3 planes in view');
  t.check('a plane on the ground is marked as one, by its tail number', await t.ev(`${marker('N123AB')}.classList.contains('planes-marker-ground')`));
  const credit = await t.ev(text('.leaflet-control-attribution'));
  t.check('the map credits OpenStreetMap and adsb.lol', /OpenStreetMap/.test(credit) && /adsb\.lol/.test(credit), credit);
  t.check('nothing spills sideways at 400x300', await t.ev(`${app}.scrollWidth <= ${app}.clientWidth && ${app}.querySelector('.planes-toolbar').scrollWidth <= ${app}.querySelector('.planes-toolbar').clientWidth`),
    await t.ev(`${app}.clientWidth + ' wide, toolbar needs ' + ${app}.querySelector('.planes-toolbar').scrollWidth`));
  await t.shot('planes-small.png');

  // ---- The chosen plane
  await t.ev(`${marker('UAL188')}.click()`);
  await t.waitFor(`${app}.querySelector('.planes-info')`, 'the panel', 3000);
  t.check('while the photo is looked up its place is a skeleton, not alt text', await t.ev(`(() => { const box = ${app}.querySelector('.planes-photo .mac-skeleton'); return !!box && box.offsetHeight > 40 && getComputedStyle(box).animationName === 'mac-skeleton-shimmer' && !${app}.querySelector('.planes-photo img'); })()`));
  await t.waitFor(`${fact('Usual route')} !== null && ${fact('Aircraft')}?.includes('Boeing')`, 'the panel to fill in', 8000);
  const panel = await t.ev(`({ name: ${text('.planes-info-name')}, ticket: ${text('.planes-info-ticket')}, airline: ${fact('Airline')}, route: ${fact('Usual route')}, aircraft: ${fact('Aircraft')},
    tail: ${fact('Tail number')}, altitude: ${fact('Altitude')}, speed: ${fact('Speed')}, heading: ${fact('Heading')}, climb: ${fact('Climb')}, owner: ${fact('Owner')} })`);
  t.check('the panel names the flight and its ticket number', panel.name === 'UAL188' && panel.ticket === 'UA188', JSON.stringify(panel));
  t.check('with its airline, usual route and aircraft', panel.airline === 'United Airlines' && panel.route === 'EWR New York → JNB Johannesburg' && panel.aircraft === 'Boeing 787 9 (B789)' && panel.tail === 'N24979', JSON.stringify(panel));
  t.check('and what it is doing', panel.altitude === '10,550 ft' && panel.speed === '552 mph (480 kt)' && panel.heading === 'SSE (159°)' && panel.climb === 'Climbing 1,300 ft/min', JSON.stringify(panel));
  t.check('an owner that is the airline isn\'t said twice', panel.owner === null);
  await t.waitFor(`${app}.querySelector('.planes-photo img')`, 'the photo', 8000);
  const photo = await t.ev(`({ src: ${app}.querySelector('.planes-photo img').getAttribute('src'), alt: ${app}.querySelector('.planes-photo img').alt, link: ${app}.querySelector('.planes-photo a').href, credit: ${text('.planes-photo-credit')} })`);
  t.check('a photo of that airframe, linked to its page and credited to its photographer', photo.src.endsWith('2004988_280.jpg') && photo.link.startsWith('https://www.planespotters.net/photo/2004988/')
    && photo.credit === '© OMGcat, planespotters.net' && photo.alt === 'N24979, photographed by OMGcat', JSON.stringify(photo));
  await t.waitFor(`${app}.querySelector('.planes-photo .mac-loaded')`, 'the photo to load', 8000);
  t.check('once loaded, the skeleton gives way to the photo', await t.ev(`(() => { const box = ${app}.querySelector('.planes-photo .planes-photo-box'); return !box.classList.contains('mac-skeleton') && getComputedStyle(box.querySelector('img')).opacity !== '0'; })()`));
  t.check('the photo fits inside the small panel', await t.ev(`(() => { const p = ${app}.querySelector('.planes-photo').getBoundingClientRect(), i = ${app}.querySelector('.planes-info').getBoundingClientRect(); return p.left >= i.left && p.right <= i.right && p.width > 80; })()`));
  await t.ev(`${kind('Wide-body jets')}.click()`);
  await sleep(200);   // nothing should change: the chosen plane stays
  t.check('the chosen plane stays on the map though its kind is hidden', await t.ev(`!!${marker('UAL188')} && !!${app}.querySelector('.planes-info')`));
  await t.ev(`${kind('Wide-body jets')}.click()`);
  t.check('the chosen marker stands out', await t.ev(`${marker('UAL188')}.classList.contains('planes-marker-selected')`));
  t.check('in a small window the panel lies over the map', (await t.ev(`getComputedStyle(${app}.querySelector('.planes-info')).position`)) === 'absolute'
    && await t.ev(`(() => { const p = ${app}.querySelector('.planes-info').getBoundingClientRect(), a = ${app}.getBoundingClientRect(); return p.left >= a.left && p.right <= a.right && p.bottom <= a.bottom; })()`));
  await t.shot('planes-small-panel.png');

  await t.ev(`${marker('DAL999')}.click()`);
  await t.waitFor(`${text('.planes-info-name')} === 'DAL999' && ${fact('Airline')} === 'Delta Air Lines'`, 'the second plane', 8000);
  t.check('a route the plane is nowhere near is left out, the airline kept', (await t.ev(fact('Usual route'))) === null, await t.ev(fact('Usual route')));
  await t.waitFor(`!${app}.querySelector('.planes-photo')`, 'the skeleton to go', 5000);
  t.check('a plane with no photo shows none, once that is known', (await t.ev(asked('photo:c0ffee'))).length === 1);
  await t.ev(`${marker('UAL188')}.click()`);
  const adsbdbCalls = await t.ev(asked('adsbdb:'));
  t.check('a plane clicked twice is looked up once', adsbdbCalls.filter(p => p === 'adsbdb:aircraft/a254dd').length === 1 && adsbdbCalls.filter(p => p === 'adsbdb:callsign/UAL188').length === 1
    && (await t.ev(asked('photo:a254dd'))).length === 1, adsbdbCalls.join(' '));

  // ---- Maximized: gliding, refreshing, and quiet while minimized
  await t.ev(`${win}.querySelector('.window-maximize').click()`);
  await t.settle();
  await t.waitFor(`getComputedStyle(${app}.querySelector('.planes-info')).position === 'static'`, 'the panel beside the map', 5000);
  t.check('maximized, the panel sits beside the map', await t.ev(`(() => { const p = ${app}.querySelector('.planes-info').getBoundingClientRect(), m = ${app}.querySelector('.planes-canvas').getBoundingClientRect(); return p.left >= m.right - 1 && m.width > 600; })()`));
  await t.shot('planes-max.png');
  // A new size is a new circle: wait for that request, then watch one plane between updates
  await t.waitFor(`${asked('point/')}.length >= 2`, 'planes for the bigger map', 8000);
  await sleep(300);
  const calls = await t.ev(`${asked('point/')}.length`);
  const spot = `${marker('UAL188')}.style.transform`;
  const before = await t.ev(spot);
  await t.waitFor(`${spot} !== ${JSON.stringify(before)}`, 'the plane to move', 8000);
  t.check('a plane glides on between updates', (await t.ev(`${asked('point/')}.length`)) === calls, `${before} → ${await t.ev(spot)}`);
  await t.waitFor(`${asked('point/')}.length > ${calls}`, 'the next update', 14000);
  t.check('planes are asked for again by themselves', true);
  // Leaflet merges points along a straight line, so the trail is judged by its length, not its points
  await t.waitFor(`${app}.querySelector('path.planes-trail')`, 'the trail', 5000);
  const trail = await t.ev(`(() => { const p = ${app}.querySelector('path.planes-trail'); return { points: (p.getAttribute('d').match(/[ML]/g) ?? []).length, length: Math.round(p.getTotalLength()), colour: getComputedStyle(p).stroke, fill: getComputedStyle(p).fill }; })()`);
  t.check('the chosen plane leaves a trail of where it has been heard', trail.points >= 2 && trail.length >= 8 && trail.colour === 'rgb(217, 43, 28)' && trail.fill === 'none', JSON.stringify(trail));

  await t.ev(`${win}.querySelector('.window-minimize').click()`);
  await t.settle();
  const quiet = await t.ev(`${asked('point/')}.length`);
  await sleep(11000);   // longer than one refresh: proves nothing is asked meanwhile
  t.check('a minimized window asks for nothing', (await t.ev(`${asked('point/')}.length`)) === quiet, `${quiet} → ${await t.ev(`${asked('point/')}.length`)}`);
  await t.ev(`[...document.querySelectorAll('.dock-item')].find(d => d.textContent.trim() === 'Planes').click()`);
  await t.settle();
  await t.waitFor(`${asked('point/')}.length > ${quiet}`, 'planes again once restored', 8000);
  t.check('and asks again once it is back', true);

  // ---- A place, and Near Me
  await t.typeInto('.planes-app .planes-field', 'Kyoto');
  await t.waitFor(`${app}.querySelectorAll('.planes-suggestion').length > 0`, 'place suggestions', 10000);
  const suggestion = await t.ev(`${app}.querySelector('.planes-suggestion').textContent`);
  await t.ev(`${app}.querySelector('.planes-suggestion').click()`);
  await t.waitFor(`${asked('point/3')}.length > 0`, 'planes over Kyoto', 8000);
  const kyoto = (await t.ev(asked('point/3'))).at(-1);
  t.check('a picked place moves the map and asks for planes there', /^point\/3[45]\.\d\d\/13[56]\.\d\d\/\d+$/.test(kyoto) && /Kyoto/.test(suggestion), `${suggestion}: ${kyoto}`);
  t.check('the suggestions close, and the box keeps the place', (await t.ev(`${app}.querySelectorAll('.planes-suggestion').length`)) === 0 && /Kyoto/.test(await t.ev(`${app}.querySelector('.planes-field').value`)));

  await t.denyGeolocation();
  await t.ev(`${app}.querySelector('.planes-near').click()`);
  await t.waitFor(`${app}.querySelector('.planes-note')`, 'the Near Me message', 12000);
  t.check('Near Me says so when location is refused', /switched off/.test(await t.ev(text('.planes-note'))), await t.ev(text('.planes-note')));

  // ---- Find a Plane
  await t.ev(`${tab('Find a Plane')}.click()`);
  await t.waitFor(`${app}.querySelector('.planes-find-hint')`, 'the Find tab', 5000);
  t.check('the map is out of reach while Find is in front', await t.ev(`${app}.querySelector('.planes-sky').inert === true`));
  // Spotter's Picks
  const cards = `[...${app}.querySelectorAll('.planes-pick')]`;
  const card = (name) => `${cards}.find(c => c.querySelector('.planes-pick-name').textContent === ${JSON.stringify(name)})`;
  t.check('Find a Plane opens on Spotter\'s Picks', (await t.ev(`${cards}.length`)) > 20 && await t.ev(`!!${card('Airbus A380')} && !!${card('Military, right now')}`), `${await t.ev(`${cards}.length`)} cards`);
  t.check('the cards wait for their pictures as skeletons', (await t.ev(`${cards}.filter(c => c.querySelector('.mac-skeleton')).length`)) > 0 || await t.ev(`!!${card('Airbus A380')}.querySelector('img')`));
  await t.waitFor(`${card('Airbus A380')}.querySelector('img')`, 'the cards\' pictures', 10000);
  const pictures = await t.ev(`${cards}.filter(c => c.querySelector('img')?.src.startsWith('https://')).length`);
  t.check('nearly every card has its picture, from one Wikipedia call', pictures >= (await t.ev(`${cards}.length`)) - 2
    && (await t.ev(`performance.getEntriesByType('resource').filter(e => e.name.includes('wikipedia.org/w/api.php')).length`)) === 1, `${pictures} pictures`);
  t.check('and looks nothing up until a card is clicked', (await t.ev(asked('type/'))).length === 0 && (await t.ev(asked('mil'))).length === 0);
  t.check('two cards fit side by side at any size', await t.ev(`(() => { const [a, b] = ${cards}.map(c => c.getBoundingClientRect()); return Math.abs(a.top - b.top) < 2 && b.left > a.right; })()`));
  await t.shot('planes-picks.png');
  await t.ev(`${card('Airbus A380')}.click()`);
  await t.waitFor(`${text('.planes-find-summary')} !== ''`, 'the A380s', 8000);
  t.check('a card lists that type by its name', (await t.ev(text('.planes-find-summary'))).startsWith('3 Airbus A380s are being picked up: 2 in the air, 1 on the ground.')
    && (await t.ev(text('.planes-find-heading'))) === 'In the sky right now', await t.ev(text('.planes-find-summary')));
  // The aircraft's page: its story and picture from Wikipedia, its dates and sizes from Wikidata (canned, real replies)
  await t.waitFor(`${app}.querySelector('.planes-type-story') && ${app}.querySelector('.planes-type-facts')`, 'the A380\'s story and facts', 10000);
  const page = await t.ev(`({ name: ${text('.planes-type-name')}, blurb: ${text('.planes-type-blurb')}, story: ${text('.planes-type-story')}, facts: [...${app}.querySelectorAll('.planes-type-facts dt')].map(d => d.textContent + ': ' + d.nextElementSibling.textContent),
    link: ${app}.querySelector('.planes-type-source a').href, source: ${text('.planes-type-source')}, picture: !!${app}.querySelector('.planes-type-picture img'), waiting: !!${app}.querySelector('.planes-type-waiting') })`);
  t.check('a card opens the aircraft\'s page: its name, its line and the opening of its article', page.name === 'Airbus A380' && page.blurb.startsWith('The largest passenger airliner') && /^The Airbus A380 is a .*airliner/.test(page.story) && /[.!?]$/.test(page.story), page.story.slice(0, 90));
  t.check('with its first flight and its size, feet first', page.facts.includes('First flight: April 27, 2005') && page.facts.includes('Wingspan: 262 ft (79.8 m)'), page.facts.join('; '));
  t.check('and its picture, a link to the article, and where the words came from', page.picture && !page.waiting && page.link === 'https://en.wikipedia.org/wiki/Airbus_A380' && page.source.includes('Story and picture: Wikipedia. Dates and sizes: Wikidata.'), page.source);
  const world = await t.ev(`(() => { const w = ${app}.querySelector('.planes-world'); return { markers: w.querySelectorAll('.planes-marker').length, titles: [...w.querySelectorAll('.planes-marker')].map(m => m.title).sort().join(','), wide: w.offsetWidth, tall: w.offsetHeight, credit: w.querySelector('.leaflet-control-attribution')?.textContent ?? '' }; })()`);
  t.check('a world map shows where each one is right now, with its credits', world.markers === 3 && world.titles === 'BAW11,QFA1,UAE1' && world.tall > 150 && world.credit.includes('OpenStreetMap') && world.credit.includes('adsb.lol'), JSON.stringify(world));
  await t.shot('planes-type-page.png');
  await t.ev(`[...${app}.querySelectorAll('.planes-world .planes-marker')].find(m => m.title === 'UAE1').click()`);
  await t.waitFor(`${tab('Sky')}.getAttribute('aria-selected') === 'true' && ${text('.planes-info-name')} === 'UAE1'`, 'the plane picked on the world map', 5000);
  t.check('a plane tapped on the world map opens in Sky', true);
  await t.ev(`${app}.querySelector('.planes-info-close').click()`);
  await t.ev(`${tab('Find a Plane')}.click()`);
  t.check('and coming back to Find a Plane, the page is still there', (await t.ev(text('.planes-type-name'))) === 'Airbus A380' && (await t.ev(`${app}.querySelectorAll('.planes-world .planes-marker').length`)) === 3);
  await t.ev(`${app}.querySelector('.planes-find-back').click()`);
  t.check('and the way back shows the cards again', (await t.ev(`${cards}.length`)) > 20 && (await t.ev(`${app}.querySelector('.planes-field').value`)) === '');
  await t.ev(`${card('Military, right now')}.click()`);
  await t.waitFor(`${text('.planes-find-summary')} !== ''`, 'the military aircraft', 8000);
  t.check('the military card has a page and a map too', (await t.ev(text('.planes-type-name'))) === 'Military, right now' && (await t.ev(`${app}.querySelectorAll('.planes-world .planes-marker').length`)) === 2);
  t.check('the military card lists every one being picked up, in one call', (await t.ev(text('.planes-find-summary'))).startsWith('2 military aircraft are being picked up: 1 in the air, 1 on the ground.')
    && (await t.ev(asked('mil'))).length === 1, await t.ev(text('.planes-find-summary')));
  await t.ev(`${app}.querySelector('.planes-find-back').click()`);
  await t.ev(`${card('Lockheed U-2')}.click()`);
  await t.waitFor(`${text('.planes-find-note')} !== ''`, 'no U-2s', 8000);
  t.check('a card with none flying still shows its page', (await t.ev(text('.planes-type-name'))) === 'Lockheed U-2' && !(await t.ev(`!!${app}.querySelector('.planes-world')`)));
  t.check('a card with none flying says so by name', /^No Lockheed U-2 is being picked up right now/.test(await t.ev(text('.planes-find-note'))), await t.ev(text('.planes-find-note')));
  await t.ev(`${app}.querySelector('.planes-find-back').click()`);

  const mark = await t.ev(`window.__sky.asked.length`);
  await find('ua188');
  await t.waitFor(`/New Jersey/.test(${text('.planes-find-summary')})`, 'the place the found plane is over', 8000);
  const lookups = (await t.ev(`window.__sky.asked.slice(${mark})`)).filter(p => /^(callsign|reg|type|adsbdb:callsign)/.test(p));
  t.check('a ticket number is tried as typed, then translated to the callsign', lookups.join(' ') === 'callsign/UA188 reg/UA188 adsbdb:callsign/UA188 callsign/UAL188', lookups.join(' '));
  t.check('and found in the air, with the place it is over', (await t.ev(text('.planes-find-summary'))) === 'UAL188 is in the air right now, over New Jersey, United States. Tap it on the map to follow it.', await t.ev(text('.planes-find-summary')));

  const placesAsked = (await t.ev(asked('place:'))).length;
  await find('A388');
  const summary = await t.ev(text('.planes-find-summary'));
  t.check('a type says how many are up and how many are down', summary.startsWith('3 A388s are being picked up: 2 in the air, 1 on the ground.'), summary);
  const names = await t.ev(`[...${app}.querySelectorAll('.planes-result-name')].map(n => n.textContent)`);
  t.check('listed with those in the air first', names.join(',') === 'BAW11,UAE1,QFA1', names.join(','));
  t.check('a list looks no places up until a row is clicked', (await t.ev(asked('place:'))).length === placesAsked && !(await t.ev(`!!${app}.querySelector('.planes-type')`))
    && (await t.ev(`${app}.querySelectorAll('.planes-world .planes-marker').length`)) === 3, (await t.ev(asked('place:'))).join(' '));
  await t.shot('planes-find.png');

  await find('ZZZ999');
  t.check('an unknown one is "not being picked up", not "not flying"', /being picked up right now/.test(await t.ev(text('.planes-find-note'))) && !(await t.ev(`!!${app}.querySelector('.planes-results')`)));

  await t.ev(`window.__sky.status = 429`);
  await find('A388');
  t.check('a busy service says it is busy, not "nothing found"', /busy/.test(await t.ev(text('.planes-find-note'))), await t.ev(text('.planes-find-note')));
  await t.ev(`window.__sky.status = 200`);

  await find('A388');
  await t.ev(`[...${app}.querySelectorAll('.planes-result')].find(r => r.textContent.includes('UAE1')).click()`);
  await t.waitFor(`${tab('Sky')}.getAttribute('aria-selected') === 'true' && ${text('.planes-info-name')} === 'UAE1'`, 'the found plane on the map', 5000);
  await t.waitFor(`${asked('point/48.10/20.30/')}.length > 0`, 'planes around the found one', 8000);
  t.check('a found plane opens on the map, where it is', true);
  await t.waitFor(`${fact('Over')} !== null`, 'the place in the panel', 8000);
  t.check('and its panel says what it is over', (await t.ev(fact('Over'))) === 'Great Plain and North, Hungary', await t.ev(fact('Over')));
  t.check('and stays marked though the planes there don\'t include it', await t.ev(`!!${marker('UAE1')}?.classList.contains('planes-marker-selected')`)
    && /Out of view/.test(await t.ev(text('.planes-info-foot'))));

  // Over the sea, and when the place lookup is down
  await t.ev(`${tab('Find a Plane')}.click()`);
  await t.ev(`[...${app}.querySelectorAll('.planes-result')].find(r => r.textContent.includes('BAW11')).click()`);
  await t.waitFor(`${text('.planes-info-name')} === 'BAW11' && ${fact('Over')} !== null`, 'the plane over the sea', 8000);
  t.check('a plane with nothing mapped under it is over open sea', (await t.ev(fact('Over'))) === 'Open sea', await t.ev(fact('Over')));
  await t.ev(`window.__sky.placeStatus = 429`);
  await t.ev(`${tab('Find a Plane')}.click()`);
  await t.ev(`[...${app}.querySelectorAll('.planes-result')].find(r => r.textContent.includes('QFA1')).click()`);
  await t.waitFor(`${text('.planes-info-name')} === 'QFA1' && ${asked('place:-33')}.length > 0`, 'the parked plane', 8000);
  await sleep(300);   // the refused reply has landed: nothing should appear
  t.check('when the place lookup refuses, the panel says nothing rather than guess', (await t.ev(fact('In'))) === null && (await t.ev(fact('Over'))) === null);

  await t.ev(`${app}.querySelector('.planes-info-close').click()`);
  t.check('closing the panel puts the plane away, and any trail', await t.ev(`!${app}.querySelector('.planes-info') && !${marker('QFA1')} && !${app}.querySelector('path.planes-trail')`));

  // ---- Opening with a location to be had: the visitor's own sky first
  await t.ev(`${win}.querySelector('.window-close').click()`);
  await t.settle();
  await t.setGeolocation(45.5152, -122.6784);   // Portland
  const reopened = await t.ev(`window.__sky.asked.length`);
  await t.openApp('Planes');
  await t.waitFor(`window.__sky.asked.slice(${reopened}).some(p => p.startsWith('point/'))`, 'planes for the reopened map', 10000);
  const firstAgain = (await t.ev(`window.__sky.asked.slice(${reopened})`)).filter(p => p.startsWith('point/'));
  t.check('someone who allows location opens over their own sky, never New York first', /^point\/45\.52\/-122\.68\/\d+$/.test(firstAgain[0]) && !firstAgain.some(p => p.startsWith('point/40.71')), firstAgain.join(' '));


  t.finish();
} finally {
  await t.close();
}

// ---- A 390px touch phone
const phone = await launch(appUrl, outDir, { width: 390, height: 800 });
try {
  const t = phone;
  await t.ev(FAKE_SKY);
  const dock = await t.ev(`[...document.querySelectorAll('.dock-item')].map(d => d.textContent.trim()).join(', ')`);
  t.check('the phone Dock ends with Planes, and has no Safari', dock === 'Finder, Nasa News, Pokemon, Field Guide, Planes', dock);
  await t.openApp('Planes');
  await t.waitFor(`/3 planes in view/.test(${text('.planes-status')})`, 'three planes on the phone map', 15000);
  const sizes = await t.ev(`(() => {
    const q = (sel) => ${app}.querySelector(sel);
    const tb = q('.planes-toolbar'), kinds = [...${app}.querySelectorAll('.planes-kind')].map(k => k.getBoundingClientRect());
    return { spill: tb.scrollWidth - tb.clientWidth, appSpill: ${app}.scrollWidth - ${app}.clientWidth, field: parseFloat(getComputedStyle(q('.planes-field')).fontSize),
      tab: q('.planes-tab').offsetHeight, near: q('.planes-near').offsetHeight, kind: Math.round(kinds[0].height), kindsInARow: kinds.every(k => Math.abs(k.top - kinds[0].top) < 1),
      kindsFit: kinds.at(-1).right <= q('.planes-canvas').getBoundingClientRect().right };
  })()`);
  t.check('nothing spills sideways in the phone window', sizes.spill <= 0 && sizes.appSpill <= 0, JSON.stringify(sizes));
  t.check('the place box is 16px, so an iPhone doesn\'t zoom into it', sizes.field >= 16, `${sizes.field}px`);
  t.check('the tabs, the location button and the filter are big enough to tap', sizes.tab >= 32 && sizes.near >= 32 && sizes.kind >= 30, JSON.stringify(sizes));
  t.check('the filter lies in a row along the top of the map, and fits', sizes.kindsInARow && sizes.kindsFit);
  t.check('the location button is the crosshair, named for a screen reader', await t.ev(`!!${app}.querySelector('.planes-near svg') && ${app}.querySelector('.planes-near').getAttribute('aria-label') === 'Use my location' && ${app}.querySelector('.planes-near').textContent.trim() === ''`));
  // In a window that isn't maximized, Find a Plane must leave the window's resize handle on top
  await t.ev(`${tab('Find a Plane')}.click()`);
  await t.waitFor(`${app}.querySelector('.planes-find')`, 'Find a Plane in the small window', 5000);
  t.check('the window\'s resize handle is still on top of Find a Plane', await t.ev(`(() => { const h = ${win}.querySelector('.window-resize-handle').getBoundingClientRect(); return [3, 6, 9, 12].every(d => document.elementFromPoint(h.right - d, h.bottom - d)?.classList.contains('window-resize-handle')); })()`));
  await t.ev(`${tab('Sky')}.click()`);
  await t.ev(`${win}.querySelector('.window-maximize').click()`);
  await t.settle();
  await t.ev(`${marker('UAL188')}.click()`);
  await t.waitFor(`${app}.querySelector('.planes-photo .mac-loaded')`, 'the panel and its photo', 8000);
  const sheet = await t.ev(`(() => {
    const p = ${app}.querySelector('.planes-info').getBoundingClientRect(), m = ${app}.querySelector('.planes-canvas').getBoundingClientRect(), k = ${app}.querySelector('.planes-kinds').getBoundingClientRect(), a = ${app}.getBoundingClientRect();
    const close = ${app}.querySelector('.planes-info-close');
    return { atBottom: p.top > m.top + m.height / 2 && p.bottom <= a.bottom, clearOfFilter: p.top > k.bottom, inside: p.left >= a.left && p.right <= a.right, close: close.offsetWidth + 'x' + close.offsetHeight, tall: Math.round(p.height), map: Math.round(m.height) };
  })()`);
  t.check('on a phone the chosen plane is a sheet at the bottom, clear of the filter', sheet.atBottom && sheet.clearOfFilter && sheet.inside && parseInt(sheet.close) >= 32, JSON.stringify(sheet));
  await t.shot('planes-phone-panel.png');
  await t.ev(`${tab('Find a Plane')}.click()`);
  await t.waitFor(`${app}.querySelectorAll('.planes-pick').length > 20`, 'the cards on a phone', 5000);
  const cards = await t.ev(`(() => { const c = [...${app}.querySelectorAll('.planes-pick')].slice(0, 3).map(x => x.getBoundingClientRect()), f = ${app}.querySelector('.planes-find'); return { twoAcross: Math.abs(c[0].top - c[1].top) < 2 && c[2].top > c[0].bottom - 2, spill: f.scrollWidth - f.clientWidth }; })()`);
  t.check('Spotter\'s Picks are two across, with nothing spilling', cards.twoAcross && cards.spill <= 0, JSON.stringify(cards));
  await t.ev(`[...${app}.querySelectorAll('.planes-pick')][0].click()`);
  await t.waitFor(`${app}.querySelector('.planes-result')`, 'the results on a phone', 8000);
  t.check('a result row is tall enough to tap', (await t.ev(`${app}.querySelector('.planes-result').offsetHeight`)) >= 34, `${await t.ev(`${app}.querySelector('.planes-result').offsetHeight`)}px`);
  await t.shot('planes-phone-find.png');

  t.finish();
} finally {
  await phone.close();
}
