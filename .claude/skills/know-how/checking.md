# Know-how: checking your work

Part of the `know-how` skill. The index is in `SKILL.md`.

## `npm run check`: the one command

*2026-11-15*

```bash
npm run check                    # tests, types, lint + browser checks for what git diff shows
npm run check -- --all           # every browser check: before a push
npm run check -- nasa pokemon    # the quick checks plus these browser checks
npm run check -- --fast          # tests, types and lint only
npm run check -- --shots         # save screenshots too (only when asked, or nothing else can show it)
npm run check -- --live nasa     # against the real APIs, one check at a time
npm run check -- --record nasa   # the same, saving the replies as the new canned ones
```

It lives in `scripts/check.mjs`. How it stays lean:

- **Only what changed.** The browser checks come from `git diff` and
  untracked files, through the table `RULES` at the top of
  `scripts/check.mjs`. A test file or a doc needs none. Add a row there
  when you add a browser check.
- **Side by side.** The quick checks and up to four browser checks run at
  once; each Chrome picks its own free DevTools port.
- **Quiet.** One summary line. Only a failure prints more: its `FAIL` lines,
  or the tail of its output, and the path of its full log.
- **Canned API replies.** `cdp.mjs` answers every outside request from
  `fixtures/<check>.json.gz` (next to the scripts), so no check spends a
  live call. Pictures get a 1×1 PNG. The site's own `/api` (the Spotify
  backend) answers 503 and is never recorded, as it hands out tokens;
  `/api/planes`, which only passes adsb.lol's public data through, is
  canned like an outside service. The
  page's clock starts at the time of the recording, so "today" matches the
  replies. A check falls back on the other checks' replies, and a request
  none of them has is fetched live once and saved to that check's file (the
  summary says so; commit the file with the change). Live probes of each
  service are `npm run probe` (the `apis` skill).
- **The same layout every run.** Windows open at random spots, so
  `launch` seeds `Math.random`. A step that failed one run in three
  (Finder under another window) now never does.
- **No fixed sleeps for the page.** `launch` waits for the desktop, and
  `t.settle()` waits until no transition or animation is running; use
  `waitFor` for anything else. A short sleep is fine only where a check
  proves that nothing happens (a late reply dropped), and there it waits for
  the late reply itself (`window.__lateDone`).
- **No screenshots** unless `--shots` (`CHECK_SHOTS=1`). `t.shot()` does
  nothing otherwise; pass `{ force: true }` for a picture the check itself
  needs.
- **After a subagent ran it**, don't rerun it all: `npm run check -- <area>`
  is the quick checks plus the area you changed.

