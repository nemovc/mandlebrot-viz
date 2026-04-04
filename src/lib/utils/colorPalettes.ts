import type { ColorConfig } from "$lib/stores/viewerState.svelte";

export type BaseAlgorithm = 'escape_time' | 'distance_estimation' | 'histogram';

export function baseAlgorithm(a: ColorConfig['algorithm']): BaseAlgorithm {
  if (a === 'distance_estimation' || a === 'distance_estimation_banded') return 'distance_estimation';
  if (a === 'histogram_equalized_smooth' || a === 'histogram_equalized_banded') return 'histogram';
  return 'escape_time';
}

export const ALGORITHMS: { value: ColorConfig['algorithm']; label: string }[] = [
  { value: 'escape_time_smooth',          label: 'Escape Time (smooth)' },
  { value: 'escape_time_banded',          label: 'Escape Time (banded)' },
  { value: 'distance_estimation',         label: 'Distance Estimation (smooth)' },
  { value: 'distance_estimation_banded',  label: 'Distance Estimation (banded)' },
  { value: 'histogram_equalized_smooth',  label: 'Histogram Equalized (smooth)' },
  { value: 'histogram_equalized_banded',  label: 'Histogram Equalized (banded)' },
];

export const DEFAULT_PALETTE: ColorConfig = {
  algorithm: "escape_time_smooth",
  palette: [
    { stop: 0.0, color: "#000764" },
    { stop: 0.16, color: "#206bcb" },
    { stop: 0.42, color: "#edffff" },
    { stop: 0.6425, color: "#ffaa00" },
    { stop: 0.8575, color: "#000200" },
    { stop: 1.0, color: "#000764" },
  ],
  cyclePeriod: 64,
  offset: 0,
};

