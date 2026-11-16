/**
 * Spotter's Picks: remarkable aircraft to browse in Find a Plane. Each is an
 * ICAO type code (what adsb.lol's type lookup takes), a line about it, and
 * its Wikipedia article, which gives the card its picture. A card is looked
 * up only when clicked. Every code here was checked against adsb.lol; the
 * `apis` skill, adsb.md, says how to check a new one.
 */
export interface Pick {
  /** ICAO type code, or 'mil' for the feed of every military aircraft */
  type: string;
  name: string;
  blurb: string;
  /** The article's title on English Wikipedia */
  wiki: string;
}

export const MILITARY = 'mil';

export const PICKS: Pick[] = [
  { type: 'A388', name: 'Airbus A380', wiki: 'Airbus A380', blurb: 'The largest passenger airliner ever built: two full decks and four engines.' },
  { type: 'B748', name: 'Boeing 747-8', wiki: 'Boeing 747-8', blurb: 'The last and longest of the jumbo jets.' },
  { type: 'B744', name: 'Boeing 747-400', wiki: 'Boeing 747-400', blurb: 'The classic jumbo, with the hump and four engines.' },
  { type: 'A35K', name: 'Airbus A350-1000', wiki: 'Airbus A350', blurb: 'One of the newest long-haul jets, built largely of carbon fibre.' },
  { type: 'MD11', name: 'McDonnell Douglas MD-11', wiki: 'McDonnell Douglas MD-11', blurb: 'A three-engine freighter, with the third engine in its tail.' },
  { type: 'BLCF', name: 'Boeing Dreamlifter', wiki: 'Boeing Dreamlifter', blurb: 'A 747 with a swollen body for carrying 787 wings and fuselages. Only four exist.' },
  { type: 'A3ST', name: 'Airbus Beluga', wiki: 'Airbus Beluga', blurb: 'Airbus’s whale-shaped freighter for carrying aircraft parts.' },
  { type: 'A337', name: 'Airbus BelugaXL', wiki: 'Airbus BelugaXL', blurb: 'The bigger Beluga, painted with a smiling whale’s face.' },
  { type: 'A124', name: 'Antonov An-124', wiki: 'Antonov An-124 Ruslan', blurb: 'A giant freighter whose nose lifts open to load.' },
  { type: MILITARY, name: 'Military, right now', wiki: 'Military aircraft', blurb: 'Every military aircraft being picked up at this moment: tankers, transports, helicopters, trainers.' },
  { type: 'C17', name: 'C-17 Globemaster III', wiki: 'Boeing C-17 Globemaster III', blurb: 'A four-engine military airlifter that can use short, rough runways.' },
  { type: 'C5M', name: 'C-5M Super Galaxy', wiki: 'Lockheed C-5 Galaxy', blurb: 'The largest aircraft in the US Air Force.' },
  { type: 'K35R', name: 'KC-135 Stratotanker', wiki: 'Boeing KC-135 Stratotanker', blurb: 'A flying fuel station: it refuels other aircraft in mid-air.' },
  { type: 'B52', name: 'B-52 Stratofortress', wiki: 'Boeing B-52 Stratofortress', blurb: 'A bomber that first flew in 1952 and is still in service.' },
  { type: 'U2', name: 'Lockheed U-2', wiki: 'Lockheed U-2', blurb: 'A spy plane that cruises above 70,000 feet, about twice as high as an airliner.' },
  { type: 'V22', name: 'V-22 Osprey', wiki: 'Bell–Boeing V-22 Osprey', blurb: 'Takes off like a helicopter, then tilts its rotors forward and flies like a plane.' },
  { type: 'H47', name: 'CH-47 Chinook', wiki: 'Boeing CH-47 Chinook', blurb: 'A heavy-lift helicopter with two rotors, one at each end.' },
  { type: 'C130', name: 'C-130 Hercules', wiki: 'Lockheed C-130 Hercules', blurb: 'A four-propeller transport, in production since the 1950s.' },
  { type: 'A400', name: 'Airbus A400M Atlas', wiki: 'Airbus A400M Atlas', blurb: 'Europe’s military transport, with four eight-bladed propellers.' },
  { type: 'SPIT', name: 'Supermarine Spitfire', wiki: 'Supermarine Spitfire', blurb: 'The Second World War fighter. Some still fly at air shows.' },
  { type: 'P51', name: 'P-51 Mustang', wiki: 'North American P-51 Mustang', blurb: 'An American Second World War fighter, still a favourite at air shows.' },
  { type: 'DC3', name: 'Douglas DC-3', wiki: 'Douglas DC-3', blurb: 'An airliner from the 1930s that is still working.' },
  { type: 'C172', name: 'Cessna 172', wiki: 'Cessna 172', blurb: 'The most-built aircraft in history, and the one many pilots learn in.' },
  { type: 'DHC6', name: 'DHC-6 Twin Otter', wiki: 'De Havilland Canada DHC-6 Twin Otter', blurb: 'A tough little twin that lands on short strips, floats or skis.' },
  { type: 'CL2T', name: 'Canadair CL-415', wiki: 'Canadair CL-415', blurb: 'A water bomber that scoops up lake water to fight wildfires.' },
  { type: 'GLF6', name: 'Gulfstream G650', wiki: 'Gulfstream G650/G700/G800', blurb: 'A long-range private jet that cruises close to the speed of sound.' },
  { type: 'SHIP', name: 'Airships', wiki: 'Blimp', blurb: 'Blimps and other airships. There are only a handful in the world.' },
];

export const wikiLink = (pick: Pick): string => `https://en.wikipedia.org/wiki/${encodeURIComponent(pick.wiki.replace(/ /g, '_'))}`;

export interface PickImage {
  src: string;
  width: number;
  height: number;
}

interface WikiReply {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title?: string; thumbnail?: { source?: string; width?: number; height?: number } }>;
  };
}

/** Wikipedia's page-images reply as pictures by the title that was asked for (following its renames and redirects) */
export const toPickImages = (data: unknown, titles: string[]): Record<string, PickImage> => {
  const query = ((data ?? {}) as WikiReply).query ?? {};
  const byTitle = new Map<string, PickImage>();
  for (const page of Object.values(query.pages ?? {})) {
    const t = page.thumbnail;
    if (page.title && t?.source?.startsWith('https://')) byTitle.set(page.title, { src: t.source, width: t.width ?? 330, height: t.height ?? 220 });
  }
  const moved = new Map<string, string>();
  for (const step of [...(query.normalized ?? []), ...(query.redirects ?? [])]) moved.set(step.from, step.to);
  const images: Record<string, PickImage> = {};
  for (const title of titles) {
    let now = title;
    for (let hops = 0; hops < 3 && moved.has(now); hops++) now = moved.get(now)!;
    const image = byTitle.get(now);
    if (image) images[title] = image;
  }
  return images;
};

let images: Promise<Record<string, PickImage>> | null = null;

/** Every card's picture in one Wikipedia call, asked once a visit. A failure gives no pictures and is tried again next time. */
export const fetchPickImages = (): Promise<Record<string, PickImage>> => {
  images ??= (async () => {
    const titles = [...new Set(PICKS.map(pick => pick.wiki))];
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=330&pilimit=max'
      + `&titles=${encodeURIComponent(titles.join('|'))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
    return toPickImages(await res.json(), titles);
  })().catch(() => {
    images = null;
    return {};
  });
  return images;
};
