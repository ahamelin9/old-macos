import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  altitudeText, cleanQuery, climbText, coast, distanceNm, extendTrail, findPlanes, headingText, lookupOrder, looksLikeTicketFlight,
  nearPath, planeLabel, planesNear, PlanesError, positionText, routeFits, speedText, toPlanes, wrapLon, type Airport, type Plane,
} from './aircraft';
import { toAirframe, toRoute } from './adsbdb';
import { overText, toPlaceName } from './place';
import { kindOf } from './shapes';
import { toPhoto } from './photos';
import { MILITARY, PICKS, toPickImages, wikiLink } from './picks';

// A real adsb.lol entry (2026-11-15), trimmed to the fields the app reads
const UAL188 = {
  hex: 'a254dd', type: 'adsb_icao', flight: 'UAL188  ', r: 'N24979', t: 'B789', category: 'A5', alt_baro: 10550, alt_geom: 10525,
  gs: 338.7, track: 158.89, baro_rate: 1300, squawk: '1165', lat: 40.513092, lon: -74.261292, seen_pos: 0.178,
};

const plane = (over: Partial<Plane> = {}): Plane => ({ ...toPlanes({ ac: [UAL188] })[0], ...over });

describe('toPlanes', () => {
  it('reads an aircraft, trimming the padded callsign', () => {
    expect(toPlanes({ ac: [UAL188] })).toEqual([{
      hex: 'a254dd', flight: 'UAL188', registration: 'N24979', type: 'B789', category: 'A5', lat: 40.513092, lon: -74.261292,
      altitudeFt: 10550, onGround: false, speedKt: 338.7, track: 158.89, climbFpm: 1300, squawk: '1165', positionAge: 0.178,
    }]);
  });

  it('knows "ground" from an altitude', () => {
    const [taxiing] = toPlanes({ ac: [{ ...UAL188, alt_baro: 'ground' }] });
    expect(taxiing.onGround).toBe(true);
    expect(taxiing.altitudeFt).toBeNull();
  });

  it('leaves out an aircraft with no position, and fills in what is missing', () => {
    expect(toPlanes({ ac: [{ hex: 'abc123', flight: 'NOPOS' }] })).toEqual([]);
    const [bare] = toPlanes({ ac: [{ hex: 'abc123', lat: 1, lon: 2 }] });
    expect(bare).toMatchObject({ flight: '', registration: '', type: '', category: '', altitudeFt: null, speedKt: null, track: null, climbFpm: null });
  });

  it('takes a callsign of filler for none (a military aircraft sent "@@@@@@@@", 2026-11-16)', () => {
    expect(toPlanes({ ac: [{ ...UAL188, flight: '@@@@@@@@' }] })[0].flight).toBe('');
  });

  it('gives no planes for a reply that is not one', () => {
    for (const junk of [null, undefined, 'radius exceeds 250 NM', {}, { ac: 'no' }]) expect(toPlanes(junk)).toEqual([]);
  });
});

describe('nearPath', () => {
  it('rounds the spot, and keeps the radius whole and within what adsb.lol allows', () => {
    expect(nearPath(40.64123, -73.77999, 24.2)).toBe('point/40.64/-73.78/25');
    expect(nearPath(0, 0, 900)).toBe('point/0.00/0.00/250');
    expect(nearPath(0, 0, 0)).toBe('point/0.00/0.00/1');
  });

  it('brings a longitude from a map dragged round the world back in range', () => {
    expect(nearPath(35, 190, 50)).toBe('point/35.00/-170.00/50');
    expect(wrapLon(-200)).toBe(160);
    expect(wrapLon(180)).toBe(-180);
  });
});

