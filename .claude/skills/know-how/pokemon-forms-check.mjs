// Pokémon's forms, against live PokeAPI: the Megas and Gigantamax hanging off
// their stage in the evolution line, and the "Other forms" row. At the three
// sizes every app must work at: the 400x300 window it opens in, that window
// maximized on a laptop, and a 390px phone (in the window it opens in, then
// maximized).
//
//   node .claude/skills/know-how/pokemon-forms-check.mjs <appUrl> <outDir>
//
// At every size it checks:
//  - Dragonite (what the app opens on): Mega Dragonite hangs below Dragonite
//    on a dashed line, in a "Mega Evolution" tray, with its sprite loaded, and
//    there is no Forms row, as the line already shows both;
//  - Charizard's line has Mega Charizard X and Y and Gigantamax Charizard;
//  - Raichu's line has Gigantamax Pikachu and Mega Raichu X and Y but not
//    Alolan Raichu, which sits open in a one-line "Other forms (1)" row;
//    clicking it shows Alolan Raichu (Electric, Psychic), highlighted in the
//    row, with Raichu's stage marked;
//  - Pikachu's row is a real button, "▸ Other forms (15)", folded the first
//    time in a session; opening it shows 15 caps and costumes and not
//    Gigantamax Pikachu (that's in the line); clicking one shows it, and the
//    row stays open from then on, through other Pokémon and a maximize;
//  - nothing sticks out past the window's right edge, and Dragonite's,
//    Charizard's and Raichu's lines fit without scrolling sideways.
// On a laptop it also checks, in the 400x300 window and maximized:
//  - clicking Mega Dragonite shows "#149 - Mega Dragonite", marks it in the
//    line, and asks PokeAPI only for pokemon/dragonite-mega;
//  - → and ← from Mega Dragonite step by Pokédex number: Mewtwo, then Dragonite;
//  - a slow reply for an older search can't replace a newer one (small only).
// Maximized, it then checks Mega Zygarde, which has no sprite, shows a "?"
// and no broken picture, and spot-checks Mega Dragonite, Gigantamax Charizard
// and Alolan Raichu against live PokeAPI, asked separately from Node: the
// heading against pokemon-form's English name and the species' Pokédex
// number; the types, height, weight and sprite against pokemon/{name}; and
// that every variety of the species shows once, in the line or the row.
// Screenshots of each step land in outDir. About 55 PokeAPI requests in all,
// half a second or more apart: species, chains and types are cached for the
// session, so each browser asks for each only once.
import { launch, sleep } from './cdp.mjs';

const [appUrl, outDir] = process.argv.slice(2);
if (!appUrl || !outDir) throw new Error('usage: pokemon-forms-check.mjs <appUrl> <outDir>');

const win = `[...document.querySelectorAll('.window')].find(w => w.querySelector('.pokemon-container'))`;
const app = `${win}.querySelector('.pokemon-container')`;
const heading = `${app}.querySelector('.pokemon-name')?.textContent ?? ''`;
const viewport = `${app}.querySelector('.evolution-tree-viewport')`;
const texts = (scope, selector) => `[...(${scope}?.querySelectorAll(${JSON.stringify(selector)}) ?? [])].map(e => e.textContent.trim())`;
const row = `${app}.querySelector('.pokemon-forms')`;
const list = `${app}.querySelector('.pokemon-forms-list')`;
const toggle = `${app}.querySelector('.pokemon-forms-toggle')`;
const formNames = texts(list, '.pokemon-form-name');
const currentForm = `${app}.querySelector('.pokemon-form-current .pokemon-form-name')?.textContent`;
const currentStage = `${viewport}?.querySelector('.current-evolution-stage .stage-name')?.textContent`;
const stage = (label) => `[...(${viewport}?.querySelectorAll('.evolution-stage') ?? [])].find(b => b.querySelector('.stage-name').textContent === ${JSON.stringify(label)})`;
// The tray that hangs off a stage: the stage's group holds both
const trayOf = (label) => `${stage(label)}?.closest('.pokemon-evo-stage-group')?.querySelector('.pokemon-evo-tray')`;
// The row's heading as it reads: "▸ Other forms (15)", or "Other forms (1)" with no triangle
const rowHeading = `(() => {
  const h = ${app}.querySelector('.pokemon-forms-toggle, .pokemon-forms-title');
  if (!h) return null;
  const triangle = h.querySelector('.pokemon-forms-triangle')?.textContent ?? '';
  return (triangle ? triangle + ' ' : '') + h.textContent.replace(triangle, '').trim();
})()`;
const shownList = `(${list} && !${list}.hidden && ${list}.getBoundingClientRect().height > 0)`;

