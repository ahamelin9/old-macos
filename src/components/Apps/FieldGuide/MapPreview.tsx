import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

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
      color: '#2a75bb',
      fillColor: '#6D8CBE',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '4, 4',
      radius: radiusKm * 1000,
    }).addTo(map);
    circleRef.current = circle;

    const marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: 'Geneva', 'Lucida Grande', sans-serif; font-size: 11px; padding: 2px; line-height: 1.4;">
        <strong style="color: #111;">${locationName}</strong><br/>
        <span style="color: #666;">Lat: ${lat.toFixed(4)}°, Lng: ${lng.toFixed(4)}°</span><br/>
        <span style="color: #2a75bb; font-size: 10px;">${radiusKm}km observation zone</span>
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
    return () => {
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

