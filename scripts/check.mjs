// npm run check: the checks a change needs, quietly.
//
//   npm run check                   unit tests, types and lint, plus the browser
//                                   checks for the files changed (git diff)
//   npm run check -- --all          every browser check (before a push)
//   npm run check -- --fast         unit tests, types and lint only
//   npm run check -- nasa pokemon   the quick checks plus these browser checks (part of a name will do)
//   npm run check -- --live         browser checks against the real APIs
//   npm run check -- --record nasa  the same, saving the replies as the new canned ones
//   npm run check -- --shots        save screenshots too (printed folder)
//
// Everything runs side by side. The output is one summary line, plus details
// for anything that failed; full logs are kept in a temp folder. Browser
// checks use canned API replies (know-how's cdp.mjs) and reuse a dev server on
// 5173 if one is running, or start a spare one on 5199 and stop it after.
// The know-how skill, checking.md, "npm run check".
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, availableParallelism } from 'node:os';

const KNOW_HOW = '.claude/skills/know-how';

// Which browser checks a changed file needs. First match wins for each
// rule; a file can match several rules. Test files only need the unit tests.
const BROWSER_CHECKS = ['smoke-check', 'window-check', 'app-check', 'minimize-check', 'apple-menu-check',
  'preferences-check', 'dark-mode-check', 'nasa-check', 'pokemon-forms-check', 'planes-check', 'finder-check'];
