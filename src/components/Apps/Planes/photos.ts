/**
 * A photo of one airframe, from planespotters.net's public photo API. It
 * answers browsers from any site, with no key. Their terms: show the
 * thumbnail they send (never a copy), make it a link to its page on
 * planespotters.net, and credit the photographer beside it. Each answer is
 * kept for the visit. The `apis` skill, adsb.md.
 */
export const PLANESPOTTERS = 'https://api.planespotters.net/pub/photos/hex';

export interface PlanePhoto {
  src: string;
  width: number;
  height: number;
  /** The photo's page on planespotters.net: the picture must link there */
  link: string;
  photographer: string;
}

interface RawPhoto {
  thumbnail?: { src?: string; size?: { width?: number; height?: number } };
  thumbnail_large?: { src?: string; size?: { width?: number; height?: number } };
  link?: string;
  photographer?: string;
}

/** The first photo in a reply; null when there is none, or it lacks the link or the credit the terms require */
export const toPhoto = (data: unknown): PlanePhoto | null => {
  const photo = ((data ?? {}) as { photos?: RawPhoto[] }).photos?.[0];
  const picture = photo?.thumbnail_large ?? photo?.thumbnail;
  if (!photo || !picture?.src || !photo.link || !photo.photographer) return null;
  // Only https pictures, and only links back to planespotters itself
  if (!picture.src.startsWith('https://') || !/^https:\/\/(www\.)?planespotters\.net\//.test(photo.link)) return null;
  return { src: picture.src, width: picture.size?.width ?? 420, height: picture.size?.height ?? 280, link: photo.link, photographer: photo.photographer };
};

// Kept for the visit. A failed call isn't kept, so the next click tries again.
const photos = new Map<string, PlanePhoto | null>();

/** The airframe's photo, or null when planespotters has none. Throws when it can't be reached. */
export const fetchPhoto = async (hex: string, signal?: AbortSignal): Promise<PlanePhoto | null> => {
  if (photos.has(hex)) return photos.get(hex)!;
  const timeout = AbortSignal.timeout(10000);
  const res = await fetch(`${PLANESPOTTERS}/${encodeURIComponent(hex)}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`planespotters answered ${res.status}`);
  const photo = toPhoto(await res.json());
  photos.set(hex, photo);
  return photo;
};
