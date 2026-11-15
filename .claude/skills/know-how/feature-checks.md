# Know-how: checking one feature

Part of the `know-how` skill. The index is in `SKILL.md`. Each entry is a
browser check for one feature: the command, what it covers, and what was
learned writing it. How to run any of them, and the checks every change
needs, are in [checking.md](checking.md).

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

## Does System Preferences still work?

*2026-11-15*

```bash
node .claude/skills/know-how/preferences-check.mjs http://127.0.0.1:5199 <outDir>
```

Run it from the repo root (it uploads `public/mac-os-background.jpg`). It
makes no outside requests and takes about a minute. Its header lists every
check: each setting changes what it should, at once and in a window already
open; each survives a reload, and the early script had set it before React
drew; an upload is shrunk to a 2560px JPEG in IndexedDB and survives a
reload; a text file, a 26 MB file and a broken picture are turned away;
Remove Picture, Restore Defaults, its Cancel and Escape; the site loads with
the defaults when localStorage and IndexedDB throw; and the window at
400×300 (also at Larger), maximized, at its 300px minimum and on a 390px
phone, with the Dock still fitting. Run it after any change to settings,
`tokens.css`'s Settings block, the Dock or the Desktop.

Lessons from writing it:

- **The Dock eases to a new size over 0.2 s**, so read its size about
  half a second after a change, not at once.
- **Seed or block storage before the page's own scripts**, with
  `Page.addScriptToEvaluateOnNewDocument` and a reload. Blocking is
  `Object.defineProperty(window, 'localStorage', { get() { throw … } })`,
  which is what some private windows do.
- To prove the early script ran before React, record `<html>`'s attributes
  from a MutationObserver the moment `<body>` appears.
- `DOM.setFileInputFiles` picks a file without the dialog, and Chrome takes
  its type from the extension, so `huge.jpg` full of zeros tests the size
  limit.
- The phone Dock leaves System Preferences out, so the check opens it 800px
  wide, then narrows the screen to 390px.
- For screenshots with a setting on, `app-shots.mjs` takes `--settings`
  (the `design` skill, section 4).

## Does dark mode still work?

*2026-11-15*

```bash
node .claude/skills/know-how/dark-mode-check.mjs http://127.0.0.1:5173 <outDir>
```

About a minute, no outside requests. Its header lists the checks: a first
visit on a dark computer is dark as soon as the styles load, before React
draws and with nothing saved; System follows the computer both ways with no
reload; Light and Dark override it; the choice is saved, survives a reload
and is dark again before React; Graphite turns dark title bars grey; Restore
Defaults and an older save without a theme give System; and the
Appearance pane's three tiles fit at 400×300, at Larger and on a phone. Run
it, then the contrast scan (next), after any change to the dark blocks in
`tokens.css`, the early script or the Appearance pane. How dark mode works:
the `design` skill, `dark-mode.md`.

Lessons from writing it:

- **Headless Chrome says the computer is light.** Fake a dark one with
  `Emulation.setEmulatedMedia({ features: [{ name: 'prefers-color-scheme',
  value: 'dark' }] })`. Changing it on an open page re-matches the media
  query at once, which is how the check proves System follows live; it
  marks the page first to show there was no reload.
- **In dev, Vite adds the CSS from JavaScript**, so "the first paint" is
  the moment `tokens.css` arrives. The check records the theme from a
  MutationObserver set up with `Page.addScriptToEvaluateOnNewDocument`,
  the first time `--color-surface` has a value. The built site links its
  CSS in `<head>`, so it is dark even sooner there.

## Does the Apple menu still work?

*2026-11-15*

```bash
node .claude/skills/know-how/apple-menu-check.mjs http://127.0.0.1:5173 <outDir>
```

About a minute and a half, no outside requests. It drives the menu with real
mouse, key and touch events; its header lists every check: the 🍎's roles,
opening and closing (click, click again, outside, Escape), the keyboard,
About This Mac's specs (and that reading them sends and saves nothing), System
Preferences… twice giving one window, Dock Preferences… on the Dock pane,
magnification, Force Quit with a minimized window, Sleep waking on a click,
a key and a tap (and at once with reduced motion), Restart asking first and
then reloading, and the phone at 390px, also at Larger text. It saves the
open menu and About This Mac in light, dark and Graphite on a laptop and a
phone, Force Quit and the alert. Run it after any change to the menu bar,
the window manager's `showApp`, Preferences' panes or the kit's `mac-menu`.
How the menu works: the `system-map` skill, `apple-menu.md`.

Lessons from writing it:

- **A highlight that looks missing in a screenshot may be there.** The
  🍎's blue looked absent in a 2x shot viewed small; reading the pixel
  showed it was fine. Before debugging the CSS, take a clip at `scale: 4`
  (`Page.captureScreenshot` with a `clip`) or read the pixel.
- **Real keys:** `Input.dispatchKeyEvent` with `key`, `code` and
  `windowsVirtualKeyCode`; Enter needs `text: '\r'` to act like a real one.
- **Real taps:** turn on `Emulation.setTouchEmulationEnabled`, then send
  `Input.dispatchTouchEvent` touchStart and touchEnd. The page sees pointer
  events with `pointerType` "touch" and a click, so hover-only code (which
  checks `pointerType`) stays out of the way, as on a phone.
- **To prove a reload,** set a marker on `window` first and wait for it to
  vanish; `ev` throws while the page navigates, so catch and retry.