const search = async (t, name, shows) => {
  await sleep(500); // be gentle with PokeAPI
  await t.typeInto('.pokemon-container .search-form input', name);
  await t.ev(`${app}.querySelector('.search-form').requestSubmit()`);
  await waitShown(t, shows);
};
// The heading names it, and the line has been drawn (the row comes before it)
const waitShown = (t, shows) => t.waitFor(
  `(${heading}).includes(${JSON.stringify(shows)}) && ${viewport} && !${app}.querySelector('.loading')`,
  `${shows} shown`, 30000);
// Nothing past the window's right edge, and every card that shows inside it.
// With line, the evolution line also fits without scrolling sideways.
const fits = async (t, name, line = false) => {
  const r = await t.ev(`(() => {
    const content = ${win}.querySelector('.window-content');
    const box = content.getBoundingClientRect();
    const out = [...content.querySelectorAll('.pokemon-form, .pokemon-evo-tray')]
      .filter(e => e.getClientRects().length > 0)
      .filter(e => { const b = e.getBoundingClientRect(); return b.left < box.left - 1 || b.right > box.right + 1; }).length;
    const vp = ${viewport};
    return { over: content.scrollWidth - content.clientWidth, out, line: vp ? vp.scrollWidth - vp.clientWidth : 0 };
  })()`);
  t.check(`${name}: nothing past the window's edge`, r.over <= 1 && r.out === 0, `content over by ${r.over}px, ${r.out} card(s) outside`);
  if (line) t.check(`${name}: the whole evolution line shows, no sideways scroll`, r.line <= 1, `over by ${r.line}px`);
  return r;
};
const scrollTo = (t, selector) => t.ev(`${app}.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' })`);
const loaded = (img) => `(() => { const i = ${img}; return !!i && i.complete && i.naturalWidth > 0; })()`;
const clickForm = (label) => `[...${app}.querySelectorAll('.pokemon-form')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`;

const dragonite = async (t, size, shoot) => {
  await waitShown(t, 'Dragonite');
  const tray = trayOf('Dragonite');
  await t.waitFor(loaded(`${tray}?.querySelector('img')`), 'Mega Dragonite sprite', 15000);
  t.check(`${size}: Dragonite's line has a Mega Evolution tray with Mega Dragonite`,
    (await t.ev(`JSON.stringify(${texts(tray, '.pokemon-evo-tray-label')}) + JSON.stringify(${texts(tray, '.stage-name')})`)) === '["Mega Evolution"]["Mega Dragonite"]');
  const where = await t.ev(`(() => {
    const s = ${stage('Dragonite')}.getBoundingClientRect(), m = ${tray}.querySelector('.evolution-stage').getBoundingClientRect();
    const link = ${stage('Dragonite')}.closest('.pokemon-evo-stage-group').querySelector('.pokemon-evo-tray-link');
    return { below: m.top > s.bottom, under: m.left < s.right && m.right > s.left, dashed: getComputedStyle(link).borderLeftStyle, arrows: ${viewport}.querySelectorAll('.evo-arrow-icon').length };
  })()`);
  t.check(`${size}: it hangs below Dragonite on a dashed line, with no extra arrow`,
    where.below && where.under && where.dashed === 'dashed' && where.arrows === 2, JSON.stringify(where));
  t.check(`${size}: Dragonite shows no Forms row (the line has both)`, !(await t.ev(`!!${row}`)));
  await fits(t, `${size} Dragonite`, true);
  if (shoot) { await scrollTo(t, '.evolution-chain'); await shoot('dragonite'); }
};

