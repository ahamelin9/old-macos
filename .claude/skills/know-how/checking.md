# Know-how: checking your work

Part of the `know-how` skill. The index is in `SKILL.md`.

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

3. **Look at the screenshots** (Read the PNG) as well as the PASS lines.
   Send the useful ones to Alex.

What the helper gives you:

- `ev(js)` runs JavaScript in the page.
- `waitFor(js, label)` polls until it's true.
- `check(name, ok, detail)` records a result.
- `shot(file, selector?)` saves a screenshot.
- `openApp(dockLabel)` clicks a dock icon.
- `setGeolocation(lat, lng)` / `denyGeolocation()` fake the browser location.
- `s(method, params)` sends any raw DevTools command.
- `finish(ignoreRegexes)` adds a "no page errors" check and prints the tally.

Lessons from writing these:

- **Wait for the visible result, not for time.** One check passed before the
  place had even loaded. Wait for the text the user would see (the badge
  naming the country), then check.
- `waitFor` wraps its expression in `!!(…)`. Returning a DOM node over the
  DevTools protocol fails with "Object reference chain is too long".
- **Pace iNaturalist:** about 20 s between range views in a script (see
  `apis.md`).
- **Test both window sizes**, the default small window and maximized.
  Layout bugs hide in the small one.
- To prove that Back returned to the **same** view and didn't rebuild it,
  set `el.dataset.probe = '1'` before the jump and check it's still there
  after.
- For a layout check, measure the real numbers first (a single toolbar row
  is 27px with padding) before choosing a threshold.

## Does every app still open?

*2026-11-15*

```bash
node .claude/skills/know-how/smoke-check.mjs http://127.0.0.1:5199 <outDir>
```

It opens every dock app in turn at desktop width, then at phone width. It
checks each window has content, saves a screenshot of each, and fails on any
page error. It ignores the noise it expects: no webcam in headless Chrome,
and Music's guest error when the backend is off. Run it after changing the
shell (Desktop, Window, Dock, WindowContext), global CSS, or anything shared.
It takes about a minute.

## The dev server isn't on the port the preview says

*2026-11-09*

- **Symptom:** `preview_start` reported port 5174, but nothing worked there.
- **Cause:** Vite was really listening on `127.0.0.1:5173`. The dev script
  binds `127.0.0.1` (for Spotify), and Alex's own server already held the
  port.
- **Fix and check:** `lsof -nP -iTCP -sTCP:LISTEN | grep node` shows the
  real ports. Use `127.0.0.1`, not `localhost`.

## Lint fails before you changed anything

*2026-11-15*

- **Symptom:** `npm run lint` fails on files you didn't touch.
- **Cause:** old problems in apps nobody has worked on lately. To list the
  files that have them now:

  ```bash
  npx eslint . 2>/dev/null | grep -E '^/'
  ```

  On 2026-11-15 there were 16 errors, in PokemonSearch, Trash, Safari, Music
  and Window. The rest were warnings, including the one expected Field Guide
  warning. The `Window.tsx` error is a real bug (`system-map`, section 8).
- **Fix:** lint only what you touched (`npx eslint <files>`) and say so.
  Don't fix the old ones unless asked.
- **Check:** your files add nothing new to the list.