Re-record when an API's replies change shape: `--record <check>`, or
`--record --all` for every one (live, one check at a time, about five
minutes). Recording fetches each reply from Node with its own User-Agent,
as Nominatim turns away HeadlessChrome from Node; pictures and video load in
Chrome and only their status is kept (a missing sprite's 404 arrives as a
failed load, as Chrome blocks GitHub's text reply).

**Timing.** The summary line ends with the total. On 2026-11-15, with
Alex's dev server on 5173: every browser check one after another, live and
with screenshots, took 415 s and printed about 40 KB; `npm run check --
--all` takes about 75 s and prints one line (about 80 s on 2026-11-16, with
the Planes check). A one-area change (Pokémon:
its forms check and `app-check`) went from about 110 s to 36 s, and
`--fast` takes 3 s. The Apple menu check (about 60 s) is now the long pole
of `--all`. Retime with `time npm run check -- --all`.

## Proving a change in a real browser

*2026-11-09, rebuilt 2026-11-15*

The browser pane can be hidden or refuse to navigate. Headless Chrome, driven
by `cdp.mjs` in this folder, needs neither the pane nor npm packages: just
Node 22+ and Google Chrome (set `CHROME_PATH` if Chrome is somewhere else).

1. **Find a dev server.** Alex's usually runs on 5173:
   `lsof -nP -iTCP:5173 -sTCP:LISTEN`. If none is running, start a spare
   one in the background so it can't clash with Alex's:
   `npx vite --host 127.0.0.1 --port 5199 --strictPort`. Stop it when done.
2. **Write the check as a script in the scratchpad.** Run it from the repo
   root: it loads the helper relative to the current folder, so no machine
   path is baked in.

   ```js
   import { pathToFileURL } from 'node:url';
   const { launch, sleep } = await import(pathToFileURL('.claude/skills/know-how/cdp.mjs').href);

   const t = await launch('http://127.0.0.1:5199', process.argv[2], { width: 1400, height: 1000 });
   try {
     await t.setGeolocation(45.5152, -122.6784);   // optional: fake Near Me (Portland)
     await t.openFieldGuide();                      // or t.openApp('Pokemon')
     await t.ev(`document.querySelector('.window-maximize').click()`);
     await t.waitFor(`/Portland/.test(document.querySelector('.location-badge')?.textContent)`, 'badge');
     t.check('finds Portland', true);
     await t.shot('after.png');                     // or t.shot('x.png', '.some-selector')
   } catch (e) { t.check('script', false, e.message); }
   finally { t.finish(); t.close(); }
   ```

   Then run it, passing a folder for the screenshots:

   ```bash
   node <scratchpad>/check.mjs <scratchpad>/shots
   ```

3. Read the PASS and FAIL lines. Screenshots are off unless the script runs
   with `CHECK_SHOTS=1`; take them only when Alex asks or nothing else can
   show it, then Read the PNG and send the useful ones to Alex.

What the helper gives you:

- `ev(js)` runs JavaScript in the page.
- `waitFor(js, label)` polls until it's true.
- `settle()` waits until the page is still (no transition or animation
  running): use it after a click instead of `sleep`.
- `apiFetch(url)` is `fetch` for a check's own spot-checks from Node,
  canned like the page's requests.
- `check(name, ok, detail)` records a result.
- `shot(file, selector?)` saves a screenshot, only with `CHECK_SHOTS=1`.
- `openApp(dockLabel)` clicks a dock icon.
- `typeInto(selector, text)` types into a React-controlled input or
  textarea (setting `.value` alone, React never notices).
- `drag(x1, y1, x2, y2)` and `clickAt(x, y)` send real mouse events, so
  pointer handlers run (`el.click()` fires no pointerdown).
- `launch(url, dir, { chromeArgs: FAKE_CAMERA })` gives Chrome a fake webcam
  that needs no permission prompt.
- `launch` fakes a light computer, whatever the Mac is set to (dark mode
  checks set `prefers-color-scheme` themselves).
- `setGeolocation(lat, lng)` / `denyGeolocation()` fake the browser location.
- `s(method, params)` sends any raw DevTools command.
- `finish(ignoreRegexes)` adds a "no page errors" check and prints the tally.

Lessons from writing these:

- **Wait for the visible result, not for time.** One check passed before the
  place had even loaded. Wait for the text the user would see (the badge
  naming the country), then check.
- `waitFor` wraps its expression in `!!(…)`. Returning a DOM node over the
  DevTools protocol fails with "Object reference chain is too long".
- **Pace iNaturalist:** about 20 s between range views in a script run with
  `--live` or `--record` (the `apis` skill, `inaturalist.md`). Canned runs
  need no pacing: skip it when `CANNED` (from `cdp.mjs`) is true.
- **Test both window sizes**, the default small window and maximized.
  Layout bugs hide in the small one.
- To prove that Back returned to the **same** view and didn't rebuild it,
  set `el.dataset.probe = '1'` before the jump and check it's still there
  after.
- For a layout check, measure the real numbers first (a single toolbar row
  is 27px with padding) before choosing a threshold.
- `shot(name)` saves under exactly that name, so include `.png`.
- `clickButton(text)` matches the visible text. The window buttons have
  none (their ×, − and + are drawn in CSS), so click those by selector
  (`.window-maximize`).
- `openApp(label)` waits for a new window, so it works only for an app with
  no window yet: a Dock click on an open app brings its window back
  (`showApp`) instead.
- A minimized window is still in the page, hidden, with the class
  `window-minimized` and no inline z-index, so "the front window" helpers
  that sort by `style.zIndex` never pick it.
- Headless Chrome won't make its window narrower than about 500px, so
  `launch` sets the viewport directly; under 500 wide it also acts as a touch
  phone. Pass the real phone width (390).

## Does every app still open?

*2026-11-15*

```bash
node .claude/skills/know-how/smoke-check.mjs http://127.0.0.1:5199 <outDir>
```

It opens every dock app in turn at desktop width, then at phone width. It
checks each window has content, saves a screenshot of each (with
`CHECK_SHOTS=1`), and fails on any page error. It ignores the noise it expects: no webcam in headless Chrome,
and Music's guest error when the backend is off. Run it after changing the
shell (Desktop, Window, Dock, WindowContext), global CSS, or anything shared.
It takes about a minute.

## Do the windows and the smaller apps still behave?

*2026-11-15*

```bash
node .claude/skills/know-how/window-check.mjs http://127.0.0.1:5199 <outDir>
node .claude/skills/know-how/app-check.mjs http://127.0.0.1:5199 <outDir>
```

- `window-check.mjs` drags, resizes, minimizes, restores and maximizes real
  windows with real mouse events. It checks each keeps its place, comes to
  the front when clicked, and fits on a 390px phone. Run it after touching
  `Window`, `Desktop`, `Dock` or the window context, with
  `minimize-check.mjs` ([feature-checks.md](feature-checks.md)).
- `app-check.mjs` checks:
  - Camera, with a fake webcam: picture, Save, Retake, and off on close;
  - Safari's snippets, and its messages when Brave refuses, from canned
    replies, so it costs no Brave quota;
  - Pokémon's missing name and Try again, and Deoxys, a species filed under
    a form name (eight PokeAPI requests);
  - Music's volume slider.
- For a CSS change, use `style-diff.mjs`
  ([maps-and-layout.md](maps-and-layout.md#every-button-on-the-site-changed-when-one-apps-css-changed)).
- For one feature's own check (NASA News's sidebar, Pokémon's forms, System
  Preferences, dark mode, the Apple menu, minimize), see
  [feature-checks.md](feature-checks.md).

## Is any text too faint to read?

*2026-11-15*

```bash
node .claude/skills/know-how/contrast-scan.mjs http://127.0.0.1:5173 <outDir> [--theme light] [--settings '{"highlight":"graphite"}'] [App…]
```

Opens every dock app maximized, every System Preferences pane and the
Restore Defaults sheet, the Apple menu with its submenu and a highlighted
row, About This Mac, Force Quit and Restart's alert (name those four
"Apple menu", "About This Mac", "Force Quit" and "Restart alert" to scan
only them), and prints each piece of text under WCAG's 4.5:1
(3:1 for large text), with the app, a CSS path, both colours and the
ratio. Dark is the default. About two minutes and a dozen live requests.
It is best effort: a gradient is judged by its worst stop, text on a
picture is left out, and so are the title bar's coloured buttons and text
that is only emoji (they draw in their own colours). A change
to a colour token, or a new app, gets a run in dark (and in Graphite dark
for anything Aqua).

Left over on 2026-11-15, the same in light and dark: white text on
Pokémon's type colours (the games' own), and white text on Aqua buttons
(Force Quit's and Restart's too), judged against the gradient's pale top
though the text sits on the deeper middle. The menu's highlighted row
passes: it has its own deeper gradient (`--gradient-highlight`). Light alone also has white window titles on the title bar's
pale top, Pokémon's yellow title, NASA's ☰ and Terminal's `$`. Rerun the
scan for the current list rather than trusting this one.

