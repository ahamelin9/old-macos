import L from 'leaflet';

/**
 * The OpenStreetMap base map both Field Guide maps sit on. OSM's tile usage
 * policy asks for the credit to show on the map, and for the plain host: the
 * a/b/c subdomains are retired. The rules: the `apis` skill, openstreetmap.md.
 */
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/** Adds the base tiles and a small credit line in the bottom-left corner */
export const addOsmBaseLayer = (map: L.Map) => {
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  L.tileLayer(OSM_TILES, { maxZoom: 18, attribution: OSM_CREDIT }).addTo(map);
};
