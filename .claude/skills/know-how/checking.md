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
- `typeInto(selector, text)` types into a React-controlled input or
  textarea (setting `.value` alone, React never notices).
- `drag(x1, y1, x2, y2)` and `clickAt(x, y)` send real mouse events, so
  pointer handlers run (`el.click()` fires no pointerdown).
- `launch(url, dir, { chromeArgs: FAKE_CAMERA })` gives Chrome a fake webcam
  that needs no permission prompt.
- `setGeolocation(lat, lng)` / `denyGeolocation()` fake the browser location.
- `s(method, params)` sends any raw DevTools command.
- `finish(ignoreRegexes)` adds a "no page errors" check and prints the tally.

Lessons from writing these:

- **Wait for the visible result, not for time.** One check passed before the
  place had even loaded. Wait for the text the user would see (the badge
  naming the country), then check.
- `waitFor` wraps its expression in `!!(…)`. Returning a DOM node over the
  DevTools protocol fails with "Object reference chain is too long".
- **Pace iNaturalist:** about 20 s between range views in a script (the `apis`
  skill, `inaturalist.md`).
- **Test both window sizes**, the default small window and maximized.
  Layout bugs hide in the small one.
- To prove that Back returned to the **same** view and didn't rebuild it,
  set `el.dataset.probe = '1'` before the jump and check it's still there
  after.
- For a layout check, measure the real numbers first (a single toolbar row
  is 27px with padding) before choosing a threshold.
- `shot(name)` saves under exactly that name, so include `.png`.
- `clickButton(text)` matches the visible text. The window buttons show ×, −
  and +, so click those by selector (`.window-maximize`).
- Headless Chrome won't make its window narrower than about 500px, so
  `launch` sets the viewport directly; under 500 wide it also acts as a touch
  phone. Pass the real phone width (390).

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

## Do the windows and the smaller apps still behave?

*2026-11-15*

```bash
node .claude/skills/know-how/window-check.mjs http://127.0.0.1:5199 <outDir>
node .claude/skills/know-how/app-check.mjs http://127.0.0.1:5199 <outDir>
```

- `window-check.mjs` drags, resizes, minimizes, restores and maximizes real
  windows with real mouse events. It checks each keeps its place, comes to
  the front when clicked, and fits on a 390px phone. Run it after touching
  `Window`, `Desktop`, `Dock` or the window context.
- `app-check.mjs` checks:
  - Camera, with a fake webcam: picture, Save, Retake, and off on close;
  - Notes keeps its text;
  - Safari's snippets, and its messages when Brave refuses, from canned
    replies, so it costs no Brave quota;
  - Pokémon's missing name and Try again, and Deoxys, a species filed under
    a form name (eight PokeAPI requests);
  - Music's volume slider.
- For a CSS change, use `style-diff.mjs`
  ([maps-and-layout.md](maps-and-layout.md#every-button-on-the-site-changed-when-one-apps-css-changed)).
- For one feature's own check (NASA News's sidebar, Pokémon's forms, System
  Preferences, dark mode, the Apple menu), see
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
