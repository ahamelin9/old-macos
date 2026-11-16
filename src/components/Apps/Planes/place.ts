/**
 * The place a plane is over, in words ("New Jersey, United States"), for a
 * plane found with Find a Plane. One Nominatim reverse lookup at the level
 * of a state or province. Nominatim allows one request a second and no
 * type-ahead: this is asked only when a plane is found or its row clicked,
 * calls are spaced out, and answers are kept for the visit. The `apis`
 * skill, openstreetmap.md.
 */
export const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

/** Nominatim's words when nothing mapped is near: in practice, open sea */
const NOTHING_THERE = 'Unable to geocode';

/**
 * Nominatim's reverse reply as "Region, Country". null means nothing mapped
 * is there (the open sea); undefined means the reply wasn't one we can read.
 */
export const toPlaceName = (data: unknown): string | null | undefined => {
  const reply = (data ?? {}) as { error?: string; display_name?: string; address?: Record<string, string> };
  if (reply.error === NOTHING_THERE) return null;
  const address = reply.address;
  if (!address) return reply.display_name || undefined;
  const region = address.state ?? address.province ?? address.region ?? address.county;
  const parts = [region, address.country].filter((part, i, all) => part && all.indexOf(part) === i);
  return parts.join(', ') || reply.display_name || undefined;
};

// Kept for the visit, by spot to a tenth of a degree (about 10 km: far finer than a state)
const known = new Map<string, string | null>();
// One call at a time, at least 1.1 s after the one before
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const SPACING_MS = 1100;

/**
 * The place under a spot: its name, null for open sea, or undefined when
 * Nominatim couldn't say (down, busy, or cancelled), in which case the app
 * says nothing rather than guess.
 */
export const placeUnder = (lat: number, lon: number, signal?: AbortSignal): Promise<string | null | undefined> => {
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  if (known.has(key)) return Promise.resolve(known.get(key));
  const ask = async (): Promise<string | null | undefined> => {
    if (known.has(key)) return known.get(key);
    const wait = lastCall + SPACING_MS - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    if (signal?.aborted) return undefined;
    lastCall = Date.now();
    try {
      const timeout = AbortSignal.timeout(10000);
      const res = await fetch(`${NOMINATIM_REVERSE}?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&format=jsonv2&zoom=5&accept-language=en`,
        { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!res.ok) return undefined;
      const name = toPlaceName(await res.json());
      if (name !== undefined) known.set(key, name);
      return name;
    } catch {
      return undefined;
    }
  };
  const answer = queue.then(ask, ask);
  queue = answer;
  return answer;
};

/** For the panel and the summary: the name, or what to say over open sea */
export const overText = (name: string | null): string => name ?? 'Open sea';
