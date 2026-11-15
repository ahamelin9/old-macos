// Did a CSS change restyle anything it shouldn't? Opens every dock app and
// saves the computed style of every button (and each window's controls), so
// a snapshot from before a change can be compared with one from after.
// Every stylesheet is global, so this is how to prove a CSS clean-up changed
// only what it meant to.
//
//   node .claude/skills/know-how/style-diff.mjs http://127.0.0.1:5199 <before.json>
//   ...make the change...
//   node .claude/skills/know-how/style-diff.mjs http://127.0.0.1:5199 <after.json>
//   node .claude/skills/know-how/style-diff.mjs --diff <before.json> <after.json>
//
// Take two snapshots before changing anything and diff them: they should
// match (0 changed), which shows the page settles the same way every time.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, sleep } from './cdp.mjs';

const PROPS = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'backgroundImage', 'backgroundColor', 'borderRadius', 'borderTopWidth', 'borderTopStyle', 'borderTopColor',
  'boxShadow', 'textShadow', 'color', 'width', 'height', 'gap'];

const [first, a, b] = process.argv.slice(2);

if (first === '--diff') {
  const [before, after] = [a, b].map(f => JSON.parse(readFileSync(f, 'utf8')));
  if (before.length !== after.length) console.log('element count differs:', before.length, after.length);
  const groups = {};
  before.forEach((row, i) => {
    const other = after[i];
    if (!other) return;
    const changes = Object.keys(row.s).filter(p => row.s[p] !== other.s[p]).map(p => `${p}: ${row.s[p]}  ->  ${other.s[p]}`);
    // Group by window and class, so 20 identical calculator keys print once
    if (changes.length) (groups[row.group] ||= { n: 0, example: row.text, changes }).n++;
  });
  for (const [group, g] of Object.entries(groups)) console.log(`\n${group}  x${g.n}  (e.g. "${g.example}")\n  ${g.changes.join('\n  ')}`);
  console.log(`\nchanged groups: ${Object.keys(groups).length} of ${before.length} elements`);
} else {
  const [appUrl, outFile] = [first, a];
  if (!appUrl || !outFile) throw new Error('usage: style-diff.mjs <appUrl> <out.json>  |  --diff <a.json> <b.json>');
  const t = await launch(appUrl, undefined, { width: 1400, height: 900 });
  try {
    const apps = await t.ev(`[...document.querySelectorAll('.dock-item .dock-label')].map(l => l.textContent.trim())`);
    for (const app of apps) await t.openApp(app);
    await sleep(4000);
    const rows = await t.ev(`[...document.querySelectorAll('.window button, .window .window-controls, .dock button, .menu-bar button')].map(el => {
      const cs = getComputedStyle(el);
      const win = el.closest('.window')?.querySelector('.window-title')?.textContent ?? 'shell';
      const s = {};
      for (const p of ${JSON.stringify(PROPS)}) s[p] = cs[p];
      return { group: win + ' :: ' + el.tagName.toLowerCase() + '.' + (el.className || '(no class)'), text: el.textContent.trim().slice(0, 14), s };
    })`);
    writeFileSync(outFile, JSON.stringify(rows, null, 1));
    console.log(`saved ${rows.length} elements from: ${apps.join(', ')}`);
  } finally {
    t.close();
  }
}
