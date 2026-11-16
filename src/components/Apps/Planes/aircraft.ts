/**
 * Live aircraft for the Planes app, from adsb.lol through the site's own
 * /api/planes (adsb.lol answers no browser directly), and the sums the app
 * does with them. The `apis` skill, adsb.md.
 */
export const PLANES_API = '/api/planes/v2';
/** adsb.lol refuses a wider circle than this */
export const MAX_RADIUS_NM = 250;

export interface Plane {
  /** The airframe's ICAO 24-bit address: the one id that never changes */
  hex: string;
  /** The callsign it is sending (UAL188), or '' */
  flight: string;
  /** Its tail number (N24979), or '' */
  registration: string;
  /** ICAO type code (B789), or '' */
  type: string;
  /** ADS-B size category (A1 light … A5 heavy, A7 rotorcraft), or '' */
  category: string;
  lat: number;
  lon: number;
  /** Pressure altitude in feet; null when it sends none or is on the ground */
  altitudeFt: number | null;
  onGround: boolean;
  /** Ground speed in knots */
  speedKt: number | null;
  /** The way it is moving over the ground, degrees from north */
  track: number | null;
  /** Feet a minute, up or down */
  climbFpm: number | null;
  squawk: string;
  /** Seconds since this position was heard, when the reply was made */
  positionAge: number;
}

interface RawAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  category?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  seen_pos?: number;
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A callsign as sent, without its padding. Some transponders send filler ("@@@@@@@@"): that is no callsign. */
const cleanFlight = (flight: string | undefined): string => {
  const trimmed = (flight ?? '').trim();
  return /^[A-Z0-9]+$/.test(trimmed) ? trimmed : '';
};

/** adsb.lol's reply as planes. One with no position can't be shown, so it is left out. */
export const toPlanes = (data: unknown): Plane[] => {
  const list = ((data ?? {}) as { ac?: RawAircraft[] }).ac;
  if (!Array.isArray(list)) return [];
  const planes: Plane[] = [];
  for (const raw of list) {
    const lat = num(raw.lat), lon = num(raw.lon);
    if (!raw.hex || lat === null || lon === null) continue;
    const onGround = raw.alt_baro === 'ground';
    planes.push({
      hex: raw.hex,
      flight: cleanFlight(raw.flight),
      registration: (raw.r ?? '').trim(),
      type: (raw.t ?? '').trim(),
      category: raw.category ?? '',
      lat,
      lon,
      altitudeFt: onGround ? null : num(raw.alt_baro) ?? num(raw.alt_geom),
      onGround,
      speedKt: num(raw.gs),
      track: num(raw.track),
      climbFpm: num(raw.baro_rate) ?? num(raw.geom_rate),
      squawk: raw.squawk ?? '',
      positionAge: num(raw.seen_pos) ?? 0,
    });
  }
  return planes;
};

/** What went wrong, in words the app can show */
export class PlanesError extends Error {}

const TIMEOUT_MS = 10000;

/** One call to /api/planes. Throws a PlanesError that says what happened; an abort passes through. */
const ask = async (path: string, signal?: AbortSignal): Promise<Plane[]> => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${PLANES_API}/${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new PlanesError(timeout.aborted ? 'The plane data took too long to arrive.' : 'Couldn’t reach the plane data. Check your connection.');
  }
  if (res.status === 429) throw new PlanesError('The plane data service is busy. It will try again shortly.');
  if (!res.ok) throw new PlanesError('The plane data service isn’t answering right now.');
  try {
    return toPlanes(await res.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new PlanesError('The plane data came back unreadable.');
  }
};

/** The path for planes within a circle. Two decimals (about a kilometre) is plenty, and lets nearby views share a cached reply. */
export const nearPath = (lat: number, lon: number, radiusNm: number): string => {
  const radius = Math.min(MAX_RADIUS_NM, Math.max(1, Math.ceil(radiusNm)));
  return `point/${lat.toFixed(2)}/${wrapLon(lon).toFixed(2)}/${radius}`;
};

