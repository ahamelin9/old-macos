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
