# Know-how: maps and layout

Part of the `know-how` skill. The index is in `SKILL.md`.

## Leaflet throws `_leaflet_pos` after the map closes

*2026-11-09*

- **Symptom:** `TypeError: Cannot read properties of undefined (reading
  '_leaflet_pos')` from `_onZoomTransitionEnd`. It happened when you clicked
  away within about a quarter second of a range map loading.
- **Cause:** an animated zoom finished after the map had been removed.
- **Fix:** `fitBounds` / `setView` with `{ animate: false }` (`RangeMap.tsx`).
- **Check:** in a browser script, jump away right after the map appears.
  `finish()` must report no page errors.

## A map is half grey or the wrong size after a resize or being hidden

*2026-11-09*

- **Symptom:** after maximizing or resizing the Field Guide window, or coming
  Back to a hidden range view, part of the map is grey.
- **Cause:** Leaflet measures its container once. It only hears about
  browser resizes, not about the app window changing or a parent going from
  `hidden` to shown.
- **Fix:** add a `ResizeObserver` on the map's container that calls
  `map.invalidateSize()` when its width is over 0. Both `RangeMap.tsx` and
  `MapPreview.tsx` do this. Use the same pattern for any new map.

## A row of buttons shifts by a pixel when one appears

*2026-11-09*

- **Symptom:** the Search tabs moved down 1px whenever the Back button
  appeared.
- **Cause:** an emoji in the label ("Back to ⚡ Tokyo") made the button 23px
  tall, against the tabs' 21px.
- **Fix:** give the buttons in a row a fixed `height` (`21px` in the Field
  Guide toolbar) and `overflow: hidden`.
- **Check:** measure each button's `getBoundingClientRect().top` with and
  without the new button.

## Every button on the site changed when one app's CSS changed

*2026-11-15*

- **Symptom:** every button on the site was bold with a drop shadow, and the
  window's close, minimize and maximize buttons were 8px apart, not the 6px
  `Window/styles.css` asked for. Removing one app's rule restyled 69 groups
  of buttons in other apps.
- **Cause:** `Calculator.css` had bare `button {…}` and `button:active` rules
  and a `.window-controls` rule. Every stylesheet is global, so they reached
  every button and the window's own controls. `main.tsx` imports `App` before
  `src/styles.css`, so app stylesheets load first and `src/styles.css` wins
  wherever both set a property; only what it didn't set leaked through.
- **Fix:** the site-wide button look, bold and shadows included, is in
  `src/styles.css` on purpose now. The Calculator's classes are
  `calculator-…`, and the 8px gap lives in `Window/styles.css`. In an app's
  stylesheet, put everything under the app's own classes, never a bare
  element.
- **Check:** `style-diff.mjs` snapshots every button's computed style. Take
  two before the change (they should match), one after, then `--diff`. This
  fix changed 0 of 136 elements.

## A bar's right end is cut off in the 400px window

*2026-11-15*

- **Symptom:** Music's "Connect to Spotify" button sat past the right edge of
  the window it opens in. Once it fit, the LCD's end time was clipped.
- **Cause:** fixed widths (150px on each side, 15px margins) added up to more
  than 400px. And a range input won't shrink below its built-in width of
  about 130px, even with `flex: 1`.
- **Fix:** a container query on the app's root (`.retro-itunes` has
  `container-type: inline-size`, then `@container (max-width: 620px)`)
  tightens the bar, hides the volume and shortens the button to "Connect".
  `min-width: 0` on the slider lets it shrink.
- **Check:** at 400×300 and maximized, `scrollWidth > clientWidth` on the bar
  is false. Look at both screenshots too.
