/**
 * The two colours JavaScript hands to iNaturalist's map tiles.
 *
 * Both map layers accept a `color` query param, so the tiles are tinted from
 * the Field Guide's own colour key rather than iNaturalist's defaults (pink
 * ranges, orange grid). The whole key lives as --fg-* custom properties on
 * `.fieldguide-app` in FieldGuide.css; these two mirror --fg-range and
 * --fg-sightings there, so change both together. They are the only raw
 * colours in the app's code, so each is a marked design exception (the
 * `design` skill, rule 5).
 */
export const FIELD_GUIDE_PALETTE = {
  /**
   * The range map layer. Deliberately not "native" green: iNaturalist's range
   * maps show where a species lives now, introduced areas included (house
   * sparrows across North America), so they cannot vouch for native status.
   */
  range: '#5F6B7A', // design-exception: an iNaturalist tile colour, mirrors --fg-range
  /** Observation density on the map; deliberately outside the establishment set */
  sightings: '#C0392B' // design-exception: an iNaturalist tile colour, mirrors --fg-sightings
} as const;

/** iNaturalist wants the leading # percent-encoded in the tile query string */
export const tileColor = (hex: string) => encodeURIComponent(hex);