## Planes says the plane data isn't answering, in dev only

*2026-11-16*

- **Symptom:** in the dev server Planes shows "The plane data service
  isn't answering right now", while every check passes.
- **Cause:** the dev server was running an old `vite.config.ts` without
  the `/api/planes` rule, so the request went to the Spotify backend, which
  answered 404 (`curl -i http://127.0.0.1:5173/api/planes/v2/mil` showed
  `server: uvicorn`). A `git stash` and `git stash apply` had swapped the
  file out and back, and Vite restarted on the old one. The checks can't
  see it: they answer `/api/planes` themselves.
- **Fix:** `touch vite.config.ts` (Vite restarts), or restart the dev
  server. And don't `git stash` while Alex's dev server is running.
- **Check:** the same `curl` answers 200 with JSON.

## The dev server isn't on the port the preview says

*2026-11-09*

- **Symptom:** `preview_start` reported port 5174, but nothing worked there.
- **Cause:** Vite was really listening on `127.0.0.1:5173`. The dev script
  binds `127.0.0.1` (for Spotify), and Alex's own server already held the
  port.
- **Fix and check:** `lsof -nP -iTCP -sTCP:LISTEN | grep node` shows the
  real ports. Use `127.0.0.1`, not `localhost`.

## `npm run lint` fails

*2026-11-15, rewritten the same day*

- **Symptom:** `npm run lint` reports a problem.
- **Cause:** since 2026-11-15 the whole repo lints clean, with no errors and
  no warnings. So a problem is new: from your change, or one made since.
- **Fix:** fix it, don't work around it. The one deliberate exception is the
  `eslint-disable-next-line react-hooks/exhaustive-deps` above the infinite
  scroll observer in `FieldGuide.tsx`, with its reason beside it. Copy that
  only when the reason really holds.
- **Check:** `npm run lint` prints nothing after its header.
