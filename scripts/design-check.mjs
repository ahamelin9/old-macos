#!/usr/bin/env node
// The design check, run by `npm run lint`. It keeps the shared styles shared:
//
//  - Colours, fonts, text sizes and corners come from src/styles/tokens.css
//    through var(). The only other place a raw colour may appear is an app's
//    own palette: a custom property named after the app (--fg-native: #…).
//  - Every selector in an app's stylesheet starts with one of that app's
//    classes (PREFIXES below), so no app can restyle another. Only
//    src/styles/base.css styles bare elements.
//  - No !important (the cascade layers make it unnecessary).
//  - No raw colours in .ts/.tsx files either (inline styles drift).
//
// A line that really needs an exception says why, in a comment containing
// "design-exception:". How to fix each kind of problem: the `design` skill.
//
//   node scripts/design-check.mjs              the lint run: fails on new problems
//   node scripts/design-check.mjs <files…>     lists every problem in those files
//   node scripts/design-check.mjs --status     problems per file
//   node scripts/design-check.mjs --update     rewrites the baseline after a file improves
//
// While apps move onto the tokens, design-baseline.json holds each older
// file's problem count. A file may never go above its count, and a file not
// listed must have none. When every count is 0 the baseline goes away.
// Every file passed in November 2026, so there is no baseline now: the check
// is strict, and the baseline stays only for a future migration.

import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts/design-baseline.json');

export const TOKENS = 'src/styles/tokens.css';
export const BASE = 'src/styles/base.css';

// Each stylesheet, and the class prefixes its selectors may start with. A
// class matches a prefix when it equals it or starts with "<prefix>-". The
// same prefixes name the app's own custom properties (--<prefix>-…).
export const PREFIXES = {
  'src/styles/kit.css': ['mac'],
  'src/components/Desktop/styles.css': ['desktop', 'mac-menu-bar'],
  'src/components/Dock/styles.css': ['dock'],
  'src/components/Window/styles.css': ['window'],
  'src/components/Apps/Calculator/Calculator.css': ['calculator'],
  'src/components/Apps/Camera/Camera.css': ['camera'],
  'src/components/Apps/FieldGuide/FieldGuide.css': ['fieldguide', 'fg'],
  'src/components/Apps/Finder/Finder.css': ['finder'],
  'src/components/Apps/Music/Music.css': ['music', 'retro-itunes'],
  'src/components/Apps/NasaNews/NasaNews.css': ['nasa'],
  'src/components/Apps/Notes/Notes.css': ['notes'],
  'src/components/Apps/PokemonSearch/PokemonSearch.css': ['pokemon'],
  'src/components/Apps/Preferences/Preferences.css': ['preferences'],
  'src/components/Apps/Safari/Safari.css': ['safari'],
  'src/components/Apps/Terminal/Terminal.css': ['terminal', 'term'],
  'src/components/Apps/Trash/Trash.css': ['trash'],
};