const SHELL = ['smoke-check', 'window-check', 'minimize-check', 'apple-menu-check'];
const RULES = [
  [/\.test\.[jt]sx?$/, []],
  [/^src\/components\/Apps\/NasaNews\//, ['nasa-check']],
  [/^src\/components\/Apps\/Finder\//, ['finder-check']],
  [/^src\/components\/Apps\/PokemonSearch\//, ['pokemon-forms-check', 'app-check']],
  [/^src\/components\/Apps\/Planes\/|^functions\/api\/planes\/|^vite\.config\.ts$/, ['planes-check']],
  [/^src\/components\/Apps\/(Camera|Safari)\//, ['app-check']],
  [/^src\/components\/Apps\/Music\/|^src\/contexts\/(Spotify|useSpotify)/, ['app-check', 'minimize-check']],
  [/^src\/components\/Apps\/(Preferences)\/|^src\/contexts\/(Settings|settings|useSettings|storage|desktopPicture)|^index\.html$/, ['preferences-check', 'dark-mode-check']],
  [/^src\/components\/Apps\/(AboutThisMac|ForceQuit)\/|^src\/components\/Desktop\/(AppleMenu|RestartAlert|SleepScreen|menuKeys)/, ['apple-menu-check']],
  [/^src\/components\/(Desktop|Dock|Window)\/|^src\/contexts\/(WindowContext|useWindows|showApp)|^src\/(App|main)\.tsx$/, SHELL],
  [/^src\/components\/Kit\//, ['smoke-check', 'planes-check']],
  [/^src\/styles\//, ['smoke-check', 'dark-mode-check']],
  [/^src\/components\/Apps\/[^/]+\.(ts|tsx)$/, ['smoke-check']],
  [/^src\//, ['smoke-check']],
  [new RegExp(`^${KNOW_HOW}/cdp\\.mjs$`), BROWSER_CHECKS],
];

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const names = args.filter(a => !a.startsWith('--'));
const all = flag('--all'), fast = flag('--fast'), live = flag('--live'), record = flag('--record'), shots = flag('--shots');
const logDir = mkdtempSync(join(tmpdir(), 'check-'));
const started = Date.now();
const secs = (ms) => `${Math.round(ms / 1000)}s`;

/** Run a command, capturing its output to a log; resolves { ok, out, ms } */
const run = (label, cmd, cmdArgs, env = {}) => new Promise(resolve => {
  const t0 = Date.now();
  const p = spawn(cmd, cmdArgs, { env: { ...process.env, FORCE_COLOR: '0', ...env } });
  let out = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  p.on('close', code => {
    writeFileSync(join(logDir, `${label}.log`), out);
    resolve({ label, ok: code === 0, out, ms: Date.now() - t0 });
  });
});

// ---- Which browser checks
const changedFiles = () => {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
  return [...new Set([...git('diff', '--name-only', 'HEAD'), ...git('ls-files', '--others', '--exclude-standard')])];
};
let browser = [];
if (names.length) {
  browser = BROWSER_CHECKS.filter(c => names.some(n => c.includes(n)));
  if (!browser.length) { console.error(`check: no browser check matches ${names.join(', ')} (have: ${BROWSER_CHECKS.join(', ')})`); process.exit(2); }
} else if (all) {
  browser = BROWSER_CHECKS;
} else if (!fast) {
  const picked = new Set();
  for (const file of changedFiles()) {
    const own = file.match(new RegExp(`^${KNOW_HOW}/(?:fixtures/)?([\\w-]+)\\.(?:mjs|json\\.gz)$`));
    if (own && BROWSER_CHECKS.includes(own[1])) { picked.add(own[1]); continue; }
    const rule = RULES.find(([re]) => re.test(file));
    rule?.[1].forEach(c => picked.add(c));
  }
  browser = BROWSER_CHECKS.filter(c => picked.has(c));
}

// ---- A dev server
const listening = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
let appUrl = 'http://127.0.0.1:5173', spare;
if (browser.length && !(await listening(appUrl))) {
  appUrl = 'http://127.0.0.1:5199';
  spare = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
  const end = Date.now() + 30000;
  while (!(await listening(appUrl))) {
    if (Date.now() > end) { console.error('check: the spare dev server on 5199 never answered'); process.exit(2); }
    await new Promise(r => setTimeout(r, 200));
  }
}
const stopSpare = () => { if (spare) try { process.kill(-spare.pid); } catch { /* gone */ } };
process.on('exit', stopSpare);
process.on('SIGINT', () => process.exit(130));

// ---- Run it all side by side
const fastJobs = live || record ? [] : [
  run('unit tests', 'npx', ['vitest', 'run']),
  run('types', 'npx', ['tsc', '-b']),
  run('lint', 'npm', ['run', 'lint', '--silent']),
];
const shotDir = join(logDir, 'shots');
const env = { CHECK_SHOTS: shots ? '1' : '0', CHECK_LIVE: live ? '1' : '0', CHECK_RECORD: record ? '1' : '0' };
// Live and recording runs go one at a time, to be gentle with the free APIs
const limit = live || record ? 1 : Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
const queue = [...browser];
const browserResults = [];
const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
  while (queue.length) {
    const name = queue.shift();
    browserResults.push(await run(name, 'node', [join(KNOW_HOW, `${name}.mjs`), appUrl, join(shotDir, name)], env));
  }
});
const [fastResults] = await Promise.all([Promise.all(fastJobs), ...workers]);
stopSpare();

// ---- Report
const passCount = (out) => (out.match(/^PASS /gm) ?? []).length;
const failLines = (out) => out.split('\n').filter(l => /^FAIL /.test(l));
const results = [...fastResults, ...browserResults];
const failed = results.filter(r => !r.ok);
const passedChecks = browserResults.reduce((n, r) => n + passCount(r.out), 0);
const parts = [];
if (fastResults.length) parts.push(fastResults.filter(r => r.ok).length === fastResults.length ? 'tests, types, lint ok' : `${fastResults.filter(r => !r.ok).map(r => r.label).join(', ')} failed`);
if (browserResults.length) parts.push(`${browserResults.filter(r => r.ok).length}/${browserResults.length} browser checks ok (${browser.map(c => c.replace(/-check$/, '')).join(', ')}: ${passedChecks} steps${live ? ', live APIs' : record ? ', recorded' : ''})`);
else if (!fast && !live && !record) parts.push('no browser checks needed');
const filledIn = browserResults.filter(r => /^note: .*fetched (it )?live once/m.test(r.out)).map(r => r.label);
if (filledIn.length) parts.push(`some canned replies were missing, so ${filledIn.join(', ')} fetched them live once and saved them`);
console.log(`check: ${failed.length ? 'FAILED' : 'ok'}: ${parts.join('; ')} in ${secs(Date.now() - started)}`);
for (const r of failed) {
  console.log(`\n✗ ${r.label} (${secs(r.ms)}), full log: ${join(logDir, `${r.label}.log`)}`);
  const fails = failLines(r.out);
  const lines = fails.length ? fails : r.out.trim().split('\n').slice(-25);
  console.log(lines.slice(0, 25).map(l => `  ${l}`).join('\n'));
}
if (shots && browserResults.length) console.log(`screenshots: ${shotDir}`);
process.exitCode = failed.length ? 1 : 0;
