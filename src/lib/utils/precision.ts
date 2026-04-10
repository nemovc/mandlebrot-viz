export type PrecisionMode = 'f64' | 'double_double' | 'arbitrary';

export function getPrecisionMode(zoom: number): PrecisionMode {
  if (zoom < 50) return 'f64';
  if (zoom < 100) return 'double_double';
  return 'arbitrary';
}

/** Bits of precision needed for arbitrary mode at given zoom level */
export function getPrecisionBits(zoom: number): number {
  // Each zoom level needs ~1 extra bit; add generous headroom
  return Math.max(128, zoom * 2 + 64);
}

/** Complex units per pixel at given zoom and tile size */
export function scaleForZoom(zoom: number, tileSize = 256): number {
  // Zoom 0: world = 8 units wide across tileSize pixels
  return 8 / (tileSize * Math.pow(2, zoom));
}
