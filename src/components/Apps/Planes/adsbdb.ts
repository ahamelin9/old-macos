/**
 * What adsbdb.com knows about a flight number and an airframe: the route the
 * flight usually flies, and who owns the plane. It answers browsers from any
 * site, with no key. Each answer is kept for the visit, so a plane clicked
 * twice costs one call. The `apis` skill, adsb.md.
 */
import type { Airport } from './aircraft';

export const ADSBDB = 'https://api.adsbdb.com/v0';

export interface Route {
  /** The callsign planes send for this flight (UAL188) */
  callsign: string;
  /** The number on a ticket (UA188), or '' */
  ticket: string;
  airline: string;
  origin: Airport;
  destination: Airport;
}

export interface Airframe {
  /** Maker and model as adsbdb words them ("Boeing 787 9") */
  model: string;
  owner: string;
  country: string;
}

interface RawAirport {
  iata_code?: string;
  icao_code?: string;
  municipality?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
}

const toAirport = (raw: RawAirport | undefined): Airport | null => {
  if (!raw || typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') return null;
  const code = raw.iata_code || raw.icao_code || '';
  if (!code) return null;
  return { code, city: raw.municipality ?? '', name: raw.name ?? '', lat: raw.latitude, lon: raw.longitude };
};

/** adsbdb's flight route reply; null when it has no usable route */
export const toRoute = (data: unknown): Route | null => {
  const flight = (data as { response?: { flightroute?: {
    callsign_icao?: string; callsign_iata?: string; callsign?: string;
    airline?: { name?: string }; origin?: RawAirport; destination?: RawAirport;
  } } } | null)?.response?.flightroute;
  if (!flight || typeof flight !== 'object') return null;
  const origin = toAirport(flight.origin), destination = toAirport(flight.destination);
  const callsign = flight.callsign_icao || flight.callsign || '';
  if (!origin || !destination || !callsign) return null;
  return { callsign, ticket: flight.callsign_iata ?? '', airline: flight.airline?.name ?? '', origin, destination };
};

/** adsbdb's aircraft reply; null when it doesn't know the airframe */
export const toAirframe = (data: unknown): Airframe | null => {
  const aircraft = (data as { response?: { aircraft?: {
    manufacturer?: string; type?: string; registered_owner?: string; registered_owner_country_name?: string;
  } } } | null)?.response?.aircraft;
  if (!aircraft || typeof aircraft !== 'object') return null;
  const model = [aircraft.manufacturer, aircraft.type].filter(Boolean).join(' ');
  if (!model && !aircraft.registered_owner) return null;
  return { model, owner: aircraft.registered_owner ?? '', country: aircraft.registered_owner_country_name ?? '' };
};

// Answers kept for the visit. A failed call isn't kept, so the next click tries again.
const routes = new Map<string, Route | null>();
const airframes = new Map<string, Airframe | null>();

/** Not known (adsbdb answers 404) is null; any other failure throws */
const lookUp = async <T>(path: string, read: (data: unknown) => T | null, signal?: AbortSignal): Promise<T | null> => {
  const timeout = AbortSignal.timeout(10000);
  const res = await fetch(`${ADSBDB}/${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`adsbdb answered ${res.status}`);
  return read(await res.json());
};

/** The usual route for a callsign or a ticket flight number */
export const fetchRoute = async (flight: string, signal?: AbortSignal): Promise<Route | null> => {
  if (routes.has(flight)) return routes.get(flight)!;
  const route = await lookUp(`callsign/${encodeURIComponent(flight)}`, toRoute, signal);
  routes.set(flight, route);
  return route;
};

export const fetchAirframe = async (hex: string, signal?: AbortSignal): Promise<Airframe | null> => {
  if (airframes.has(hex)) return airframes.get(hex)!;
  const airframe = await lookUp(`aircraft/${encodeURIComponent(hex)}`, toAirframe, signal);
  airframes.set(hex, airframe);
  return airframe;
};

/** The callsign planes send for a ticket flight number (UA188 → UAL188); null when adsbdb doesn't know it or can't be reached */
export const ticketToCallsign = async (flight: string, signal?: AbortSignal): Promise<string | null> => {
  try {
    return (await fetchRoute(flight, signal))?.callsign ?? null;
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return null;
  }
};
