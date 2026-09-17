import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FIELD_GUIDE_PALETTE, tileColor } from './palette';

export interface ObservationBounds {
  swlat: number;
  swlng: number;
  nelat: number;
  nelng: number;
}

interface RangeMapProps {
  taxonId: number;
  taxonName: string;
  bounds?: ObservationBounds | null;
}

// iNaturalist serves two useful raster overlays per taxon:
//  - taxon_ranges: expert-drawn native range polygons (only some taxa have them)
//  - grid: binned counts of verifiable observations
// Both accept `color`, so they are tinted from the app's own key rather than
// left on iNaturalist's defaults (pink ranges, orange grid) which matched
// nothing else on the page.
const RANGE_TILES = (id: number) =>
  `https://api.inaturalist.org/v1/taxon_ranges/${id}/{z}/{x}/{y}.png` +
  `?color=${tileColor(FIELD_GUIDE_PALETTE.native)}`;
const GRID_TILES = (id: number) =>
  `https://api.inaturalist.org/v1/grid/{z}/{x}/{y}.png?taxon_id=${id}&verifiable=true` +
  `&color=${tileColor(FIELD_GUIDE_PALETTE.sightings)}`;

const RangeMap: React.FC<RangeMapProps> = ({ taxonId, taxonName, bounds }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const rangeLayerRef = useRef<L.TileLayer | null>(null);
  const gridLayerRef = useRef<L.TileLayer | null>(null);

  const [showRange, setShowRange] = useState(true);
  const [showSightings, setShowSightings] = useState(true);
  // null = still unknown, true/false once the first range tile resolves
  const [hasRangeData, setHasRangeData] = useState<boolean | null>(null);

  // Create the map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Swap the taxon overlays whenever the selected species changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setHasRangeData(null);

    rangeLayerRef.current?.remove();
    gridLayerRef.current?.remove();

    // The two layers overlap heavily by nature -- a species is most observed
    // where it is native -- so the range has to sit ABOVE the sightings or it
    // is simply not visible (measured: ~77% of range pixels fall under the
    // grid). z-index is set explicitly because Leaflet otherwise stacks by add
    // order, which would reshuffle every time a layer is toggled back on.
    const rangeLayer = L.tileLayer(RANGE_TILES(taxonId), {
      maxNativeZoom: 12,
      maxZoom: 18,
      opacity: 0.55,
      zIndex: 3,
      className: 'fieldguide-range-tiles',
    });
    // A taxon with no range map returns empty/404 tiles; listen once to find out.
    rangeLayer.on('tileload', () => setHasRangeData(true));
    rangeLayer.on('tileerror', () => setHasRangeData(prev => (prev === null ? false : prev)));
    rangeLayerRef.current = rangeLayer;

    const gridLayer = L.tileLayer(GRID_TILES(taxonId), {
      maxNativeZoom: 14,
      maxZoom: 18,
      opacity: 0.7,
      zIndex: 2,
    });
    gridLayerRef.current = gridLayer;

    if (showSightings) gridLayer.addTo(map);
    if (showRange) rangeLayer.addTo(map);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonId]);

  // Toggle overlays without rebuilding them
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = rangeLayerRef.current;
    if (!map || !layer) return;
    if (showRange) layer.addTo(map);
    else layer.remove();
  }, [showRange]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = gridLayerRef.current;
    if (!map || !layer) return;
    if (showSightings) layer.addTo(map);
    else layer.remove();
  }, [showSightings]);

  // Frame the map on where the species has actually been recorded
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (bounds) {
      map.fitBounds(
        L.latLngBounds(
          [bounds.swlat, bounds.swlng],
          [bounds.nelat, bounds.nelng]
        ),
        { padding: [12, 12], maxZoom: 9 }
      );
    } else {
      map.setView([20, 0], 2);
    }

    const timeout = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timeout);
  }, [bounds, taxonId]);

  return (
    <div className="fieldguide-map-wrapper range-map-wrapper">
      <div className="fieldguide-map-header">
        <div className="map-header-title">
          <span className="map-radar-icon">🌎</span> Range Map — <em>{taxonName}</em>
        </div>
        <div className="map-header-coords">
          {bounds ? 'Framed on recorded sightings' : 'Worldwide view'}
        </div>
      </div>

      <div ref={mapContainerRef} className="fieldguide-map-canvas range-map-canvas" />

      <div className="range-map-legend">
        <label className="range-layer-toggle">
          <input
            type="checkbox"
            checked={showRange}
            onChange={(e) => setShowRange(e.target.checked)}
          />
          <span className="legend-swatch swatch-range" />
          Native range
        </label>
        <label className="range-layer-toggle">
          <input
            type="checkbox"
            checked={showSightings}
            onChange={(e) => setShowSightings(e.target.checked)}
          />
          <span className="legend-swatch swatch-sightings" />
          Sightings
        </label>
        {hasRangeData === false && (
          <span className="range-missing-note">
            No expert range map published for this taxon — sightings only.
          </span>
        )}
      </div>
    </div>
  );
};

export default RangeMap;
