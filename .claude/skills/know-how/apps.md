# Know-how: the smaller apps

Part of the `know-how` skill. The index is in `SKILL.md`. For checking these
apps in a browser, see `app-check.mjs` (`checking.md`).

## Two files whose names differ only by capitals

*2026-11-15*

- **Symptom:** `npx tsc -b` fails with "File name '…/Planes/planes.ts'
  differs from already included file name '…/Planes/Planes.ts' only in
  casing", and `launch.tsx` says the component "has no default export".
- **Cause:** a helper `planes.ts` sat beside the component `Planes.tsx`. A
  Mac's disk ignores capitals, so `./Planes/Planes` found `planes.ts` first.
- **Fix:** give the helper a different name (`aircraft.ts`).
- **Check:** `npx tsc -b` prints nothing.

## The webcam stays on after Camera closes

*2026-11-15*

- **Symptom:** the camera light stayed on after the Camera window closed. In
  dev, a second stream opened too.
- **Cause:** the cleanup called `stopCamera`, which read `stream` from state.
  An effect with `[]` deps keeps the first render's values, where `stream`
  was still null, so nothing was stopped. React's dev double-run also started
  a second stream that nothing tracked.
- **Fix:** keep the stream in a ref, and give the effect a `cancelled` flag
  that stops a stream arriving after the cleanup (`Camera.tsx`). Retake
  brings back a new `<video>`, which needs `srcObject` again, so a second
  effect hands it over. Use the same pattern for anything an effect starts
  asynchronously and must stop: the cleanup reads a ref, not state.
- **Check:** `app-check.mjs` keeps every stream the page asks for, then
  counts the live tracks after closing. It should find 0.

## Pokémon says "turn off wifi" for a misspelled name

*2026-11-15*

- **Symptom:** a name that doesn't exist showed "If on mobile try turning
  off wifi or the PokeAPI might be down."
- **Cause:** PokeAPI answers an unknown name with 404. The app then tried two
  mirror APIs, which are dead (they gave 404 even for `pikachu` on
  2026-11-15), and reported every failure as a network problem.
- **Fix:** ask pokeapi.co only (`fetchPokemon` in `PokemonSearch.tsx`). A 404
  says `No Pokémon called "…"`. A network error or a 5xx says the API might
  be down. The error box has a Try again button.
- **Check:** `app-check.mjs`, the Pokémon part.

## Changing Music's volume would disconnect the Premium player

*2026-11-15*

- **Symptom:** none seen yet. It turned up while adding the volume slider,
  and is probably why the `volume` state had no slider.
- **Cause:** `volume` was in the deps of the effect that builds the Spotify
  Web Playback SDK player. Any change would run its cleanup
  (`player.disconnect()`), and the SDK's ready callback never fires a second
  time, so no new player would come.
- **Fix:** the player starts at `DEFAULT_VOLUME`, and a separate effect calls
  `player.setVolume` (or sets the preview `<audio>` volume). Keep settings
  that change out of that effect's deps.
- **Check:** `app-check.mjs` checks the slider. Playing with Premium needs
  Alex's login, so it can't be checked headless.

## A guest preview won't start, or the end of a clip skips several tracks

*2026-11-15*

- **Symptom 1:** pressing a track loads its preview but nothing plays, and
  the console says `AbortError: The play() request was interrupted by a new
  load request`.
- **Cause:** `play()` ran in a `setTimeout` right after `setPreviewUrl`,
  before React had given the `<audio>` element its new `src`. The new
  `src` then loaded and cut the play off.
- **Fix:** `playTrack` bumps `previewPlays`, and an effect calls `play()`
  after the render. That effect ignores an `AbortError`, which only means
  another track was pressed.
- **Symptom 2** (would have shown once previews played): the end of one
  clip skipped ahead several tracks.
- **Cause:** the progress effect added an `ended` listener on every track
  change, and its cleanup removed a new arrow function, so nothing was ever
  removed. Remove a listener by the same function reference you added.
- **Check:** in headless Chrome, mock `/api/client_credentials` with a
  guest token fetched from the live site's endpoint, then press a track and
  read the `<audio>` element's `currentTime` and `paused`. Pass Chrome
  `--autoplay-policy=no-user-gesture-required`, since a scripted
  `click()` isn't a user gesture.
