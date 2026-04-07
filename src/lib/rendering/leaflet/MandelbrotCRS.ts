import type * as Leaflet from 'leaflet';

/**
 * Custom CRS mapping Leaflet tile coords to the complex plane.
 * Zoom 0: world = [-4, 4] × [-4i, 4i] (8 units wide).
 * At zoom Z, tile (x,y): re ∈ [-4 + 8x/2^Z, -4 + 8(x+1)/2^Z]
 */
export function createMandelbrotCRS(L: typeof Leaflet) {
	return L.extend({}, L.CRS.Simple, {
		// Tile size in Leaflet's internal units
		projection: L.Projection.LonLat,
		transformation: new L.Transformation(1, 0, -1, 0),

		/** Convert complex coord to Leaflet LatLng (re → lng, im → lat) */
		complexToLatLng(re: number, im: number) {
			return L.latLng(im, re);
		},

		/** Complex center for tile (x, y) at zoom z */
		tileCenter(x: number, y: number, z: number): { re: number; im: number } {
			const scale = 8 / Math.pow(2, z); // units per tile
			const re = -4 + (x + 0.5) * scale;
			const im = -4 + (y + 0.5) * scale;
			return { re, im };
		},

		/** Complex bounds for tile (x, y, z) */
		tileBounds(
			x: number,
			y: number,
			z: number
		): { reMin: number; reMax: number; imMin: number; imMax: number } {
			const scale = 8 / Math.pow(2, z);
			return {
				reMin: -4 + x * scale,
				reMax: -4 + (x + 1) * scale,
				imMin: -4 + y * scale,
				imMax: -4 + (y + 1) * scale
			};
		}
	});
}
