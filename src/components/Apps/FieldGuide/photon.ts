/**
 * Place type-ahead through Photon (komoot's search over OpenStreetMap data).
 * Nominatim's usage policy forbids type-ahead, so suggestions come from
 * Photon and only a pressed Search goes to Nominatim (the `apis` skill,
 * openstreetmap.md).
 */
export const PHOTON = 'https://photon.komoot.io/api/';

/** The shape the place suggestions list already uses (Nominatim's field names) */
export interface PlaceSuggestion {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/** Photon's GeoJSON features as suggestions. Coordinates come as [lng, lat]. */
export const toPlaceSuggestions = (data: unknown): PlaceSuggestion[] => {
  const features = ((data ?? {}) as { features?: PhotonFeature[] }).features ?? [];
  const out: PlaceSuggestion[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    const p = feature.properties ?? {};
    const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ');
    if (!coords || !name) continue;
    const parts: string[] = [];
    for (const part of [name, p.city, p.state, p.country]) {
      if (part && !parts.includes(part)) parts.push(part);
    }
    out.push({ name, display_name: parts.join(', '), lat: String(coords[1]), lon: String(coords[0]) });
  }
  return out;
};

export const fetchPlaceSuggestions = async (query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> => {
  const res = await fetch(`${PHOTON}?q=${encodeURIComponent(query)}&limit=4&lang=en`, { signal });
  if (!res.ok) return [];
  return toPlaceSuggestions(await res.json());
};
