// The marker a plane is drawn with on either map: seen from above, nose up,
// in the shape of its kind (shapes.ts), turned to the plane's track. Its
// colours come from Planes.css.
import L from 'leaflet';
import type { Plane } from './aircraft';
import { SHAPES, type Kind } from './shapes';

export const planeIcon = (plane: Plane, kind: Kind) => {
  const { path, size } = SHAPES[kind];
  return L.divIcon({
    className: `planes-marker planes-marker-${kind}${plane.onGround ? ' planes-marker-ground' : ''}`,
    html: `<svg class="planes-glyph" viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${Math.round(plane.track ?? 0)}deg)"><path d="${path}"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};
