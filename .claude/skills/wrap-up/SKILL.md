---
name: wrap-up
description: Where learnings for the macOS 1999 site go, and the end-of-session wrap-up so nothing learned is lost. Use when Alex says "wrap up", "that's it for today", "save what we learned", "don't lose this" or "get ready for a commit", when a piece of work is finished, or when asked where a learning, decision, preference, idea or script belongs (memory, a skill, CLAUDE.md, or nowhere).
---

# Wrap-up: where learnings go

Every learning has one home. Put it there once, link to it from elsewhere if
needed, and never keep two copies that can drift apart. Before adding, look
for an existing entry and update it instead.

## Contents

1. [Where each kind of learning goes](#where-each-kind-of-learning-goes)
2. [Memory or a skill?](#memory-or-a-skill)
3. [End-of-session checklist](#end-of-session-checklist)

## Where each kind of learning goes

| What you learned | Where it goes | Example |
|---|---|---|
| How Alex wants to work on this site: a preference, a correction, a "do it this way" | **`CLAUDE.md`**, **How a change goes** (one or two lines) | Alex makes the commits; Claude gets them ready |
| Something personal that doesn't belong in a public repo, or about Alex beyond this site | **Memory** (see below) | |
| A link to something outside the repo | The skill that uses it (`apis` for services) | The Brave Search worker's URL |
| A problem that took troubleshooting: symptom, cause, fix, check | **`know-how`**: an entry in the topic file that fits, plus a row in its index. If it's about an outside API, the entry goes in that service's file in the **`apis` skill**, with a row in know-how's index | iNaturalist's 429 shows up as "Failed to fetch" |
| A reusable test or check script | **`.claude/skills/know-how/`**, next to `cdp.mjs`, never the scratchpad (it's deleted after the session) | `smoke-check.mjs` |
| How the site fits together: a new app, a moved file | **`system-map` skill**: the apps table, the Spotify table | A new dock app gets a row |
| An outside API: a new service, a key or env var, a limit, a usage rule, a known issue | **`apis` skill**: that service's file (a new file and an index row for a new service), and its audit table | Brave allows 1 search a second |
| Field Guide data facts, decisions and their reasons, spot-check answers | **`field-guide` skill** (sections 3 to 6) | "All Species sends no group filter" |
| A shared colour, size or pattern, or a decision about how the site looks | **`tokens.css`** for the value, **`design` skill** for the rule or decision | "Snap to the nearest token" |
| An idea raised but not built, or a question still open | The **"ideas not done yet"** list in that app's skill (`field-guide` section 8), or system-map's **Known rough edges** for the whole site | Bird sounds |
| A new skill, or a new kind of thing to look up | **`CLAUDE.md`**: a row in **Table of contents** | A `pokemon` skill once that app grows |
| A rule every change must keep | **`CLAUDE.md`**, **Guardrails** | No secrets in `VITE_*` vars |
| Something the code or git history already says | **Nowhere**: don't save it | The file list of `src/` |
| Something that only mattered in this conversation | **Nowhere** | A typo fixed along the way |

## Memory or a skill?

What each place costs:

- **`CLAUDE.md`** is loaded every session, here and in cloud sessions, and
  Alex can read it. Keep it short: rules and pointers only.
- **A skill** is loaded only when its topic comes up, and holds the long
  version: steps, tables, scripts. A skill that grows past about 300 lines
  should become an index plus topic files, the way `know-how` is.
- **Memory** is loaded every session but only on this Mac, and Alex can't
  easily see it. Use it only for what can't go in the repo. Never copy what
  `CLAUDE.md` or a skill already says. (On 2026-11-15, memories that
  repeated `CLAUDE.md` were removed for that reason.)

Memory files go in Claude's memory directory for this project (the system
prompt names it):

- one fact per file, with frontmatter (`name`, `description`,
  `metadata.type`);
- a one-line pointer to each file in `MEMORY.md`;
- real dates, not relative ones ("tomorrow").

## End-of-session checklist

1. **Checks.** Run the checks in CLAUDE.md's **Running and checking**
   table, plus a browser check (know-how, `checking.md`) for anything you can
   see. Say which ran and what they gave. Say plainly what didn't run.
2. **Learnings.** Go back through the session and route each one with the
   table above. Look for these in particular:
   - Alex's corrections, and anything Alex said "from now on" about;
   - anything that took more than one try to get right (that's a
     `know-how` entry);
   - test scripts still in the scratchpad that are worth keeping;
   - ideas Alex raised or you offered that weren't built.
3. **Keep the maps true.** If the work added an app, moved a file, added a
   service or env var, or changed a Field Guide rule, update `system-map`
   or `field-guide` to match. Add any new skill to `CLAUDE.md`.
4. **Stale notes.** Fix or delete memory or skill text that today proved
   wrong.
5. **Ready for a commit** (CLAUDE.md, step 5). Check that `git status`
   shows only the files the work meant to change: no stray
   `.claude/launch.json` and no scratch files.
6. **Report.** Give a short list of what went where, so Alex can check it.