const charizard = async (t, size, shoot) => {
  await search(t, 'charizard', 'Charizard');
  const tray = trayOf('Charizard');
  t.check(`${size}: Charizard's line has Mega Charizard X and Y`,
    (await t.ev(`JSON.stringify(${texts(`${tray}?.querySelector('.pokemon-evo-tray-mega')`, '.stage-name')})`)) === '["Mega Charizard X","Mega Charizard Y"]');
  t.check(`${size}: and Gigantamax Charizard, in its own Gigantamax group`,
    (await t.ev(`JSON.stringify(${texts(`${tray}?.querySelector('.pokemon-evo-tray-gmax')`, '.stage-name')})`)) === '["Gigantamax Charizard"]');
  await t.waitFor(`[...${tray}.querySelectorAll('img')].every(i => i.complete)`, 'Charizard tray sprites', 15000);
  t.check(`${size}: every sprite in Charizard's tray loaded`, await t.ev(`[...${tray}.querySelectorAll('img')].every(i => i.naturalWidth > 0)`));
  t.check(`${size}: Charizard shows no Forms row`, !(await t.ev(`!!${row}`)));
  await fits(t, `${size} Charizard`, true);
  if (shoot) { await scrollTo(t, '.evolution-chain'); await shoot('charizard'); }
};

const raichu = async (t, size, shoot) => {
  await search(t, 'raichu', 'Raichu');
  t.check(`${size}: Raichu's line has Gigantamax Pikachu off Pikachu`,
    (await t.ev(`JSON.stringify(${texts(trayOf('Pikachu'), '.stage-name')})`)) === '["Gigantamax Pikachu"]');
  t.check(`${size}: and Mega Raichu X and Y off Raichu`,
    (await t.ev(`JSON.stringify(${texts(trayOf('Raichu'), '.stage-name')})`)) === '["Mega Raichu X","Mega Raichu Y"]');
  t.check(`${size}: Alolan Raichu is not in the line`, !(await t.ev(`${viewport}.textContent.includes('Alolan')`)));
  const open = await t.ev(`({ heading: ${rowHeading}, toggle: !!${toggle}, shown: ${shownList}, names: ${formNames} })`);
  t.check(`${size}: Raichu's row is open, "Other forms (1)", with Alolan Raichu alone`,
    open.heading === 'Other forms (1)' && !open.toggle && open.shown && open.names.join() === 'Alolan Raichu', JSON.stringify(open));
  await fits(t, `${size} Raichu`, true);
  if (shoot) { await scrollTo(t, '.pokemon-forms'); await shoot('raichu'); }
  await sleep(500);
  await t.ev(clickForm('Alolan Raichu'));
  await waitShown(t, 'Alolan Raichu');
  const types = await t.ev(texts(app, '.quick-info-bar .type-badge'));
  t.check(`${size}: clicking it shows Alolan Raichu`, (await t.ev(heading)) === '#26 - Alolan Raichu' && types.join() === 'electric,psychic',
    `${await t.ev(heading)}; ${types.join(', ')}`);
  t.check(`${size}: highlighted in the row, with Raichu's stage marked`,
    (await t.ev(currentForm)) === 'Alolan Raichu' && (await t.ev(currentStage)) === 'Raichu');
  if (shoot) { await scrollTo(t, '.pokemon-name'); await shoot('alolan-raichu'); }
};