const NAMED_COLOURS = 'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|brown|navy|teal|maroon|olive|lime|aqua|fuchsia|cyan|magenta|lightgray|lightgrey|darkgray|darkgrey|whitesmoke|gainsboro|crimson|tomato|coral|salmon|khaki|beige|ivory|indigo|violet';
const RAW_COLOUR = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?)\\(|(?<![\\w-])(?:${NAMED_COLOURS})(?![\\w-])`, 'i');
const EXCEPTION = /design-exception:/;

// Drop var(…), url(…) and strings, which may hold names that look like values
const bareValue = (value) => {
  let v = value.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/url\([^)]*\)/g, 'url()');
  for (let i = 0; i < 5 && /var\(/.test(v); i++) v = v.replace(/var\([^()]*\)/g, ' ');
  return v;
};

/** Split a selector list on top-level commas (not the ones inside :is(…)). */
const splitSelectors = (list) => {
  const out = []; let depth = 0, cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
};

const matchesPrefix = (name, prefixes) => prefixes.some(p => name === p || name.startsWith(`${p}-`));

/**
 * Parse a stylesheet into rules ({ selector, decls }) and keyframes, with
 * line numbers. Enough CSS for this repo: at-rule blocks, rules, declarations.
 */
export const parseCss = (text) => {
  const exceptionLines = new Set();
  // Blank out comments, keeping their newlines so line numbers hold
  const css = text.replace(/\/\*[\s\S]*?\*\//g, (c, offset) => {
    if (EXCEPTION.test(c)) exceptionLines.add(text.slice(0, offset).split('\n').length);
    return c.replace(/[^\n]/g, ' ');
  });
  const lineStarts = [0];
  for (let i = 0; i < css.length; i++) if (css[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (pos) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };

  const rules = [], keyframes = [];
  let i = 0;
  const skipBlock = () => { let depth = 1; while (i < css.length && depth) { if (css[i] === '{') depth++; if (css[i] === '}') depth--; i++; } };
  const block = (rule) => {
    while (i < css.length) {
      while (i < css.length && /\s/.test(css[i])) i++;
      if (i >= css.length) return;
      if (css[i] === '}') { i++; return; }
      const start = i;
      while (i < css.length && !'{;}'.includes(css[i])) i++;
      const prelude = css.slice(start, i).trim();
      const line = lineOf(start + (css.slice(start, i).length - css.slice(start, i).trimStart().length));
      if (css[i] !== '{') {
        if (css[i] === ';') i++;
        if (rule && prelude.includes(':')) {
          const colon = prelude.indexOf(':');
          rule.decls.push({ prop: prelude.slice(0, colon).trim().toLowerCase(), value: prelude.slice(colon + 1).trim(), line, exception: exceptionLines.has(line) });
        }
        continue;
      }
      i++;
      if (/^@(-webkit-)?keyframes\s/.test(prelude)) { keyframes.push({ name: prelude.split(/\s+/)[1], line }); skipBlock(); }
      else if (prelude.startsWith('@font-face')) skipBlock();
      else if (prelude.startsWith('@')) block(rule);
      else { const r = { selector: prelude, line, exception: exceptionLines.has(line), decls: [] }; rules.push(r); block(r); }
    }
  };
  block(null);
  return { rules, keyframes };
};

/** Every design problem in one stylesheet, as { line, text, hint }. */
export const checkCss = (rel, text) => {
  if (rel === TOKENS) return [];
  const problems = [];
  const add = (line, text, hint) => problems.push({ line, text, hint });
  const prefixes = PREFIXES[rel];
  if (rel !== BASE && !prefixes) {
    add(0, 'stylesheet has no entry in PREFIXES', 'add it, with its app\'s class prefixes, to PREFIXES in scripts/design-check.mjs');
  }
  const { rules, keyframes } = parseCss(text);

  for (const k of keyframes) {
    if (prefixes && !matchesPrefix(k.name, prefixes)) add(k.line, `@keyframes ${k.name}`, `keyframe names are global too: name it ${prefixes[0]}-…`);
  }

  for (const rule of rules) {
    if (prefixes && !rule.exception) {
      for (const sel of splitSelectors(rule.selector)) {
        if (/^(from|to|\d+(\.\d+)?%)$/.test(sel)) continue;
        const first = sel.match(/^\.([\w-]+)/);
        if (!first || !matchesPrefix(first[1], prefixes)) {
          add(rule.line, sel, `start the selector with one of this app's classes (${prefixes.map(p => `.${p}…`).join(', ')}), e.g. ".${prefixes[0]}… ${sel}"`);
        }
      }
    }
    for (const d of rule.decls) {
      if (d.exception) continue;
      if (/!important/i.test(d.value)) add(d.line, `${d.prop}: ${d.value}`, 'drop !important: an app rule already beats the shared layers');
      const value = d.value.replace(/!important/i, '').trim();
      if (d.prop.startsWith('--')) {
        // An app's own palette may hold raw values; anything else must not
        if (prefixes && matchesPrefix(d.prop.slice(2), prefixes)) continue;
      }
      const bare = bareValue(value);
      if (RAW_COLOUR.test(bare)) add(d.line, `${d.prop}: ${value}`, 'use a colour token, e.g. var(--color-text) (tokens.css), or the app\'s own --<prefix>-… palette');
      if (d.prop === 'font-family' && /[a-z]/i.test(bare.replace(/\binherit\b/g, ''))) add(d.line, `${d.prop}: ${value}`, 'use var(--font-system), var(--font-body) or var(--font-mono)');
      if (d.prop === 'font-size' && /\d/.test(bare)) add(d.line, `${d.prop}: ${value}`, 'use a text size, e.g. var(--text-md)');
      if (/^border(-[a-z]+)*-radius$/.test(d.prop) && /[1-9]/.test(bare)) add(d.line, `${d.prop}: ${value}`, 'use a corner, e.g. var(--radius)');
      if (d.prop === 'font' && /\d|[a-z]{4,}/i.test(bare.replace(/\b(inherit|bold|normal|italic)\b/g, ''))) add(d.line, `${d.prop}: ${value}`, 'set font-size and font-family from tokens instead of the font shorthand');
    }
  }
  return problems;
};

