# Know-how: the smaller apps

Part of the `know-how` skill. The index is in `SKILL.md`. For checking these
apps in a browser, see `app-check.mjs` (`checking.md`).

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
