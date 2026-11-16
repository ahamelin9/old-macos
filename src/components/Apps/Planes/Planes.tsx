// Planes: the aircraft in the sky over a place, live, and a lookup for any
// flight, tail number or aircraft type anywhere in the world. Positions come
// from adsb.lol through /api/planes (aircraft.ts); routes and owners from
// adsbdb (adsbdb.ts); the map and place search are OpenStreetMap's, as in
// Field Guide. The `apis` skill, adsb.md.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOwnWindow } from '../../../contexts/useWindows';
import LoadingImage from '../../Kit/LoadingImage';
import { OSM_CREDIT, OSM_TILES } from '../FieldGuide/osm';
import { PHOTON, toPlaceSuggestions, type PlaceSuggestion } from '../FieldGuide/photon';
import {
  altitudeText, climbText, coast, distanceNm, extendTrail, findPlanes, headingText, MAX_RADIUS_NM, militaryPlanes, planeLabel, planesNear, PlanesError,
  positionText, routeFits, speedText, type Found, type Plane, type TrailPoint,
} from './aircraft';
import { fetchAirframe, fetchRoute, ticketToCallsign, type Airframe, type Route } from './adsbdb';
import { overText, placeUnder } from './place';
import { kindOf, SHAPES, type Kind } from './shapes';
import { fetchPhoto, type PlanePhoto } from './photos';
import { fetchPickImages, MILITARY, PICKS, wikiLink, type Pick, type PickImage } from './picks';
import { planeIcon } from './marker';
import { fetchTypeInfo, type TypeInfo } from './typeInfo';
import WorldMap, { MOST_ON_MAP } from './WorldMap';
import './Planes.css';

/** Where the map is when the visitor's own location isn't to be had: New York, three busy airports in one view */
const HOME = { lat: 40.71, lon: -74.01, zoom: 9 };
/** How often the planes are asked for again while the map is showing */
const REFRESH_MS = 10000;
/** A typed place waits this long for the next key before asking Photon */
const TYPING_MS = 400;
/** The most rows the Find list draws (every Boeing 737 in the air is thousands) */
const MOST_ROWS = 100;

type Tab = 'map' | 'find';

/** The filter's buttons, smallest aircraft first, with the name each kind goes by */
const KINDS: [Kind, string][] = [
  ['light', 'Light planes'], ['helicopter', 'Helicopters'], ['prop', 'Turboprops'],
  ['jet', 'Jets'], ['heavy', 'Wide-body jets'], ['four', 'Four-engine giants'],
];

/** Airline flights send three letters and a number (UAL188); a private plane sends its tail number, which has no route */
const hasRoute = (flight: string) => /^[A-Z]{3}\d/.test(flight);