export const planesNear = (lat: number, lon: number, radiusNm: number, signal?: AbortSignal) =>
  ask(nearPath(lat, lon, radiusNm), signal);

// ---- Looking a plane up

export type LookupKind = 'callsign' | 'reg' | 'type' | 'mil';

/** What was typed, as adsb.lol wants it: capitals, no spaces */
export const cleanQuery = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9-]/g, '');

/**
 * Which lookups to try for what was typed, likeliest first. A tail number
 * with a hyphen (G-XLEA) can be nothing else; four characters or fewer is
 * most likely a type (A388, B738, C172); anything else a flight, then a tail
 * number (N24979 reads as either).
 */
export const lookupOrder = (query: string): LookupKind[] => {
  if (query.length < 2 || query.length > 10) return [];
  if (query.includes('-')) return ['reg'];
  if (query.length <= 4) return ['type', 'callsign', 'reg'];
  return ['callsign', 'reg'];
};

/** A flight number as a ticket shows it (UA188, BA9), which planes don't send: they send the airline's three-letter code (UAL188) */
export const looksLikeTicketFlight = (query: string): boolean => /^(?:[A-Z]\d|\d[A-Z]|[A-Z]{2})\d{1,4}[A-Z]?$/.test(query);

export interface Found {
  kind: LookupKind;
  /** What was looked up in the end (the ICAO callsign when a ticket number was translated) */
  query: string;
  planes: Plane[];
}

/**
 * Every plane in the air (or on the ground, sending) that matches, trying
 * each lookup in turn and stopping at the first that finds any.
 * `toCallsign` turns a ticket flight number into the callsign planes send.
 */
export const findPlanes = async (
  text: string,
  toCallsign: (flight: string, signal?: AbortSignal) => Promise<string | null>,
  signal?: AbortSignal,
): Promise<Found | null> => {
  const query = cleanQuery(text);
  for (const kind of lookupOrder(query)) {
    const planes = await ask(`${kind}/${query}`, signal);
    if (planes.length) return { kind, query, planes };
  }
  if (looksLikeTicketFlight(query)) {
    const callsign = await toCallsign(query, signal);
    if (callsign && callsign !== query) {
      const planes = await ask(`callsign/${callsign}`, signal);
      if (planes.length) return { kind: 'callsign', query: callsign, planes };
    }
  }
  return null;
};

/** Every military aircraft being picked up right now, anywhere: one call */
export const militaryPlanes = async (signal?: AbortSignal): Promise<Found | null> => {
  const planes = await ask('mil', signal);
  return planes.length ? { kind: 'mil', query: '', planes } : null;
};

// ---- Sums

const RAD = Math.PI / 180;
const EARTH_RADIUS_NM = 3440.065;

/** A longitude brought back into -180..180 (a map dragged round the world goes past) */
export const wrapLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Great-circle distance in nautical miles */
export const distanceNm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** The longest a position is carried forward: after that it stays put until fresh data comes */
export const MAX_COAST_SECONDS = 30;

/**
 * Where a plane has got to `seconds` after its position was heard, if it kept
 * its speed and track. Between updates the map moves each plane this way, so
 * it glides instead of jumping every ten seconds. Never more than
 * MAX_COAST_SECONDS, and never for a plane on the ground.
 */
export const coast = (plane: Plane, seconds: number): { lat: number; lon: number } => {
  if (plane.onGround || plane.speedKt === null || plane.track === null || seconds <= 0) return { lat: plane.lat, lon: plane.lon };
  const nm = plane.speedKt * Math.min(seconds, MAX_COAST_SECONDS) / 3600;
  const lat = plane.lat + (nm * Math.cos(plane.track * RAD)) / 60;
  const shrink = Math.max(0.01, Math.cos(plane.lat * RAD));
  return { lat: Math.max(-90, Math.min(90, lat)), lon: plane.lon + (nm * Math.sin(plane.track * RAD)) / (60 * shrink) };
};

/** A place a plane was heard, and when (milliseconds, as Date.now() counts) */
export interface TrailPoint {
  lat: number;
  lon: number;
  at: number;
}