describe('looking a plane up', () => {
  it('cleans what was typed', () => {
    expect(cleanQuery(' ual 188 ')).toBe('UAL188');
    expect(cleanQuery('g-xlea')).toBe('G-XLEA');
    expect(cleanQuery('../hex/abc')).toBe('HEXABC');
  });

  it('orders the lookups by what the text looks like', () => {
    expect(lookupOrder('A388')).toEqual(['type', 'callsign', 'reg']);
    expect(lookupOrder('UAL188')).toEqual(['callsign', 'reg']);
    expect(lookupOrder('G-XLEA')).toEqual(['reg']);
    expect(lookupOrder('A')).toEqual([]);
    expect(lookupOrder('ABCDEFGHIJK')).toEqual([]);
  });

  it('spots a ticket flight number', () => {
    for (const yes of ['UA188', 'BA9', 'U21234', '4U9', 'BA117A']) expect(looksLikeTicketFlight(yes)).toBe(true);
    for (const no of ['UAL188', 'G-XLEA', 'N123AB']) expect(looksLikeTicketFlight(no)).toBe(false);
    // A US tail number of a letter and digits reads as one too (airline "N2", flight 4979), and so does a type
    // like A388. The translation is only tried after every other lookup found nothing, so it costs one call at most.
    for (const either of ['N24979', 'A388']) expect(looksLikeTicketFlight(either)).toBe(true);
  });

  describe('findPlanes', () => {
    afterEach(() => vi.unstubAllGlobals());
    const reply = (ac: unknown[], status = 200) => new Response(JSON.stringify({ ac }), { status });
    const stub = (answers: Record<string, unknown[]>) => {
      const asked: string[] = [];
      vi.stubGlobal('fetch', vi.fn(async (url: string) => { asked.push(url); return reply(answers[url] ?? []); }));
      return asked;
    };
    const never = async () => null;

    it('stops at the first lookup that finds any', async () => {
      const asked = stub({ '/api/planes/v2/callsign/A388': [UAL188] });
      const found = await findPlanes('a388', never);
      expect(found).toMatchObject({ kind: 'callsign', query: 'A388' });
      expect(asked).toEqual(['/api/planes/v2/type/A388', '/api/planes/v2/callsign/A388']);
    });

    it('translates a ticket number when nothing sends it as a callsign', async () => {
      const asked = stub({ '/api/planes/v2/callsign/UAL188': [UAL188] });
      const found = await findPlanes('UA188', async flight => (flight === 'UA188' ? 'UAL188' : null));
      expect(found).toMatchObject({ kind: 'callsign', query: 'UAL188' });
      expect(asked).toEqual(['/api/planes/v2/callsign/UA188', '/api/planes/v2/reg/UA188', '/api/planes/v2/callsign/UAL188']);
    });

    it('is null when nothing matches, and asks nothing for text too short', async () => {
      const asked = stub({});
      expect(await findPlanes('ZZZ9999', never)).toBeNull();
      expect(asked).toHaveLength(2);
      expect(await findPlanes('z', never)).toBeNull();
      expect(asked).toHaveLength(2);
    });

    it('says the service is busy on a 429, and not answering on a 502', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => reply([], 429)));
      await expect(planesNear(40, -74, 20)).rejects.toThrow(/busy/);
      vi.stubGlobal('fetch', vi.fn(async () => reply([], 502)));
      await expect(planesNear(40, -74, 20)).rejects.toThrow(PlanesError);
    });

    it('says it could not reach the data when the network fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
      await expect(planesNear(40, -74, 20)).rejects.toThrow(/reach/);
    });
  });
});