const Planes: React.FC = () => {
  const { minimized } = useOwnWindow();
  const [tab, setTab] = useState<Tab>('map');

  // ---- The map
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, { marker: L.Marker; track: number; onGround: boolean; kind: Kind }>());
  /** The latest planes and when they arrived, for moving them between updates */
  const latestRef = useRef<{ planes: Plane[]; at: number }>({ planes: [], at: 0 });
  /** Where each plane in view has been heard since the app began watching it (aircraft.ts, extendTrail) */
  const trailsRef = useRef(new Map<string, TrailPoint[]>());
  /** The chosen plane's trail, drawn on the map */
  const trailLineRef = useRef<L.Polyline | null>(null);
  const [planes, setPlanes] = useState<Plane[] | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tooWide, setTooWide] = useState(false);
  const [selected, setSelected] = useState<Plane | null>(null);
  /** False only while a visitor who has already allowed location waits for it, so the first planes asked for are their own */
  const [placed, setPlaced] = useState(false);
  /** The kinds of aircraft hidden from the map (shapes.ts) */
  const [hidden, setHidden] = useState<ReadonlySet<Kind>>(new Set());

  // ---- The place box
  const [place, setPlace] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const typingRef = useRef<number | undefined>(undefined);
  const placeRequestRef = useRef<AbortController | null>(null);

  // ---- Find a plane
  const [findText, setFindText] = useState('');
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [findNote, setFindNote] = useState<string | null>(null);
  const findRequestRef = useRef<AbortController | null>(null);

  // ---- What adsbdb knows, by airframe and by flight (undefined: not asked or not back yet)
  const [airframes, setAirframes] = useState<Record<string, Airframe | null>>({});
  const [routes, setRoutes] = useState<Record<string, Route | null>>({});
  // A photo of the chosen airframe, from planespotters (photos.ts)
  const [photos, setPhotos] = useState<Record<string, PlanePhoto | null>>({});
  // Spotter's Picks: the card being looked at, and every card's picture (picks.ts)
  const [pick, setPick] = useState<Pick | null>(null);
  const [pickImages, setPickImages] = useState<Record<string, PickImage> | null>(null);
  // What each opened card's page says about its aircraft, by article (typeInfo.ts). null: couldn't be fetched.
  const [typeInfos, setTypeInfos] = useState<Record<string, TypeInfo | null>>({});

  // The place a found plane is over, by airframe (place.ts). Only planes found with Find a Plane are looked up.
  const [overs, setOvers] = useState<Record<string, string | null>>({});
  const nameWhereItIs = useCallback((plane: Plane, signal?: AbortSignal) => {
    placeUnder(plane.lat, plane.lon, signal).then(name => {
      if (name !== undefined && !signal?.aborted) setOvers(known => ({ ...known, [plane.hex]: name }));
    });
  }, []);

  const selectedRef = useRef<Plane | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const locate = useCallback((quiet = false) => {
    if (!navigator.geolocation) {
      if (!quiet) setPlaceNote('This browser can’t share a location.');
      return;
    }
    if (!quiet) { setLocating(true); setPlaceNote(null); }
    navigator.geolocation.getCurrentPosition(
      position => {
        setPlaced(true);
        setLocating(false);
        setPlace('');
        setSuggestions([]);
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 10);
      },
      error => {
        setPlaced(true);
        setLocating(false);
        if (quiet) return;
        setPlaceNote(error.code === error.PERMISSION_DENIED
          ? 'Location is switched off for this site. Search for a place instead.'
          : 'Couldn’t find where you are. Search for a place instead.');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // The map itself, once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const markers = markersRef.current;
    const map = L.map(canvas, {
      center: [HOME.lat, HOME.lon],
      zoom: HOME.zoom,
      minZoom: 4,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
    });
    // The credits OpenStreetMap's tile policy and adsb.lol's licence ask for
    const credit = L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
    L.tileLayer(OSM_TILES, { maxZoom: 18, attribution: OSM_CREDIT }).addTo(map);
    credit.addAttribution('Planes: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a>');
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    // Leaflet only watches the browser window; this map changes size with the app's window
    const resizeObserver = new ResizeObserver(() => {
      if (canvas.clientWidth > 0) map.invalidateSize();
    });
    resizeObserver.observe(canvas);

    // The map opens over the visitor's own sky ("what just flew over?"), so
    // opening asks the browser for their location, quietly: no, or no answer,
    // leaves the map over New York with nothing said. Someone who has already
    // said yes isn't shown New York first: the map waits for their position,
    // three seconds at most.
    let closed = false;
    const giveUp = window.setTimeout(() => setPlaced(true), 3000);
    const start = (known: boolean) => {
      if (closed) return;
      if (!known) setPlaced(true);
      locate(true);
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(status => start(status.state === 'granted'), () => start(false));
    } else {
      start(false);
    }

    return () => {
      closed = true;
      window.clearTimeout(giveUp);
      resizeObserver.disconnect();
      markers.clear();
      trailLineRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [locate]);

  // Asking for planes: when the map shows, every REFRESH_MS, and after the
  // map moves. Not while the window is minimized, Find is in front, the
  // browser tab is hidden, or the map is waiting to hear where the visitor is. A newer request cancels an older one.
  const watching = tab === 'map' && !minimized && placed;
  useEffect(() => {
    const map = mapRef.current;
    if (!watching || !map) return;
    let timer: number | undefined;
    let request: AbortController | null = null;
    let stopped = false;

    const load = async () => {
      request?.abort();
      if (document.hidden) return;
      const mine = request = new AbortController();
      const centre = map.getCenter(), corner = map.getBounds().getNorthEast();
      const radius = distanceNm(centre.lat, centre.lng, corner.lat, corner.lng);
      try {
        const list = await planesNear(centre.lat, centre.lng, radius, mine.signal);
        if (mine.signal.aborted) return;
        latestRef.current = { planes: list, at: performance.now() };
        // Each plane's trail grows; one no longer heard here is forgotten, unless it is the chosen one
        const trails = trailsRef.current, heard = new Set(list.map(p => p.hex)), now = Date.now();
        for (const hex of trails.keys()) if (!heard.has(hex) && hex !== selectedRef.current?.hex) trails.delete(hex);
        for (const plane of list) trails.set(plane.hex, extendTrail(trails.get(plane.hex) ?? [], plane, now));
        setPlanes(list);
        setMapError(null);
        setTooWide(radius > MAX_RADIUS_NM);
        setSelected(current => (current && list.find(p => p.hex === current.hex)) || current);
      } catch (error) {
        if (mine.signal.aborted) return;
        setMapError(error instanceof PlanesError ? error.message : 'Something went wrong loading the planes.');
      }
      if (!stopped) timer = window.setTimeout(load, REFRESH_MS);
    };
    const soon = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, ms);
    };
    const onMove = () => soon(500);
    const onVisible = () => { if (!document.hidden) soon(0); };

    map.on('moveend', onMove);
    document.addEventListener('visibilitychange', onVisible);
    soon(0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      request?.abort();
      map.off('moveend', onMove);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [watching]);

  // Every plane to draw: the latest list, plus the chosen one when it isn't in it (found elsewhere, or flown out of view)
  const drawn = useMemo(() => {
    const list = (planes ?? []).filter(p => !hidden.has(kindOf(p)) || p.hex === selected?.hex);
    return selected && !list.some(p => p.hex === selected.hex) ? [...list, selected] : list;
  }, [planes, selected, hidden]);
  /** How many of each kind are in view, for the filter's buttons */
  const kindCounts = useMemo(() => {
    const counts: Record<Kind, number> = { jet: 0, heavy: 0, four: 0, prop: 0, light: 0, helicopter: 0 };
    for (const plane of planes ?? []) counts[kindOf(plane)]++;
    return counts;
  }, [planes]);
  const toggleKind = (kind: Kind) => setHidden(now => {
    const next = new Set(now);
    if (!next.delete(kind)) next.add(kind);
    return next;
  });
  const selectedHex = selected?.hex;

  // One marker a plane, kept between updates so each glides rather than blinks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const live = new Set(drawn.map(p => p.hex));
    for (const [hex, entry] of markers) {
      if (!live.has(hex)) { entry.marker.remove(); markers.delete(hex); }
    }
    for (const plane of drawn) {
      const track = Math.round(plane.track ?? 0);
      let entry = markers.get(plane.hex);
      const kind = kindOf(plane);
      // On the ground or off it, or a type heard late: a different picture, so a new marker
      if (entry && (entry.onGround !== plane.onGround || entry.kind !== kind)) { entry.marker.remove(); entry = undefined; }
      if (!entry) {
        const marker = L.marker([plane.lat, plane.lon], { icon: planeIcon(plane, kind), title: planeLabel(plane), alt: `Plane ${planeLabel(plane)}`, riseOnHover: true }).addTo(map);
        marker.on('click', () => {
          const now = latestRef.current.planes.find(p => p.hex === plane.hex) ?? (selectedRef.current?.hex === plane.hex ? selectedRef.current : plane);
          setSelected(now);
        });
        entry = { marker, track, onGround: plane.onGround, kind };
        markers.set(plane.hex, entry);
      } else if (entry.track !== track) {
        const glyph = entry.marker.getElement()?.querySelector<SVGElement>('.planes-glyph');
        if (glyph) glyph.style.transform = `rotate(${track}deg)`;
        entry.track = track;
      }
      entry.marker.getElement()?.classList.toggle('planes-marker-selected', plane.hex === selectedHex);
      entry.marker.setZIndexOffset(plane.hex === selectedHex ? 1000 : 0);
    }
    // The chosen plane's trail: where it has been heard while the app watched. Its colour is .planes-trail's.
    const trail = selectedHex ? trailsRef.current.get(selectedHex) ?? [] : [];
    if (trail.length < 2) {
      trailLineRef.current?.remove();
      trailLineRef.current = null;
    } else {
      const line = trailLineRef.current ??= L.polyline([], { className: 'planes-trail', interactive: false }).addTo(map);
      line.setLatLngs(trail.map(p => [p.lat, p.lon]));
    }
  }, [drawn, selectedHex]);

  // Between updates each plane is carried along its track once a second
  // (aircraft.ts, coast). A plane not in the latest list stays where it was heard.
  useEffect(() => {
    if (!watching) return;
    const step = () => {
      const { planes: list, at } = latestRef.current;
      const elapsed = (performance.now() - at) / 1000;
      for (const plane of list) {
        const here = coast(plane, plane.positionAge + elapsed);
        markersRef.current.get(plane.hex)?.marker.setLatLng([here.lat, here.lon]);
        // The trail's end follows the chosen plane as it glides
        if (plane.hex === selectedRef.current?.hex && trailLineRef.current) {
          trailLineRef.current.setLatLngs([...(trailsRef.current.get(plane.hex) ?? []).map(p => [p.lat, p.lon] as [number, number]), [here.lat, here.lon]]);
        }
      }
    };
    step();
    const timer = window.setInterval(step, 1000);
    return () => window.clearInterval(timer);
  }, [watching, drawn]);

  // Who owns the chosen plane, and where its flight usually goes. Asked once a plane a visit (adsbdb.ts keeps the answers).
  const selectedFlight = selected?.flight ?? '';
  useEffect(() => {
    if (!selectedHex) return;
    const request = new AbortController();
    fetchAirframe(selectedHex, request.signal)
      .then(airframe => setAirframes(known => ({ ...known, [selectedHex]: airframe })))
      .catch(() => { /* adsbdb is down or the plane was put away: the panel shows what the plane itself sends */ });
    fetchPhoto(selectedHex, request.signal)
      .then(photo => setPhotos(known => ({ ...known, [selectedHex]: photo })))
      .catch(() => {
        // Couldn't ask: no photo this time (the skeleton must not wait for ever). Asked again on the next click.
        if (!request.signal.aborted) setPhotos(known => ({ ...known, [selectedHex]: null }));
      });
    if (hasRoute(selectedFlight)) {
      fetchRoute(selectedFlight, request.signal)
        .then(route => setRoutes(known => ({ ...known, [selectedFlight]: route })))
        .catch(() => { /* as above */ });
    }
    return () => request.abort();
  }, [selectedHex, selectedFlight]);

  // ---- The place box

  /** Photon's places for some text. Throws when Photon refuses, so "no such place" only ever means that. */
  const searchPlaces = async (text: string, signal: AbortSignal): Promise<PlaceSuggestion[]> => {
    const res = await fetch(`${PHOTON}?q=${encodeURIComponent(text)}&limit=4&lang=en`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
    if (!res.ok) throw new Error(`Photon answered ${res.status}`);
    return toPlaceSuggestions(await res.json());
  };

  const goTo = (spot: PlaceSuggestion) => {
    window.clearTimeout(typingRef.current);
    placeRequestRef.current?.abort();
    setPlace(spot.display_name);
    setSuggestions([]);
    setPlaceNote(null);
    mapRef.current?.setView([Number(spot.lat), Number(spot.lon)], 9);
  };

  const onPlaceTyped = (text: string) => {
    setPlace(text);
    setPlaceNote(null);
    window.clearTimeout(typingRef.current);
    placeRequestRef.current?.abort();
    if (text.trim().length < 3) { setSuggestions([]); return; }
    typingRef.current = window.setTimeout(async () => {
      const request = placeRequestRef.current = new AbortController();
      try {
        const list = await searchPlaces(text.trim(), request.signal);
        if (!request.signal.aborted) setSuggestions(list);
      } catch {
        // Suggestions are a nicety: pressing Return still searches, and says what went wrong
      }
    }, TYPING_MS);
  };

  const onPlaceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = place.trim();
    if (!text) return;
    if (suggestions.length) { goTo(suggestions[0]); return; }
    window.clearTimeout(typingRef.current);
    placeRequestRef.current?.abort();
    const request = placeRequestRef.current = new AbortController();
    try {
      const list = await searchPlaces(text, request.signal);
      if (request.signal.aborted) return;
      if (list.length) goTo(list[0]);
      else setPlaceNote(`No place found called “${text}”.`);
    } catch {
      if (!request.signal.aborted) setPlaceNote('The place search isn’t answering. Try again in a moment.');
    }
  };

  // Nothing left running when the window closes
  useEffect(() => () => {
    window.clearTimeout(typingRef.current);
    placeRequestRef.current?.abort();
    findRequestRef.current?.abort();
  }, []);

  // ---- Find a plane

  /** Look something up: what was typed, or a card from Spotter's Picks */
  const runFind = async (text: string, card: Pick | null) => {
    findRequestRef.current?.abort();
    const request = findRequestRef.current = new AbortController();
    setFinding(true);
    setFound(null);
    setFindNote(null);
    setPick(card);
    try {
      const result = card?.type === MILITARY ? await militaryPlanes(request.signal) : await findPlanes(text, ticketToCallsign, request.signal);
      if (request.signal.aborted) return;
      if (result) {
        setFound(result);
        // One plane: say where it is straight away. A list waits for a row to be clicked.
        if (result.planes.length === 1) nameWhereItIs(result.planes[0], request.signal);
      } else {
        setFindNote(`${card ? `No ${card.name} is` : `Nothing called “${text}” is`} being picked up right now. It may be on the ground with its transponder off, or flying where no receiver hears it, such as mid-ocean.`);
      }
    } catch (error) {
      if (request.signal.aborted) return;
      setFindNote(error instanceof PlanesError ? error.message : 'Something went wrong looking that up.');
    } finally {
      if (findRequestRef.current === request) setFinding(false);
    }
  };

  const onFind = (event: React.FormEvent) => {
    event.preventDefault();
    const text = findText.trim();
    if (text.length >= 2 && !finding) runFind(text, null);
  };

  const openPick = (card: Pick) => {
    setFindText(card.type === MILITARY ? '' : card.type);
    runFind(card.type, card);
    if (typeInfos[card.wiki] === undefined) {
      fetchTypeInfo(card.wiki)
        .then(info => setTypeInfos(known => ({ ...known, [card.wiki]: info })))
        // No story this time (its skeleton must not wait for ever); the card's own line still shows
        .catch(() => setTypeInfos(known => ({ ...known, [card.wiki]: null })));
    }
  };

  /** Back to the cards */
  const closeFind = () => {
    findRequestRef.current?.abort();
    setFinding(false);
    setFound(null);
    setFindNote(null);
    setPick(null);
    setFindText('');
  };

  // The cards' pictures: one Wikipedia call, the first time Find a Plane is opened
  useEffect(() => {
    if (tab !== 'find') return;
    let closed = false;
    fetchPickImages().then(images => { if (!closed) setPickImages(images); });
    return () => { closed = true; };
  }, [tab]);

  const showOnMap = (plane: Plane) => {
    const map = mapRef.current;
    setSelected(plane);
    setTab('map');
    nameWhereItIs(plane);
    map?.setView([plane.lat, plane.lon], Math.max(map.getZoom(), 8));
  };

  const rows = useMemo(() => {
    if (!found) return [];
    return [...found.planes].sort((a, b) => Number(a.onGround) - Number(b.onGround) || planeLabel(a).localeCompare(planeLabel(b)));
  }, [found]);
  const flying = rows.filter(p => !p.onGround).length;
  const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  const findSummary = found && (found.kind === 'mil'
    ? `${count(rows.length, 'military aircraft is', 'military aircraft are')} being picked up: ${flying.toLocaleString('en-US')} in the air, ${(rows.length - flying).toLocaleString('en-US')} on the ground.`
    : found.kind === 'type'
    ? `${count(rows.length, `${pick?.name ?? found.query} is`, `${pick ? pick.name : found.query}s are`)} being picked up: ${flying.toLocaleString('en-US')} in the air, ${(rows.length - flying).toLocaleString('en-US')} on the ground.`
    : rows.length === 1
      ? `${planeLabel(rows[0])} is ${rows[0].onGround ? 'on the ground' : 'in the air'} right now${rows[0].hex in overs ? (overs[rows[0].hex] === null ? ', over open sea' : `, ${rows[0].onGround ? 'in' : 'over'} ${overs[rows[0].hex]}`) : ''}.`
      : `${count(rows.length, 'plane')} match ${found.query}: ${flying.toLocaleString('en-US')} in the air.`);

  // ---- What the status line says
  const inView = planes?.length ?? 0;
  const shown = (planes ?? []).filter(p => !hidden.has(kindOf(p))).length;
  const status = mapError
    ?? (!placed ? 'Finding where you are…' : planes === null ? 'Looking for planes…'
      : tooWide ? `${count(inView, 'plane')} within ${MAX_RADIUS_NM} nautical miles of the middle. Zoom in to see them all.`
        : !inView ? 'No planes are being picked up here right now.'
          : shown < inView ? `Showing ${shown.toLocaleString('en-US')} of ${count(inView, 'plane')} in view` : `${count(inView, 'plane')} in view`);

  const airframe = selected ? airframes[selected.hex] : undefined;
  const route = selected && hasRoute(selected.flight) ? routes[selected.flight] : undefined;
  const routeShown = selected && route && routeFits(selected, route.origin, route.destination) ? route : null;
  const selectedInView = !!selected && !!planes?.some(p => p.hex === selected.hex);
  const photo = selected ? photos[selected.hex] : undefined;
  const pickInfo = pick ? typeInfos[pick.wiki] : undefined;
  const facts: [string, string | undefined][] = selected ? [
    ['Airline', route?.airline || undefined],
    ['Usual route', routeShown ? `${routeShown.origin.code} ${routeShown.origin.city} → ${routeShown.destination.code} ${routeShown.destination.city}` : undefined],
    ['Aircraft', [airframe?.model, selected.type && (airframe?.model ? `(${selected.type})` : selected.type)].filter(Boolean).join(' ') || undefined],
    ['Tail number', selected.registration || undefined],
    ['Owner', airframe?.owner && airframe.owner !== route?.airline ? airframe.owner : undefined],
    ['Altitude', altitudeText(selected)],
    ['Speed', speedText(selected)],
    ['Heading', headingText(selected)],
    ['Climb', selected.onGround ? undefined : climbText(selected)],
    ['Position', positionText(selected.lat, selected.lon)],
    [selected.onGround ? 'In' : 'Over', selected.hex in overs ? overText(overs[selected.hex]) : undefined],
  ] : [];

  return (
    <div className="planes-app">
      <div className="mac-toolbar planes-toolbar">
        <div className="planes-tabs" role="tablist" aria-label="Planes">
          <button type="button" role="tab" aria-selected={tab === 'map'} className="planes-tab" onClick={() => setTab('map')}>Sky</button>
          <button type="button" role="tab" aria-selected={tab === 'find'} className="planes-tab" onClick={() => setTab('find')}>Find a Plane</button>
        </div>
        {tab === 'map' ? (
          <form className="planes-search" onSubmit={onPlaceSubmit} role="search">
            <input
              className="mac-field planes-field"
              type="search"
              value={place}
              onChange={event => onPlaceTyped(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') setSuggestions([]); }}
              placeholder="Search a place"
              aria-label="Search a place"
              autoComplete="off"
            />
            <button
              type="button"
              className={`planes-near${locating ? ' planes-near-locating' : ''}`}
              onClick={() => locate()}
              disabled={locating}
              aria-label={locating ? 'Finding your location' : 'Use my location'}
              title={locating ? 'Finding your location…' : 'Planes over where you are'}
            >
              {/* The crosshair "my location" mark, as on Field Guide's button */}
              <svg className="planes-near-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="1.75" fill="currentColor" />
                <path d="M8 0.75V3.5M8 12.5v2.75M0.75 8H3.5M12.5 8h2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {suggestions.length > 0 && (
              <ul className="planes-suggestions">
                {suggestions.map(spot => (
                  <li key={`${spot.lat},${spot.lon},${spot.display_name}`}>
                    <button type="button" className="mac-list-row planes-suggestion" onClick={() => goTo(spot)}>{spot.display_name}</button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        ) : (
          <form className="planes-search" onSubmit={onFind} role="search">
            <input
              className="mac-field planes-field"
              type="search"
              value={findText}
              onChange={event => setFindText(event.target.value)}
              placeholder="Flight, tail number or type"
              aria-label="Flight, tail number or aircraft type"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button type="submit" className="mac-button-primary planes-find-button" disabled={finding || findText.trim().length < 2}>
              {finding ? 'Looking…' : 'Find'}
            </button>
          </form>
        )}
      </div>

      <div className="planes-body">
        <div className="planes-sky" inert={tab !== 'map'}>
          <div className="planes-map">
            <div ref={canvasRef} className="planes-canvas" />
            <div className="planes-kinds" role="group" aria-label="Kinds of aircraft shown">
              {KINDS.map(([kind, name]) => (
                <button
                  key={kind}
                  type="button"
                  className="planes-kind"
                  aria-pressed={!hidden.has(kind)}
                  title={`${hidden.has(kind) ? 'Show' : 'Hide'} ${name.toLowerCase()} (${kindCounts[kind]} in view)`}
                  aria-label={`${name}: ${kindCounts[kind]} in view`}
                  onClick={() => toggleKind(kind)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SHAPES[kind].path} /></svg>
                  <span className="planes-kind-count">{kindCounts[kind]}</span>
                </button>
              ))}
            </div>
            {placeNote && <p className="planes-note" role="alert">{placeNote}</p>}
            <p className={`planes-status${mapError ? ' planes-status-error' : ''}`} role="status">{status}</p>
          </div>
          {selected && (
            <aside className="planes-info" aria-label={`Plane ${planeLabel(selected)}`}>
              <header className="planes-info-header">
                <h2 className="planes-info-name">{planeLabel(selected)}</h2>
                {route?.ticket && route.ticket !== selected.flight && <span className="planes-info-ticket">{route.ticket}</span>}
                <button type="button" className="planes-info-close" onClick={() => setSelected(null)} aria-label="Close plane details">×</button>
              </header>
              <div className="planes-info-body">
                {/* A skeleton while the photo is looked up and while it loads; nothing when there is none */}
                {photo === undefined && (
                  <figure className="planes-photo" aria-hidden="true">
                    <span className="mac-skeleton planes-photo-box" />
                    <figcaption className="planes-photo-credit">&nbsp;</figcaption>
                  </figure>
                )}
                {photo && (
                  <figure className="planes-photo">
                    <a href={photo.link} target="_blank" rel="noopener noreferrer" title="See this photo on planespotters.net">
                      <LoadingImage
                        className="planes-photo-box"
                        src={photo.src}
                        width={photo.width}
                        height={photo.height}
                        alt={`${selected.registration || planeLabel(selected)}, photographed by ${photo.photographer}`}
                      />
                    </a>
                    <figcaption className="planes-photo-credit">© {photo.photographer}, planespotters.net</figcaption>
                  </figure>
                )}
                <dl className="planes-facts">
                  {facts.map(([name, value]) => value && (
                    <React.Fragment key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
              {!selectedInView && planes !== null && <p className="planes-info-foot">Out of view: this is what it last sent.</p>}
            </aside>
          )}
        </div>

        {tab === 'find' && (
          <div className="planes-find">
            {(finding || findNote || found) && (
              <div className="planes-find-bar">
                <button type="button" className="planes-find-back" onClick={closeFind}>‹ Spotter’s Picks</button>
              </div>
            )}
            {pick && (finding || findNote || found) && (
              <article className="planes-type">
                {/* A skeleton until the article says which picture it has, then until the picture loads */}
                {pickInfo === undefined && !pickImages?.[pick.wiki] ? <span className="mac-skeleton planes-type-picture" />
                  : (pickInfo?.image ?? pickImages?.[pick.wiki]) && (
                    <LoadingImage className="planes-type-picture" src={(pickInfo?.image ?? pickImages![pick.wiki]).src} alt={pick.name} />
                  )}
                <div className="planes-type-words">
                  <h2 className="planes-type-name">{pick.name}</h2>
                  <p className="planes-type-blurb">{pick.blurb}</p>
                  {pickInfo === undefined && (
                    <div className="planes-type-waiting" aria-hidden="true">
                      <span className="mac-skeleton planes-type-line" />
                      <span className="mac-skeleton planes-type-line" />
                      <span className="mac-skeleton planes-type-line planes-type-line-short" />
                    </div>
                  )}
                  {pickInfo?.story.map(paragraph => <p key={paragraph} className="planes-type-story">{paragraph}</p>)}
                  {!!pickInfo?.facts.length && (
                    <dl className="planes-facts planes-type-facts">
                      {pickInfo.facts.map(([name, value]) => (
                        <React.Fragment key={name}>
                          <dt>{name}</dt>
                          <dd>{value}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                  <p className="planes-type-source">
                    <a href={wikiLink(pick)} target="_blank" rel="noopener noreferrer">Read more on Wikipedia</a>
                    {pickInfo && ` · Story and picture: Wikipedia${pickInfo.facts.length ? '. Dates and sizes: Wikidata' : ''}.`}
                  </p>
                </div>
              </article>
            )}
            {finding && <p className="mac-message">Looking around the world…</p>}
            {findNote && <p className="mac-message planes-find-note">{findNote}</p>}
            {!finding && !findNote && !found && (
              <div className="planes-find-hint">
                <p className="planes-find-intro">
                  Is it in the sky right now? Type a flight (BAW117, or BA117 as on a ticket), a tail number (N24979) or
                  an aircraft type (A388) above, or pick one of these:
                </p>
                <ul className="planes-picks" aria-label="Spotter’s Picks">
                  {PICKS.map(card => (
                    <li key={card.type}>
                      <button type="button" className="planes-pick" onClick={() => openPick(card)}>
                        {/* A skeleton until Wikipedia has said which pictures there are, then until each loads */}
                        {pickImages === null ? <span className="mac-skeleton planes-pick-picture" />
                          : pickImages[card.wiki] ? <LoadingImage className="planes-pick-picture" src={pickImages[card.wiki].src} alt="" lazy />
                            : <span className="planes-pick-picture planes-pick-no-picture" />}
                        <span className="planes-pick-name">{card.name}</span>
                        <span className="planes-pick-blurb">{card.blurb}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="planes-picks-credit">Pictures from each aircraft’s Wikipedia article.</p>
              </div>
            )}
            {found && (
              <>
                {pick && <h3 className="planes-find-heading">In the sky right now</h3>}
                <p className="planes-find-summary" role="status">
                  {findSummary} {rows.length === 1 ? 'Tap it on the map to follow it.' : 'Tap one on the map, or in the list, to follow it.'}
                </p>
                <WorldMap planes={rows} onPick={showOnMap} />
                {(rows.length > MOST_ON_MAP || rows.length > MOST_ROWS) && (
                  <p className="planes-find-capped">
                    {rows.length > MOST_ON_MAP && `The map shows the first ${MOST_ON_MAP}. `}
                    {rows.length > MOST_ROWS && `The list shows the first ${MOST_ROWS}.`}
                  </p>
                )}
                <ul className="planes-results">
                  {rows.slice(0, MOST_ROWS).map(plane => (
                    <li key={plane.hex}>
                      <button type="button" className="mac-list-row planes-result" onClick={() => showOnMap(plane)} title="Show on the map">
                        <span className="planes-result-name">{planeLabel(plane)}</span>
                        <span className="planes-result-kind">{[plane.type, plane.flight && plane.registration].filter(Boolean).join(' · ')}</span>
                        <span className="planes-result-height">{altitudeText(plane)}</span>
                        <span className="planes-result-where">{positionText(plane.lat, plane.lon)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Planes;
