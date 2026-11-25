# Finder

Part of the `system-map` skill. The index is in `SKILL.md`.

Finder is the site's "about me": a window onto a small pretend disk about
Alex. It's the first app in the Dock and what About This Mac's More Info…
opens, so it's often the first thing a visitor reads.

## Contents

1. [The files](#1-the-files)
2. [The pretend disk](#2-the-pretend-disk)
3. [Opening things](#3-opening-things)
4. [The layouts](#4-the-layouts)
5. [Decisions](#5-decisions)

## 1. The files

All in `src/components/Apps/Finder/`.

| File | Holds |
|---|---|
| `finderFiles.ts` | The disk: every folder, document, project and link, and the lookups (`pathTo`, `findFolder`, `itemCount`). Pure data, tested in `finderFiles.test.ts` |
| `finderHistory.ts` | Back and Forward: the folders opened, as a stack. Pure, tested in `finderHistory.test.ts` |
| `Finder.tsx` | The window: toolbar, sidebar, items, info pane, status line, keys |
| `FinderIcon.tsx` | An item's icon: the app's own for a project; a folder, page or internet location drawn in CSS for the rest |
| `TextDocument.tsx` | A document's text, for the info pane and for its own window |
| `Finder.css` | All of it, the document window included (`.finder-doc-window`) |

`know-how/finder-check.mjs` proves it in a browser (know-how,
`feature-checks.md`).

## 2. The pretend disk

```
Alex                  the home folder
  About Me.txt        documents (SimpleText)
  Projects/           one item per app on the site, with its note
    macOS 1999        the desktop itself; opens About This Mac
    Field Guide, Planes, Pokémon, NASA News, Music, System Preferences
    Utilities/        the smaller apps: Safari, Camera, Calculator, Terminal
  Skills.txt
  Interests.txt
  LinkedIn, GitHub    internet locations
```

The sidebar lists Alex, Projects and Utilities, then LinkedIn and GitHub
under On the Web.

**A project's note** has a one-line summary, what it does (`about`), how
it's built (`built`) and what it talks to (`services`). **Keep every note
true**: it is public, and Alex wants what the site shows to be right. Each
note was written from this skill's apps table and the `apis` and
`field-guide` skills; when an app changes in a way its note mentions,
change the note in the same piece of work.

**Anything about Alex comes from Alex.** Never invent a bio line, a skill or
a job. About Me.txt, Skills.txt and Interests.txt hold what Alex wrote
(Skills' "Also on this site" lists only what the repo itself shows).

`finderFiles.test.ts` fails when an app in the Dock (bar the Trash and
Finder) has no project, when a project names an app that doesn't exist, or
when two items share an id. So a new app needs a project here
([Adding an app](SKILL.md#8-adding-an-app)).

## 3. Opening things

A click chooses an item and shows it in the info pane. A double-click,
Return, ⌘↓ or the info pane's Open button opens it:

| Kind | Opens |
|---|---|
| Folder | Here, and Back can return (`visit` in `finderHistory.ts`) |
| Document | In its own window through `openWindow`, with no `appId`. One window each: opening it again finds the open window by its title and brings it back (restoring it if minimized). Titles are unique on the disk, which is what makes that safe |
| Project | The real app, through `showApp` |
| Link | A new tab, `noopener` |

Keys: ⌘[ and ⌘] are Back and Forward, ⌘↑ the enclosing folder. The view,
icons or list, is kept in localStorage under `macos-1999-finder-view`.

## 4. The layouts

Finder fills its window edge to edge (`.window-content:has(.finder-app)` in
`Window/styles.css`), and the sidebar, the items and the info pane each
scroll on their own. It sizes itself from its own width (`container-type`
on `.finder-app`):

- **640px and wider:** sidebar, items, and the info pane on the right, on
  the folder itself when nothing is chosen.
- **Narrower** (the 400px window it opens in, a phone): a slimmer sidebar,
  and the info pane under the items, up to half the height, only once
  something is chosen.
- **Narrower on a phone** (a screen under 800px, the site's phone width, or
  a touch screen), **or under 360px anywhere:** no sidebar; the path in the
  toolbar and the home folder's own links do its job, and the icons spread
  evenly across the room it leaves.
- **The toolbar's symbols are drawn in CSS** (`.finder-tool-glyph`), never
  typed: an iPhone shows ◀ and ▶ as blue emoji buttons.

**A document's window** is a SimpleText: a formatting bar (font, size,
bold, italic, underline, alignment, Revert) over a page you can type in
(`contentEditable`). Nothing is saved; Revert remounts the page. Styling goes
through `document.execCommand`, which is deprecated but still in every
browser, and is the only way to style a selection without an editor
library. The page's selection is kept on `selectionchange`, so a menu,
which takes the focus, still styles what was selected; the buttons keep the
focus off themselves (`preventDefault` on pointer and mouse down).

The icons Finder draws are in its own palette, so they stay the same in
light and dark, as icons do; the folder is built from the Aqua ramp, so
Graphite turns it grey.

## 5. Decisions

1. **Projects are this site's apps only** (Alex, 2026-11-25). Alex's work
   projects are confidential, so the portfolio is the apps here, and a
   visitor can open each one to see it working.
2. **A click shows, a double-click opens**, as on a Mac. The info pane's
   Open button is the way in on a phone, where a double-tap is awkward.
3. **Documents open in their own windows** (SimpleText), not inside
   Finder, so they behave like any other window: drag, minimize, Force Quit.
4. **No email address on the site** (Alex, 2026-11-25), to keep it from
   spam bots. About Me points to LinkedIn as the way to get in touch.
5. **About Me is Alex's own words**, from a short interview (2026-11-25):
   role and place, how Alex got into building things, why an old Mac, and
   that every project was built for Alex's own use. Change it only from
   what Alex says.