describe('sums', () => {
  const JFK: Airport = { code: 'JFK', city: 'New York', name: 'John F Kennedy', lat: 40.6398, lon: -73.7789 };
  const LHR: Airport = { code: 'LHR', city: 'London', name: 'Heathrow', lat: 51.4706, lon: -0.4619 };

  it('measures JFK to Heathrow as about 2,990 nautical miles', () => {
    expect(distanceNm(JFK.lat, JFK.lon, LHR.lat, LHR.lon)).toBeGreaterThan(2975);
    expect(distanceNm(JFK.lat, JFK.lon, LHR.lat, LHR.lon)).toBeLessThan(3005);
  });

  it('carries a plane forward along its track', () => {
    // 360 kt due north for 10 s is one nautical mile: a sixtieth of a degree
    const north = coast(plane({ lat: 40, lon: -74, speedKt: 360, track: 0 }), 10);
    expect(north.lat).toBeCloseTo(40 + 1 / 60, 6);
    expect(north.lon).toBeCloseTo(-74, 6);
    // Due east, a degree of longitude is shorter by cos(latitude)
    const east = coast(plane({ lat: 60, lon: 10, speedKt: 360, track: 90 }), 10);
    expect(east.lat).toBeCloseTo(60, 6);
    expect(east.lon).toBeCloseTo(10 + 1 / 60 / Math.cos(Math.PI / 3), 6);
  });

  it('stops carrying it after 30 seconds, and never moves one on the ground or with no track', () => {
    const fast = plane({ lat: 0, lon: 0, speedKt: 360, track: 0 });
    expect(coast(fast, 600)).toEqual(coast(fast, 30));
    expect(coast(plane({ onGround: true }), 10)).toEqual({ lat: UAL188.lat, lon: UAL188.lon });
    expect(coast(plane({ track: null }), 10)).toEqual({ lat: UAL188.lat, lon: UAL188.lon });
    expect(coast(fast, -5)).toEqual({ lat: 0, lon: 0 });
  });

  describe('routeFits', () => {
    const CLE: Airport = { code: 'CLE', city: 'Cleveland', name: 'Hopkins', lat: 41.4117, lon: -81.8498 };
    const SFO: Airport = { code: 'SFO', city: 'San Francisco', name: 'San Francisco', lat: 37.619, lon: -122.375 };
    const at = (lat: number, lon: number, altitudeFt: number | null = 36000, onGround = false) => ({ lat, lon, altitudeFt, onGround });

    it('keeps a route the plane is on', () => {
      expect(routeFits(at(50, -40), JFK, LHR)).toBe(true);            // mid-Atlantic, cruising
      expect(routeFits(at(40.7, -73.6, 3000), JFK, LHR)).toBe(true);  // climbing out of JFK
      expect(routeFits(at(51.3, -0.2, 7000), JFK, LHR)).toBe(true);   // in the hold for Heathrow
      expect(routeFits(at(40.64, -73.78, null, true), JFK, LHR)).toBe(true); // at the gate
    });

    it('drops one the plane is nowhere near', () => {
      expect(routeFits(at(35.5, 139.8), JFK, LHR)).toBe(false);       // Tokyo
      expect(routeFits(at(25.8, -80.3), JFK, LHR)).toBe(false);       // Miami
    });

    it('drops the Cleveland to San Francisco number seen landing at Newark', () => {
      // UAL2811 at 2,675 ft over New Jersey, 2026-11-15: 350 nm behind Cleveland, not between the two
      expect(routeFits(at(40.54, -74.5, 2675), CLE, SFO)).toBe(false);
      // and the same spot at cruise is too far off the line as well
      expect(routeFits(at(40.54, -74.5, 36000), CLE, SFO)).toBe(false);
    });

    it('drops a route for a plane low down or parked far from both airports', () => {
      expect(routeFits(at(39.8, -98.6, 4000), CLE, SFO)).toBe(false);        // low over Kansas, on the line
      expect(routeFits(at(39.8, -98.6, 36000), CLE, SFO)).toBe(true);        // the same spot at cruise
      expect(routeFits(at(40.69, -74.17, null, true), CLE, SFO)).toBe(false); // parked at Newark
    });
  });
});

describe('words', () => {
  it('writes altitude, speed, heading and climb', () => {
    const p = plane();
    expect(altitudeText(p)).toBe('10,550 ft');
    expect(speedText(p)).toBe('390 mph (339 kt)');
    expect(headingText(p)).toBe('SSE (159°)');
    expect(climbText(p)).toBe('Climbing 1,300 ft/min');
  });

  it('writes the other cases', () => {
    expect(altitudeText(plane({ onGround: true, altitudeFt: null }))).toBe('On the ground');
    expect(altitudeText(plane({ altitudeFt: null }))).toBe('Unknown');
    expect(climbText(plane({ climbFpm: -64 }))).toBe('Level');
    expect(climbText(plane({ climbFpm: -1800 }))).toBe('Descending 1,800 ft/min');
    expect(headingText(plane({ track: 359.8 }))).toBe('N (0°)');
    expect(headingText(plane({ track: null }))).toBe('Unknown');
    expect(speedText(plane({ speedKt: null }))).toBe('Unknown');
  });

  it('names a plane by its flight, then its tail number, then its address', () => {
    expect(planeLabel(plane())).toBe('UAL188');
    expect(planeLabel(plane({ flight: '' }))).toBe('N24979');
    expect(planeLabel(plane({ flight: '', registration: '' }))).toBe('A254DD');
  });

  it('writes a position with its hemispheres', () => {
    expect(positionText(40.513, -74.261)).toBe('40.51°N, 74.26°W');
    expect(positionText(-33.9, 151.2)).toBe('33.90°S, 151.20°E');
  });
});