export const PRESETS: Record<string, ColorConfig> = {
  "Classic Blue-Gold": DEFAULT_PALETTE,
  Fire: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.25, color: "#7f0000" },
      { stop: 0.5, color: "#ff4000" },
      { stop: 0.75, color: "#ffff00" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  Grayscale: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.5, color: "#ffffff" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 64,
    offset: 0,
  },
  "Ultra Fractal": {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.2, color: "#3d006e" },
      { stop: 0.4, color: "#00a0ff" },
      { stop: 0.6, color: "#ffffff" },
      { stop: 0.8, color: "#ffdd00" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 64,
    offset: 0,
  },
  Ocean: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000010" },
      { stop: 0.2, color: "#001a4d" },
      { stop: 0.45, color: "#0066aa" },
      { stop: 0.65, color: "#00cccc" },
      { stop: 0.85, color: "#80eeff" },
      { stop: 1.0, color: "#000010" },
    ],
    cyclePeriod: 56,
    offset: 0,
  },
  Sunset: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#0a0020" },
      { stop: 0.2, color: "#4b0082" },
      { stop: 0.4, color: "#cc0044" },
      { stop: 0.6, color: "#ff6600" },
      { stop: 0.8, color: "#ffcc00" },
      { stop: 1.0, color: "#0a0020" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  Neon: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#0d0d0d" },
      { stop: 0.2, color: "#0f00ff" },
      { stop: 0.4, color: "#ff00ff" },
      { stop: 0.6, color: "#00ffff" },
      { stop: 0.8, color: "#ff00aa" },
      { stop: 1.0, color: "#0d0d0d" },
    ],
    cyclePeriod: 40,
    offset: 0,
  },
  Forest: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000a00" },
      { stop: 0.25, color: "#1a3300" },
      { stop: 0.5, color: "#2d7a00" },
      { stop: 0.75, color: "#aadd44" },
      { stop: 1.0, color: "#000a00" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  Candy: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#ff6688" },
      { stop: 0.25, color: "#ffcc44" },
      { stop: 0.5, color: "#44eebb" },
      { stop: 0.75, color: "#aa66ff" },
      { stop: 1.0, color: "#ff6688" },
    ],
    cyclePeriod: 32,
    offset: 0,
  },
  Ice: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000814" },
      { stop: 0.3, color: "#003366" },
      { stop: 0.55, color: "#0099cc" },
      { stop: 0.75, color: "#aaddff" },
      { stop: 0.85, color: "#e8f8ff" },
      { stop: 0.93, color: "#ffffff" },
      { stop: 1.0, color: "#000814" },
    ],
    cyclePeriod: 40,
    offset: 0,
  },
  Lava: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#0a0000" },
      { stop: 0.3, color: "#3d0000" },
      { stop: 0.55, color: "#cc1100" },
      { stop: 0.75, color: "#ff8800" },
      { stop: 0.85, color: "#ffee00" },
      { stop: 0.93, color: "#ffffff" },
      { stop: 1.0, color: "#0a0000" },
    ],
    cyclePeriod: 40,
    offset: 0,
  },
  Galaxy: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000008" },
      { stop: 0.2, color: "#110033" },
      { stop: 0.4, color: "#440077" },
      { stop: 0.6, color: "#cc44bb" },
      { stop: 0.8, color: "#ffaaee" },
      { stop: 0.9, color: "#ffffff" },
      { stop: 1.0, color: "#000008" },
    ],
    cyclePeriod: 72,
    offset: 0,
  },
  Toxic: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.3, color: "#003300" },
      { stop: 0.55, color: "#00aa00" },
      { stop: 0.75, color: "#aaff00" },
      { stop: 0.85, color: "#ffff44" },
      { stop: 0.93, color: "#ffffff" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 36,
    offset: 0,
  },
  Autumn: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#100500" },
      { stop: 0.2, color: "#5c1500" },
      { stop: 0.4, color: "#bb4400" },
      { stop: 0.6, color: "#ee8800" },
      { stop: 0.78, color: "#ffcc44" },
      { stop: 0.9, color: "#fff0aa" },
      { stop: 1.0, color: "#100500" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  "Deep Space": {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.15, color: "#0a0020" },
      { stop: 0.35, color: "#1a0050" },
      { stop: 0.55, color: "#4400aa" },
      { stop: 0.7, color: "#0066ff" },
      { stop: 0.83, color: "#aaccff" },
      { stop: 0.93, color: "#ffffff" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 96,
    offset: 0,
  },
  Copper: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.3, color: "#331100" },
      { stop: 0.55, color: "#884400" },
      { stop: 0.75, color: "#cc7722" },
      { stop: 0.85, color: "#ddaa66" },
      { stop: 0.93, color: "#eeddbb" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 40,
    offset: 0,
  },
  Plasma: {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#0d0221" },
      { stop: 0.2, color: "#7b00d4" },
      { stop: 0.4, color: "#dd00aa" },
      { stop: 0.6, color: "#ff4400" },
      { stop: 0.78, color: "#ffdd00" },
      { stop: 0.9, color: "#ffffff" },
      { stop: 1.0, color: "#0d0221" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  "Electric Blue": {
    algorithm: "escape_time_smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.25, color: "#001133" },
      { stop: 0.5, color: "#0033cc" },
      { stop: 0.7, color: "#0099ff" },
      { stop: 0.82, color: "#66ddff" },
      { stop: 0.92, color: "#ffffff" },
      { stop: 1.0, color: "#000000" },
    ],
    cyclePeriod: 44,
    offset: 0,
  },
};

/** Build a cumulative distribution function from escaped-pixel iteration values across tiles.
 *  Returns a Float32Array of length maxIter+1 where cdf[i] = fraction of escaped pixels with iter ≤ i.
 *  In-set pixels (val >= maxIter) are excluded from the distribution.
 */
export function buildCdf(tileIters: Float32Array[], maxIter: number): Float32Array {
  const bins = new Uint32Array(maxIter + 1);
  let total = 0;
  for (const iters of tileIters) {
    for (let i = 0; i < iters.length; i++) {
      const v = iters[i];
      if (v < maxIter) {
        bins[Math.min(Math.floor(v), maxIter - 1)]++;
        total++;
      }
    }
  }
  const cdf = new Float32Array(maxIter + 1);
  if (total === 0) return cdf;
  let cumulative = 0;
  for (let i = 0; i <= maxIter; i++) {
    cumulative += bins[i];
    cdf[i] = cumulative / total;
  }
  return cdf;
}