/** Raw colours written into TypeScript (inline styles, map colours). */
export const checkScript = (rel, text) => {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    if (EXCEPTION.test(line)) return;
    for (const m of line.matchAll(/(["'`])(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\))\1/g)) problems.push({ line: i + 1, text: m[2], hint: 'use a token: className with a stylesheet, or style={{ color: \'var(--color-…)\' }}; a colour JS must hand to a library goes in one palette file with a design-exception comment' });
  });
  return problems;
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

export const checkFile = (rel) => {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  if (rel.endsWith('.css')) return checkCss(rel, text);
  if (/\.(ts|tsx)$/.test(rel) && !/\.test\./.test(rel)) return checkScript(rel, text);
  return [];
};

const scanAll = () => {
  const files = walk(join(ROOT, 'src')).map(p => relative(ROOT, p)).filter(f => /\.(css|ts|tsx)$/.test(f)).sort();
  return Object.fromEntries(files.map(f => [f, checkFile(f)]));
};

const main = () => {
  const args = process.argv.slice(2);
  const show = (rel, problems) => {
    for (const p of problems.sort((a, b) => a.line - b.line)) console.log(`  ${rel}:${p.line}  ${p.text}\n      -> ${p.hint}`);
  };

  if (args.length && !args[0].startsWith('--')) {
    for (const rel of args.map(a => a.replace(/^\.\//, ''))) {
      if (!existsSync(join(ROOT, rel))) { console.log(`${rel}: no such file`); continue; }
      const problems = checkFile(rel);
      console.log(`${rel}: ${problems.length} problem(s)`);
      show(rel, problems);
    }
    return;
  }

  const results = scanAll();
  const counts = Object.fromEntries(Object.entries(results).map(([f, p]) => [f, p.length]).filter(([, n]) => n > 0));

  if (args[0] === '--status') {
    for (const [f, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${f}`);
    console.log(`${Object.values(counts).reduce((a, b) => a + b, 0)} problem(s) in ${Object.keys(counts).length} file(s)`);
    return;
  }

  if (args[0] === '--update') {
    if (Object.keys(counts).length === 0) { if (existsSync(BASELINE)) rmSync(BASELINE); console.log('No problems left: the baseline is gone, and the check is strict.'); }
    else { writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n'); console.log(`Baseline written: ${Object.keys(counts).length} file(s) still have problems.`); }
    return;
  }

  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  let failed = false;
  for (const [f, problems] of Object.entries(results)) {
    const allowed = baseline[f] ?? 0;
    if (problems.length > allowed) {
      failed = true;
      console.log(`${f}: ${problems.length} design problem(s)${allowed ? `, up from ${allowed}` : ''}`);
      show(f, problems);
    }
  }
  const lowered = Object.entries(baseline).filter(([f, n]) => (counts[f] ?? 0) < n);
  if (lowered.length) console.log(`design check: ${lowered.length} file(s) improved; run "node scripts/design-check.mjs --update" to lock that in`);
  if (failed) {
    console.log('\nThe design skill says how to fix each kind (.claude/skills/design/SKILL.md).');
    process.exitCode = 1;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
