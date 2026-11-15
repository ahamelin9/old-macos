import { describe, expect, it } from 'vitest';
import { toPlaceSuggestions } from './photon';

describe('toPlaceSuggestions', () => {
  it("swaps Photon's [lng, lat] into lat and lon, and builds a short label", () => {
    const data = {
      features: [
        {
          geometry: { coordinates: [-122.674194, 45.5202471] },
          properties: { name: 'Portland', county: 'Multnomah', state: 'Oregon', country: 'United States' }
        }
      ]
    };
    expect(toPlaceSuggestions(data)).toEqual([
      { name: 'Portland', display_name: 'Portland, Oregon, United States', lat: '45.5202471', lon: '-122.674194' }
    ]);
  });

  it('names an address by its street when it has no name, and skips repeats', () => {
    const data = {
      features: [
        {
          geometry: { coordinates: [139.65, 35.67] },
          properties: { housenumber: '1', street: 'Chiyoda', city: 'Tokyo', state: 'Tokyo', country: 'Japan' }
        }
      ]
    };
    expect(toPlaceSuggestions(data)[0].display_name).toBe('1 Chiyoda, Tokyo, Japan');
  });

  it('drops features with no name or no coordinates', () => {
    expect(toPlaceSuggestions({ features: [{ properties: { name: 'X' } }, { geometry: { coordinates: [1, 2] } }] })).toEqual([]);
    expect(toPlaceSuggestions(null)).toEqual([]);
  });
});