/** Sample a gradient palette at position t ∈ [0,1] */
export function samplePalette(
  palette: ColorConfig["palette"],
  t: number,
): [number, number, number] {
  const stops = palette;
  if (stops.length === 0) return [0, 0, 0];
  if (t <= stops[0].stop) return hexToRgb(stops[0].color);
  if (t >= stops[stops.length - 1].stop)
    return hexToRgb(stops[stops.length - 1].color);

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].stop && t <= stops[i + 1].stop) {
      const f = (t - stops[i].stop) / (stops[i + 1].stop - stops[i].stop);
      const a = hexToRgb(stops[i].color);
      const b = hexToRgb(stops[i + 1].color);
      return [
        Math.round(a[0] + (b[0] - a[0]) * f),
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
      ];
    }
  }
  return [0, 0, 0];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Build a flat RGBA Uint8ClampedArray from iteration values.
 *  The meaning of each value in `iters` depends on the algorithm:
 *  - escape_time_smooth/escape_time_banded: fractional escape iteration count (>= maxIter = in set)
 *  - distance_estimation: estimated distance to set boundary (< 0 = in set)
 */
export function buildImageData(
  iters: Float32Array,
  width: number,
  height: number,
  maxIter: number,
  config: ColorConfig,
  cdf?: Float32Array,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const colorCache = new Map<number, [number, number, number]>();
  const { algorithm, cyclePeriod, offset, palette, reverse, inSetColor } =
    config;
  const inSetRgb = inSetColor
    ? hexToRgb(inSetColor)
    : ([0, 0, 0] as [number, number, number]);

  for (let i = 0; i < iters.length; i++) {
    const val = iters[i];
    let r: number, g: number, b: number;

    if (
      algorithm === "distance_estimation" ||
      algorithm === "distance_estimation_banded"
    ) {
      // val is the estimated distance from this pixel's c-value to the Mandelbrot
      // set boundary, computed by the WASM DEM functions. val < 0 means the point
      // is inside the set (colored black). Outside points have val > 0, with
      // smaller values indicating pixels closer to the boundary.
      //
      // To turn the distance into a palette position we take -log₂(dist).
      // Log-scaling compresses the huge range of distance values (they vary by
      // many orders of magnitude across a tile) into something palette-sized.
      // Negating it means smaller distances (near the boundary) map to larger
      // values, which naturally creates dense banding right at the set edge —
      // the characteristic "edge-lit" look of DEM coloring.
      // cyclePeriod controls how many palette cycles fit per decade of distance.
      if (val < 0) {
        [r, g, b] = inSetRgb;
      } else {
        const logDist = -Math.log2(Math.max(val, 1e-30));
        const scaledLog =
          algorithm === "distance_estimation_banded"
            ? Math.floor(logDist)
            : logDist;
        const t = (((scaledLog / cyclePeriod + offset) % 1) + 1) % 1;
        const key = Math.round((reverse ? 1 - t : t) * 4000);
        let cached = colorCache.get(key);
        if (!cached) {
          cached = samplePalette(palette, key / 4000);
          colorCache.set(key, cached);
        }
        [r, g, b] = cached;
      }
    } else if (algorithm === 'histogram_equalized_smooth' || algorithm === 'histogram_equalized_banded') {
      if (val >= maxIter) {
        [r, g, b] = inSetRgb;
      } else {
        const lo = Math.min(Math.floor(val), maxIter - 1);
        let rawT: number;
        if (cdf) {
          if (algorithm === 'histogram_equalized_banded') {
            rawT = cdf[lo];
          } else {
            const hi = Math.min(lo + 1, maxIter - 1);
            rawT = cdf[lo] + (cdf[hi] - cdf[lo]) * (val - lo);
          }
        } else {
          // No CDF yet — placeholder using smooth escape time
          rawT = (val / cyclePeriod) % 1;
        }
        const t = (((rawT + offset) % 1) + 1) % 1;
        const key = Math.round((reverse ? 1 - t : t) * 4000);
        let cached = colorCache.get(key);
        if (!cached) {
          cached = samplePalette(palette, key / 4000);
          colorCache.set(key, cached);
        }
        [r, g, b] = cached;
      }
    } else {
      if (val >= maxIter) {
        [r, g, b] = inSetRgb;
      } else {
        const n = algorithm === "escape_time_banded" ? Math.floor(val) : val;
        const t = (((n / cyclePeriod + offset) % 1) + 1) % 1;
        const key = Math.round((reverse ? 1 - t : t) * 4000);
        let cached = colorCache.get(key);
        if (!cached) {
          cached = samplePalette(palette, key / 4000);
          colorCache.set(key, cached);
        }
        [r, g, b] = cached;
      }
    }

    data[i * 4] = r!;
    data[i * 4 + 1] = g!;
    data[i * 4 + 2] = b!;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}
