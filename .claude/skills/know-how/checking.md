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

## Does NASA News's sidebar still work?

*2026-11-15*

```bash
node .claude/skills/know-how/nasa-check.mjs http://127.0.0.1:5199 <outDir>
```

It drives the sidebar of past days against live science.nasa.gov at
400×300, maximized and on a 390px phone, and saves a screenshot of each
step. It checks the ☰ in the heading row; that scrolling loads 20 more, one
page at a time; a picture day, an .mp4 day and a YouTube day; search, its
count, "No days match" and clearing it; the date box (1995-06-20, and the
gap day 1995-06-18); Today; and that late replies are dropped. Its header
lists every check. About 15 requests per size; run it after any change to
NASA News. When its default days are more than five pages old, pass newer
ones (`apis` skill, `nasa.md`).

Lessons from writing it:

- An IntersectionObserver reports at once whether its target is in view, so
  "scrolling loads more" needs a check that it *stops*: the script waits,
  then checks the end of the list is more than the 200px margin below view.
- A list sliding shut still covers what's under it for its 0.2 s
  transition; wait before clicking the ☰ again.

## Do Pokémon's forms still work?

*2026-11-15*

```bash
node .claude/skills/know-how/pokemon-forms-check.mjs http://127.0.0.1:5199 <outDir>
```

It drives Pokémon against live PokeAPI at 400×300, maximized and on a 390px
phone, and saves a screenshot of each step. It checks the Megas and
Gigantamax hanging off their stage (Dragonite, Charizard, Raichu's family),
that Dragonite has no Forms row, Raichu's open one-line row, Pikachu's folded
"▸ Other forms (15)" opening and staying open for the session, clicking a
Mega and a form, ← → by Pokédex number, stale replies, a missing sprite
(Mega Zygarde), that nothing sticks out of the window, and spot-checks three
forms against PokeAPI asked directly. Its header lists every check. About 55
requests; run it after any change to Pokémon.

Lessons from writing it:

- A missing sprite turns into the "?" only when its 404 comes back, so wait
  for the "?" before checking there's no `<img>`. Checking at once passed one
  run and failed the next.
- To spot-check a name, wait for the heading to *change*, not for the name
  you expect: if the name is wrong, a wait for it only times out, while a
  wait for any change shows the wrong name in the diff.
- A folded list kept in the page with `hidden` still has cards in the DOM,
  but with no box. Count only cards with `getClientRects().length > 0` when
  checking what sticks out.

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
