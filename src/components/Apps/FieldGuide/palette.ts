/**
 * The Field Guide's colour key, in one place.
 *
 * Both map layers accept a `color` query param, so the tiles are driven from
 * these values rather than iNaturalist's defaults (pink ranges, orange grid).
 * That lets "Native" be the same green in the range map and in the
 * "Where it lives" table instead of two unrelated colour schemes on one page.
 *
 * These are mirrored as CSS custom properties on `.fieldguide-app` in
 * FieldGuide.css -- change both together.
 */
export const FIELD_GUIDE_PALETTE = {
  native: '#5E9E4A',
  introduced: '#C4763A',
  endemic: '#8E5FBF',
  present: '#5B7FA6',
  absent: '#E8E8E8',
  /** Observation density on the map; deliberately outside the establishment set */
  sightings: '#C0392B'
} as const;

/** iNaturalist wants the leading # percent-encoded in the tile query string */
export const tileColor = (hex: string) => encodeURIComponent(hex);
