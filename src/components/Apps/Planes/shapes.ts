/**
 * The shape a plane is drawn with on the map: one of six kinds, told apart
 * by what the plane itself sends (its ICAO type code, then its ADS-B size
 * category), so the map costs no extra requests. The `apis` skill, adsb.md.
 */
import type { Plane } from './aircraft';

export type Kind = 'helicopter' | 'light' | 'prop' | 'jet' | 'heavy' | 'four';

/** Four engines: the jumbos, the big freighters and tankers, the Hercules family */
const FOUR = new Set([
  'A388', 'A342', 'A343', 'A345', 'A346', 'B741', 'B742', 'B743', 'B744', 'B748', 'B74S', 'B74R', 'BLCF',
  'A124', 'A225', 'IL76', 'IL96', 'C17', 'C5M', 'K35R', 'K35E', 'C135', 'R135', 'E3TF', 'E3CF', 'E6', 'B52', 'B703', 'DC87',
  'A400', 'C130', 'C30J', 'P3', 'AN12', 'B29', 'DC6', 'DC7',
]);
/** Twin turboprops: straight wings, engines out front */
const PROP = new Set([
  'AT43', 'AT45', 'AT46', 'AT72', 'AT73', 'AT75', 'AT76', 'DH8A', 'DH8B', 'DH8C', 'DH8D', 'SF34', 'SB20', 'B190', 'E120', 'JS41',
  'BE20', 'BE9L', 'B350', 'BE30', 'C212', 'CN35', 'C295', 'DHC6', 'D228', 'D328', 'L410', 'SW4', 'F27', 'F50', 'AN26', 'DC3', 'V22',
]);

/**
 * Which shape a plane gets. Its type code decides when it is one we know;
 * otherwise its category does: A1 light, A2 small, A3 large, A4 and A5
 * heavy, A7 rotorcraft, B gliders and balloons. Unknown is drawn as a jet.
 */
export const kindOf = (plane: Pick<Plane, 'type' | 'category'>): Kind => {
  if (plane.category === 'A7') return 'helicopter';
  if (FOUR.has(plane.type)) return 'four';
  if (PROP.has(plane.type)) return 'prop';
  if (plane.category === 'A1' || plane.category.startsWith('B')) return 'light';
  if (plane.category === 'A4' || plane.category === 'A5') return 'heavy';
  return 'jet';
};

const ENGINE = (x: number, y: number) => `M${x} ${y}h1.3v2.7h-1.3z`;

/** Each kind's outline, nose up in a 24-unit square, and how many pixels wide it is drawn */
export const SHAPES: Record<Kind, { path: string; size: number }> = {
  jet: {
    size: 24,
    path: 'M12 1.5c.8 0 1.3 1.6 1.3 3.2v4.1l8.2 5v2l-8.2-2.5v4.6l2.4 1.8v1.6L12 20.4l-3.7.9v-1.6l2.4-1.8v-4.6l-8.2 2.5v-2l8.2-5V4.7c0-1.6.5-3.2 1.3-3.2z',
  },
  heavy: {
    size: 30,
    path: `M12 1c1 0 1.6 1.5 1.6 3.3v4.4l9.4 5.6v2.2l-9.4-2.9v4.9l2.8 2v1.7L12 21.2l-4.4 1v-1.7l2.8-2v-4.9L1 16.5v-2.2l9.4-5.6V4.3C10.4 2.5 11 1 12 1z${ENGINE(5.6, 9.6)}${ENGINE(17.1, 9.6)}`,
  },
  four: {
    size: 34,
    path: `M12 1c1 0 1.6 1.5 1.6 3.3v4.4l9.4 5.6v2.2l-9.4-2.9v4.9l2.8 2v1.7L12 21.2l-4.4 1v-1.7l2.8-2v-4.9L1 16.5v-2.2l9.4-5.6V4.3C10.4 2.5 11 1 12 1z${ENGINE(3.2, 11)}${ENGINE(6.6, 9)}${ENGINE(16.1, 9)}${ENGINE(19.5, 11)}`,
  },
  prop: {
    size: 24,
    path: 'M12 1.5c.7 0 1.1 1.2 1.1 2.6V9h9.4v2.4h-9.4v6.6l3 1.4v1.6H7.9v-1.6l3-1.4v-6.6H1.5V9h9.4V4.1c0-1.4.4-2.6 1.1-2.6zM5.9 6.4h1.7V9H5.9zM16.4 6.4h1.7V9h-1.7z',
  },
  light: {
    size: 18,
    path: 'M12 3c.7 0 1.1 1 1.1 2.1v2.6h8.9v3h-8.9v6l2.9 1.2v1.9H8v-1.9l2.9-1.2v-6H2v-3h8.9V5.1C10.9 4 11.3 3 12 3zM8.6 1.9h6.8V3H8.6z',
  },
  helicopter: {
    size: 24,
    path: 'M12 4.2c2 0 3.1 1.7 3.1 3.9 0 1.9-.9 3.3-2 3.9l-.4 6.6h2.3v1.6H9v-1.6h2.3l-.4-6.6c-1.1-.6-2-2-2-3.9 0-2.2 1.1-3.9 3.1-3.900zM3.300 1.400l1-1.100L20.700 13.800l-1 1.100zM19.700.300l1 1.100L4.300 14.900l-1-1.100z',
  },
};