/** A trail starts again after a silence this long, so a gap is never drawn as a straight line the plane didn't fly */
export const TRAIL_GAP_MS = 45000;
/** The most points a trail keeps: at one every ten seconds, the last twenty minutes */
export const TRAIL_POINTS = 120;

/**
 * A plane's trail with its newest position added: where it has been heard
 * since the app began watching it, oldest first. The same position again
 * adds nothing; a silence longer than TRAIL_GAP_MS starts the trail afresh.
 */
export const extendTrail = (trail: TrailPoint[], plane: Plane, now: number): TrailPoint[] => {
  const point = { lat: plane.lat, lon: plane.lon, at: now - plane.positionAge * 1000 };
  const last = trail[trail.length - 1];
  if (!last || point.at - last.at > TRAIL_GAP_MS) return [point];
  if (point.at <= last.at || (last.lat === point.lat && last.lon === point.lon)) return trail;
  return [...trail, point].slice(-TRAIL_POINTS);
};

export interface Airport {
  code: string;
  city: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Is the plane somewhere a flight between these two airports would be? The
 * route comes from a list of what each flight number usually flies, and
 * airlines reuse numbers, so a route the plane can't be on is left out
 * rather than shown wrong (a Cleveland to San Francisco number was seen
 * landing at Newark, 2026-11-15). Three tests, all of which must pass:
 *  - on the ground, it is at one of the two airports (within 10 nm);
 *  - below 10,000 ft, it is leaving or arriving (within 150 nm of one);
 *  - going by way of the plane adds no more than 10% and 75 nm to the
 *    direct distance (room for a departure turn, a hold, an ocean track).
 * A route that passes can still be the wrong one; the app calls it "usual".
 */
export const routeFits = (
  plane: Pick<Plane, 'lat' | 'lon' | 'onGround' | 'altitudeFt'>,
  origin: Airport,
  destination: Airport,
): boolean => {
  const fromOrigin = distanceNm(origin.lat, origin.lon, plane.lat, plane.lon);
  const toDestination = distanceNm(plane.lat, plane.lon, destination.lat, destination.lon);
  const nearest = Math.min(fromOrigin, toDestination);
  if (plane.onGround) return nearest <= 10;
  if (plane.altitudeFt !== null && plane.altitudeFt < 10000 && nearest > 150) return false;
  const direct = distanceNm(origin.lat, origin.lon, destination.lat, destination.lon);
  return fromOrigin + toDestination <= direct * 1.1 + 75;
};

// ---- Words

const whole = (n: number) => Math.round(n).toLocaleString('en-US');

export const altitudeText = (plane: Plane): string =>
  plane.onGround ? 'On the ground' : plane.altitudeFt === null ? 'Unknown' : `${whole(plane.altitudeFt)} ft`;

/** US units first, as Pokémon's stats are, then what pilots use */
export const speedText = (plane: Plane): string =>
  plane.speedKt === null ? 'Unknown' : `${whole(plane.speedKt * 1.15078)} mph (${whole(plane.speedKt)} kt)`;

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export const headingText = (plane: Plane): string => {
  if (plane.track === null) return 'Unknown';
  const degrees = ((Math.round(plane.track) % 360) + 360) % 360;
  return `${POINTS[Math.round(degrees / 22.5) % 16]} (${degrees}°)`;
};

/** Under 300 ft a minute counts as level: a cruising plane's rate wobbles */
export const climbText = (plane: Plane): string => {
  if (plane.onGround) return 'On the ground';
  if (plane.climbFpm === null) return 'Unknown';
  if (Math.abs(plane.climbFpm) < 300) return 'Level';
  return `${plane.climbFpm > 0 ? 'Climbing' : 'Descending'} ${whole(Math.abs(plane.climbFpm))} ft/min`;
};

/** What to call a plane: its flight, else its tail number, else its address */
export const planeLabel = (plane: Plane): string => plane.flight || plane.registration || plane.hex.toUpperCase();

export const positionText = (lat: number, lon: number): string =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(wrapLon(lon)).toFixed(2)}°${wrapLon(lon) >= 0 ? 'E' : 'W'}`;