describe('adsbdb replies', () => {
  // A real reply (2026-11-15), trimmed
  const flightroute = {
    callsign: 'UAL188', callsign_icao: 'UAL188', callsign_iata: 'UA188', airline: { name: 'United Airlines' },
    origin: { iata_code: 'EWR', icao_code: 'KEWR', latitude: 40.6925, longitude: -74.1687, municipality: 'New York', name: 'Newark Liberty International Airport' },
    destination: { iata_code: 'JNB', icao_code: 'FAOR', latitude: -26.1392, longitude: 28.246, municipality: 'Johannesburg', name: 'OR Tambo International Airport' },
  };

  it('reads a route', () => {
    expect(toRoute({ response: { flightroute } })).toEqual({
      callsign: 'UAL188', ticket: 'UA188', airline: 'United Airlines',
      origin: { code: 'EWR', city: 'New York', name: 'Newark Liberty International Airport', lat: 40.6925, lon: -74.1687 },
      destination: { code: 'JNB', city: 'Johannesburg', name: 'OR Tambo International Airport', lat: -26.1392, lon: 28.246 },
    });
  });

  it('has no route when an end is missing, or the reply is an error', () => {
    expect(toRoute({ response: { flightroute: { ...flightroute, destination: undefined } } })).toBeNull();
    expect(toRoute({ response: 'unknown callsign' })).toBeNull();
    expect(toRoute(null)).toBeNull();
  });

  it('reads an airframe', () => {
    expect(toAirframe({ response: { aircraft: { type: '787 9', manufacturer: 'Boeing', registered_owner: 'United Airlines', registered_owner_country_name: 'United States' } } }))
      .toEqual({ model: 'Boeing 787 9', owner: 'United Airlines', country: 'United States' });
    expect(toAirframe({ response: 'unknown aircraft' })).toBeNull();
  });
});

describe('the place a plane is over', () => {
  // Real Nominatim replies (zoom 5, 2026-11-15), trimmed
  it('names the state or province and the country', () => {
    expect(toPlaceName({ display_name: 'New Jersey, United States', address: { state: 'New Jersey', country: 'United States', country_code: 'us' } })).toBe('New Jersey, United States');
    expect(toPlaceName({ display_name: 'Kyoto Prefecture, Japan', address: { province: 'Kyoto Prefecture', country: 'Japan' } })).toBe('Kyoto Prefecture, Japan');
  });

  it('names a country alone, once', () => {
    expect(toPlaceName({ address: { country: 'Iceland' } })).toBe('Iceland');
    expect(toPlaceName({ address: { state: 'Singapore', country: 'Singapore' } })).toBe('Singapore');
  });

  it('knows the open sea from a reply it cannot read', () => {
    expect(toPlaceName({ error: 'Unable to geocode' })).toBeNull();
    expect(overText(null)).toBe('Open sea');
    expect(toPlaceName({ error: 'Something else' })).toBeUndefined();
    expect(toPlaceName(null)).toBeUndefined();
  });
});

describe('the shape a plane is drawn with', () => {
  const kind = (type: string, category = '') => kindOf({ type, category });

  it('goes by the type when it is one we know', () => {
    expect(kind('A388', 'A5')).toBe('four');
    expect(kind('C17')).toBe('four');
    expect(kind('DH8D', 'A3')).toBe('prop');
    expect(kind('AT76')).toBe('prop');
  });

  it('goes by the size category otherwise', () => {
    expect(kind('C172', 'A1')).toBe('light');
    expect(kind('GLID', 'B1')).toBe('light');
    expect(kind('CL60', 'A2')).toBe('jet');
    expect(kind('A21N', 'A3')).toBe('jet');
    expect(kind('B752', 'A4')).toBe('heavy');
    expect(kind('B789', 'A5')).toBe('heavy');
  });

  it('draws a rotorcraft as a helicopter whatever its type, and an unknown as a jet', () => {
    expect(kind('EC30', 'A7')).toBe('helicopter');
    expect(kind('V22', 'A7')).toBe('helicopter');
    expect(kind('', '')).toBe('jet');
  });
});

