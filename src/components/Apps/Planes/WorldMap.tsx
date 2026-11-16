// Where every plane of a search is right now, on one map: the world, or as
// much of it as holds them all. A tap on a plane opens it in Sky. It draws
// what Find a Plane already fetched, so it asks adsb.lol for nothing.
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSM_CREDIT, OSM_TILES } from '../FieldGuide/osm';
import { planeLabel, type Plane } from './aircraft';
import { planeIcon } from './marker';
import { kindOf } from './shapes';

/** The most planes drawn: every Boeing 737 in the air would be thousands of markers */
export const MOST_ON_MAP = 400;

interface WorldMapProps {
  planes: Plane[];
  onPick: (plane: Plane) => void;
}

const WorldMap: React.FC<WorldMapProps> = ({ planes, onPick }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // The latest onPick, so the markers needn't be redrawn when the parent re-renders
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = L.map(canvas, {
      center: [25, 0],
      zoom: 1,
      minZoom: 1,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      // The page under the map scrolls with the wheel; the + and − zoom the map
      scrollWheelZoom: false,
    });
    const credit = L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
    L.tileLayer(OSM_TILES, { maxZoom: 18, attribution: OSM_CREDIT }).addTo(map);
    credit.addAttribution('Planes: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a>');
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => {
      if (canvas.clientWidth > 0) map.invalidateSize();
    });
    resizeObserver.observe(canvas);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const shown = planes.slice(0, MOST_ON_MAP);
    for (const plane of shown) {
      L.marker([plane.lat, plane.lon], { icon: planeIcon(plane, kindOf(plane)), title: planeLabel(plane), alt: `Plane ${planeLabel(plane)}`, riseOnHover: true })
        .on('click', () => onPickRef.current(plane))
        .addTo(layer);
    }
    if (shown.length === 1) map.setView([shown[0].lat, shown[0].lon], 5, { animate: false });
    else if (shown.length) map.fitBounds(L.latLngBounds(shown.map(p => [p.lat, p.lon] as [number, number])), { padding: [24, 24], maxZoom: 6, animate: false });
  }, [planes]);

  return <div ref={canvasRef} className="planes-world" role="application" aria-label="Where they are right now" />;
};

export default WorldMap;