// startsOpen: whether the row was already opened earlier in this session
const pikachu = async (t, size, shoot, startsOpen) => {
  await search(t, 'pikachu', 'Pikachu');
  await t.waitFor(`${row}`, 'Pikachu\'s Forms row', 15000);
  const first = await t.ev(`({ heading: ${rowHeading}, button: ${toggle}?.tagName, expanded: ${toggle}?.getAttribute('aria-expanded'), shown: ${shownList} })`);
  if (!startsOpen) {
    t.check(`${size}: Pikachu's row is folded, a button reading "▸ Other forms (15)"`,
      first.heading === '▸ Other forms (15)' && first.button === 'BUTTON' && first.expanded === 'false' && !first.shown, JSON.stringify(first));
    if (shoot) { await scrollTo(t, '.pokemon-forms'); await shoot('pikachu-folded'); }
    await t.ev(`${toggle}.click()`);
    await sleep(300);
  } else {
    t.check(`${size}: Pikachu's row is still open, as left earlier in the session`,
      first.heading === '▾ Other forms (15)' && first.expanded === 'true' && first.shown, JSON.stringify(first));
  }
  const opened = await t.ev(`({ heading: ${rowHeading}, expanded: ${toggle}?.getAttribute('aria-expanded'), shown: ${shownList}, names: ${formNames} })`);
  t.check(`${size}: open, it reads "▾ Other forms (15)" and shows 15 caps and costumes`,
    opened.heading === '▾ Other forms (15)' && opened.expanded === 'true' && opened.shown && opened.names.length === 15 &&
      opened.names.includes('Pikachu (Original Cap)'), `${opened.heading}, ${opened.names.length} shown`);
  t.check(`${size}: Gigantamax Pikachu is not in the row, but is in the line`,
    !opened.names.includes('Gigantamax Pikachu') && (await t.ev(`JSON.stringify(${texts(trayOf('Pikachu'), '.stage-name')})`)) === '["Gigantamax Pikachu"]');
  const clipped = await t.ev(`[...${list}.querySelectorAll('.pokemon-form-name')].filter(n => n.scrollWidth > n.clientWidth + 1).length`);
  t.check(`${size}: no form name is cut off`, clipped === 0, `${clipped} cut off`);
  await fits(t, `${size} Pikachu`);
  if (shoot) { await scrollTo(t, '.pokemon-forms'); await shoot('pikachu-open'); }
  await sleep(500);
  await t.ev(clickForm('Pikachu (Original Cap)'));
  await waitShown(t, 'Original Cap');
  t.check(`${size}: clicking a cap shows it, and the row stays open with it highlighted`,
    (await t.ev(heading)) === '#25 - Pikachu (Original Cap)' && (await t.ev(`${toggle}?.getAttribute('aria-expanded')`)) === 'true' &&
      (await t.ev(currentForm)) === 'Pikachu (Original Cap)', await t.ev(heading));
};

