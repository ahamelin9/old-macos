import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addOsmBaseLayer } from './osm';

interface MapPreviewProps {
  lat: number;
  lng: number;
  locationName: string;
  radiusKm?: number;
  zoom?: number;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  lat,
  lng,
  locationName,
  radiusKm = 30,
  zoom = 10,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      addOsmBaseLayer(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.setView([lat, lng], zoom);

    const customPin = L.divIcon({
      className: 'retro-map-marker-container',
      html: `
        <div class="retro-map-pin">
          <div class="pin-badge">📍</div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 26],
      popupAnchor: [0, -26],
    });

    if (markerRef.current) {
      markerRef.current.remove();
    }
    if (circleRef.current) {
      circleRef.current.remove();
    }

    const circle = L.circle([lat, lng], {
      // Its stroke and fill come from .fg-map-zone in FieldGuide.css
      className: 'fg-map-zone',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '4, 4',
      radius: radiusKm * 1000,
    }).addTo(map);
    circleRef.current = circle;

    const marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
    marker.bindPopup(`
      <div class="fg-map-popup">
        <strong class="fg-map-popup-name">${locationName}</strong><br/>
        <span class="fg-map-popup-coords">Lat: ${lat.toFixed(4)}°, Lng: ${lng.toFixed(4)}°</span><br/>
        <span class="fg-map-popup-zone">${radiusKm}km observation zone</span>
      </div>
    `);
    markerRef.current = marker;

    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [lat, lng, radiusKm, zoom, locationName]);

  useEffect(() => {
    // Leaflet only watches the browser window. This map also changes size
    // with the app window (maximize, drag-resize), which left it half grey.
    const container = mapContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      if (container && container.clientWidth > 0) mapInstanceRef.current?.invalidateSize();
    });
    if (container) resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fieldguide-map-wrapper">
      <div className="fieldguide-map-header">
        <div className="map-header-title">
          <span className="map-radar-icon">🧭</span> Map Preview ({radiusKm}km radius)
        </div>
        <div className="map-header-coords">
          {lat.toFixed(4)}°, {lng.toFixed(4)}°
        </div>
      </div>
      <div ref={mapContainerRef} className="fieldguide-map-canvas" />
    </div>
  );
};

export default MapPreview;