describe('a plane\'s photo', () => {
  // A real planespotters reply (2026-11-15)
  const photo = {
    id: '2004988',
    thumbnail: { src: 'https://t.plnspttrs.net/20214/2004988_9afd0002a2_t.jpg', size: { width: 200, height: 133 } },
    thumbnail_large: { src: 'https://t.plnspttrs.net/20214/2004988_9afd0002a2_280.jpg', size: { width: 420, height: 280 } },
    link: 'https://www.planespotters.net/photo/2004988/n24979-united-airlines-boeing-787-9-dreamliner?utm_source=api',
    photographer: 'OMGcat',
  };

  it('takes the larger thumbnail, its page and its photographer', () => {
    expect(toPhoto({ photos: [photo] })).toEqual({ src: photo.thumbnail_large.src, width: 420, height: 280, link: photo.link, photographer: 'OMGcat' });
  });

  it('is null when there is no photo, or one without the credit or the link the terms require', () => {
    expect(toPhoto({ photos: [] })).toBeNull();
    expect(toPhoto(null)).toBeNull();
    expect(toPhoto({ photos: [{ ...photo, photographer: undefined }] })).toBeNull();
    expect(toPhoto({ photos: [{ ...photo, link: 'https://example.com/photo' }] })).toBeNull();
    expect(toPhoto({ photos: [{ ...photo, thumbnail: { src: 'http://t.plnspttrs.net/x.jpg' }, thumbnail_large: undefined }] })).toBeNull();
  });
});

describe('Spotter\'s Picks', () => {
  it('has a type code the lookup accepts, a name, a line and an article for each, with no code twice', () => {
    for (const pick of PICKS) {
      expect(pick.type === MILITARY || /^[A-Z0-9]{2,4}$/.test(pick.type), pick.type).toBe(true);
      expect(pick.name && pick.blurb && pick.wiki, pick.type).toBeTruthy();
    }
    expect(new Set(PICKS.map(p => p.type)).size).toBe(PICKS.length);
  });

  it('links to the article', () => {
    expect(wikiLink(PICKS.find(p => p.type === 'V22')!)).toBe('https://en.wikipedia.org/wiki/Bell%E2%80%93Boeing_V-22_Osprey');
  });

  it('reads Wikipedia\'s pictures by the title asked for, following a redirect', () => {
    const reply = { query: {
      redirects: [{ from: 'Gulfstream G650', to: 'Gulfstream G650/G700/G800' }],
      pages: {
        1: { title: 'Gulfstream G650/G700/G800', thumbnail: { source: 'https://thumb.wikimedia.org/g650.jpg', width: 330, height: 210 } },
        2: { title: 'Airbus A380', thumbnail: { source: 'https://thumb.wikimedia.org/a380.jpg', width: 330, height: 220 } },
        3: { title: 'No Picture' },
      },
    } };
    expect(toPickImages(reply, ['Gulfstream G650', 'Airbus A380', 'No Picture', 'Not There'])).toEqual({
      'Gulfstream G650': { src: 'https://thumb.wikimedia.org/g650.jpg', width: 330, height: 210 },
      'Airbus A380': { src: 'https://thumb.wikimedia.org/a380.jpg', width: 330, height: 220 },
    });
    expect(toPickImages(null, ['Airbus A380'])).toEqual({});
  });
});

describe('a plane\'s trail', () => {
  const T0 = 1_800_000_000_000;
  const at = (lat: number, positionAge = 0) => plane({ lat, lon: -74, positionAge });

  it('grows by each new position, timed by when the position was heard', () => {
    let trail = extendTrail([], at(40, 2), T0);
    expect(trail).toEqual([{ lat: 40, lon: -74, at: T0 - 2000 }]);
    trail = extendTrail(trail, at(40.01), T0 + 10000);
    expect(trail.map(p => p.lat)).toEqual([40, 40.01]);
  });

  it('adds nothing for the same position again, or an older one', () => {
    const trail = extendTrail([], at(40), T0);
    expect(extendTrail(trail, at(40), T0 + 10000)).toBe(trail);
    expect(extendTrail(trail, at(40.01, 30), T0 + 10000)).toBe(trail);
  });

  it('starts afresh after a silence, so the gap is never drawn', () => {
    const trail = extendTrail(extendTrail([], at(40), T0), at(40.01), T0 + 10000);
    expect(extendTrail(trail, at(41), T0 + 70000)).toEqual([{ lat: 41, lon: -74, at: T0 + 70000 }]);
  });

  it('keeps the newest 120 points', () => {
    let trail = extendTrail([], at(0), T0);
    for (let i = 1; i <= 150; i++) trail = extendTrail(trail, at(i / 1000), T0 + i * 10000);
    expect(trail).toHaveLength(120);
    expect(trail.at(-1)!.lat).toBe(0.15);
  });
});