// What the app shows for a form, against PokeAPI asked directly
const live = async (path) => {
  await sleep(700);
  const res = await fetch(`https://pokeapi.co/api/v2/${path}`, { headers: { 'User-Agent': 'macos-1999-pokemon-check/1.0' } });
  if (!res.ok) throw new Error(`PokeAPI ${path}: ${res.status}`);
  return res.json();
};
const spotCheck = async (t, name) => {
  const pokemon = await live(`pokemon/${name}`);
  const form = await live(`pokemon-form/${name}`);
  const species = await live(pokemon.species.url.replace(/^.*\/api\/v2\//, ''));
  const official = form.names.find(n => n.language.name === 'en')?.name;
  const speciesName = species.names.find(n => n.language.name === 'en')?.name;
  // Wait for a new Pokémon, not for the expected name, so a wrong name shows as a diff
  const before = await t.ev(heading);
  await t.typeInto('.pokemon-container .search-form input', name);
  await t.ev(`${app}.querySelector('.search-form').requestSubmit()`);
  await t.waitFor(`(${heading}) !== ${JSON.stringify(before)} && (${heading}) !== '' && ${viewport} && !${app}.querySelector('.loading')`,
    `${name} shown`, 30000);
  const shown = await t.ev(`(() => {
    const vals = [...${app}.querySelectorAll('.quick-info-val')].map(v => v.textContent);
    return { heading: ${heading}, types: ${texts(app, '.quick-info-bar .type-badge')}, height: vals[0], weight: vals[1],
      sprite: ${app}.querySelector('img.pokemon-image')?.src,
      stage: !!${stage(speciesName)}, tray: ${texts(trayOf(speciesName), '.stage-name')}, row: ${formNames},
      current: ${currentForm} ?? ${currentStage} };
  })()`);
  const inches = (pokemon.height / 10) * 39.37;
  const want = {
    heading: `#${species.id} - ${official}`,
    types: pokemon.types.map(x => x.type.name).join(),
    height: `${Math.floor(inches / 12)} ft ${Math.round(inches % 12)} in`,
    weight: `${((pokemon.weight / 10) * 2.20462).toFixed(1)} lbs`
  };
  const got = { heading: shown.heading, types: shown.types.join(), height: shown.height, weight: shown.weight };
  t.check(`spot-check ${name}: heading, types, height and weight match PokeAPI`, JSON.stringify(got) === JSON.stringify(want),
    `${JSON.stringify(got)}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` but PokeAPI says ${JSON.stringify(want)}`}`);
  t.check(`spot-check ${name}: the picture is PokeAPI's sprite`, shown.sprite === pokemon.sprites.front_default, shown.sprite);
  const everywhere = (shown.stage ? 1 : 0) + shown.tray.length + shown.row.length;
  t.check(`spot-check ${name}: each of ${species.name}'s ${species.varieties.length} varieties shows once, in the line or the row; this one marked`,
    everywhere === species.varieties.length && shown.current === official,
    `stage ${shown.stage}, tray [${shown.tray.join(', ')}], row [${shown.row.join(', ')}], marked ${shown.current}`);
};

// ---- Laptop: the 400x300 window, then maximized
const laptop = await launch(appUrl, outDir, { width: 1400, height: 900 });
try {
  const t = laptop;
  // Note every PokeAPI request the app makes
  await t.s('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__asked = [];
    const f = window.fetch;
    window.fetch = (url, opts) => { if (String(url).includes('pokeapi.co/api')) window.__asked.push(String(url)); return f(url, opts); };
  })()` });
  await t.s('Page.reload');
  await t.openApp('Pokemon');
  await t.ev(`${win}.dataset.pk = '1'`);
  let size = 'small';
  const shoot = (name) => t.shot(`laptop-${size}-${name}.png`, '[data-pk="1"]');

  for (size of ['small', 'max']) {
    console.log(`\n== laptop, ${size === 'small' ? 'the 400x300 window' : 'maximized'}`);
    if (size === 'max') {
      await t.ev(`${win}.querySelector('.window-maximize').click()`);
      await sleep(500);
      await search(t, 'dragonite', 'Dragonite');
    }
    await dragonite(t, size, shoot);

    // A Mega, clicked in the line
    const before = await t.ev(`window.__asked.length`);
    await t.ev(`${trayOf('Dragonite')}.querySelector('.evolution-stage').click()`);
    await waitShown(t, 'Mega Dragonite');
    const asked = await t.ev(`window.__asked.slice(${before})`);
    t.check(`${size}: clicking Mega Dragonite shows it`, (await t.ev(heading)) === '#149 - Mega Dragonite', await t.ev(heading));
    t.check(`${size}: marked in the line`, (await t.ev(currentStage)) === 'Mega Dragonite');
    t.check(`${size}: it asked PokeAPI for that Pokémon only`, asked.length === 1 && asked[0].endsWith('/pokemon/dragonite-mega'), asked.join(' '));
    if (size === 'small') { await scrollTo(t, '.evolution-chain'); await shoot('mega-dragonite-line'); }
    await scrollTo(t, '.pokemon-name');
    await shoot('mega-dragonite');

    // ← → go by Pokédex number, not the form's own id (10281)
    await sleep(500);
    await t.ev(`${app}.querySelector('[aria-label="Next Pokémon"]').click()`);
    await waitShown(t, 'Mewtwo');
    t.check(`${size}: → from Mega Dragonite goes to #150 Mewtwo`, (await t.ev(heading)) === '#150 - Mewtwo', await t.ev(heading));
    await sleep(500);
    await t.ev(`${app}.querySelector('[aria-label="Previous Pokémon"]').click()`);
    await waitShown(t, 'Dragonite');
    t.check(`${size}: ← goes back to #149 Dragonite`, (await t.ev(heading)) === '#149 - Dragonite', await t.ev(heading));

    await charizard(t, size, shoot);

    if (size === 'small') {
      // An older search answering late must not replace a newer one
      await t.ev(`(() => {
        const f = window.fetch;
        window.fetch = (url, opts) => String(url).endsWith('/pokemon/charizard')
          ? new Promise(r => setTimeout(r, 2500)).then(() => f(url, opts)) : f(url, opts);
      })()`);
      await t.typeInto('.pokemon-container .search-form input', 'charizard');
      await t.ev(`${app}.querySelector('.search-form').requestSubmit()`);
      await sleep(200);
      await search(t, 'raichu', 'Raichu');
      await sleep(3500);
      t.check(`${size}: a slow older reply doesn't replace the newer search`,
        (await t.ev(heading)) === '#26 - Raichu' && (await t.ev(`!!${stage('Pichu')}`)), await t.ev(heading));
    }

    await raichu(t, size, shoot);
    await pikachu(t, size, shoot, size === 'max');
  }

  // A form with no sprite on GitHub (Mega Zygarde, 2026-11-15)
  await search(t, 'zygarde', 'Zygarde');
  const tray = trayOf('Zygarde');
  t.check('max: Zygarde (filed under zygarde-50) shows as "Zygarde (50%)"', (await t.ev(heading)) === '#718 - Zygarde (50%)', await t.ev(heading));
  await t.waitFor(`${tray}?.querySelector('.pokemon-sprite-missing')`, 'the "?" for Mega Zygarde', 15000);
  t.check('max: Mega Zygarde has a "?" for its missing sprite, not a broken picture', !(await t.ev(`!!${tray}.querySelector('img')`)));
  await t.waitFor(`[...${app}.querySelectorAll('img')].every(i => i.complete)`, 'Zygarde images', 15000);
  t.check('max: no broken pictures anywhere', await t.ev(`[...${app}.querySelectorAll('img')].every(i => i.naturalWidth > 0)`));
  await scrollTo(t, '.pokemon-forms');
  await shoot('zygarde');

  console.log('\n== spot-checks against live PokeAPI');
  for (const name of ['dragonite-mega', 'charizard-gmax', 'raichu-alola']) await spotCheck(t, name);
} catch (e) {
  laptop.check('laptop script', false, e.message);
} finally {
  // pokemon/zygarde is a 404 before the app asks for it as a species
  laptop.finish([/Failed to load resource/]);
  laptop.close();
}

// ---- Phone: the window it opens in, then maximized
const phone = await launch(appUrl, outDir, { width: 390, height: 844 });
try {
  const t = phone;
  await t.openApp('Pokemon');
  for (const size of ['phone', 'phone-max']) {
    console.log(`\n== ${size === 'phone' ? 'phone, the window it opens in' : 'phone, maximized'}`);
    const shoot = (name) => t.shot(`${size}-${name}.png`);
    if (size === 'phone-max') {
      await t.ev(`${win}.querySelector('.window-maximize').click()`);
      await sleep(500);
      await search(t, 'dragonite', 'Dragonite');
    }
    await dragonite(t, size, shoot);
    await charizard(t, size, shoot);
    await raichu(t, size, shoot);
    await pikachu(t, size, shoot, size === 'phone-max');
  }
} catch (e) {
  phone.check('phone script', false, e.message);
} finally {
  phone.finish([/Failed to load resource/]);
  phone.close();
}
