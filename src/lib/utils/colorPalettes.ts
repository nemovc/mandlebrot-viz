import type { ColorConfig } from "$lib/stores/viewerState.svelte";

export const DEFAULT_PALETTE: ColorConfig = {
  algorithm: "smooth",
  palette: [
    { stop: 0.0, color: "#000764" },
    { stop: 0.16, color: "#206bcb" },
    { stop: 0.42, color: "#edffff" },
    { stop: 0.6425, color: "#ffaa00" },
    { stop: 0.8575, color: "#000200" },
  ],
  cyclePeriod: 64,
  offset: 0,
};

export const PRESETS: Record<string, ColorConfig> = {
  "Classic Blue-Gold": DEFAULT_PALETTE,
  Fire: {
    algorithm: "smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 0.25, color: "#7f0000" },
      { stop: 0.5, color: "#ff4000" },
      { stop: 0.75, color: "#ffff00" },
      { stop: 1.0, color: "#ffffff" },
    ],
    cyclePeriod: 48,
    offset: 0,
  },
  Grayscale: {
    algorithm: "smooth",
    palette: [
      { stop: 0.0, color: "#000000" },
      { stop: 1.0, color: "#ffffff" },
    ],
    cyclePeriod: 32,
    offset: 0,
  },
  "Ultra Fractal": {
    algorithm: "smooth",
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
};

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

/** Build a flat RGBA Uint8ClampedArray from smooth iteration values */
export function buildImageData(
  iters: Float32Array,
  width: number,
  height: number,
  maxIter: number,
  config: ColorConfig,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // Cache palette lookups — many adjacent pixels share nearly identical smooth values.
  // Key is the palette t value quantized to 1/4000 resolution.
  const colorCache = new Map<number, [number, number, number]>();
  const { cyclePeriod, offset, palette } = config;

  for (let i = 0; i < iters.length; i++) {
    const smooth = iters[i];
    let r: number, g: number, b: number;

    if (smooth >= maxIter) {
      r = g = b = 0;
    } else {
      const t = (((smooth / cyclePeriod + offset) % 1) + 1) % 1;
      const key = Math.round(t * 4000);
      let cached = colorCache.get(key);
      if (!cached) {
        cached = samplePalette(palette, key / 4000);
        colorCache.set(key, cached);
      }
      [r, g, b] = cached;
    }

    data[i * 4] = r!;
    data[i * 4 + 1] = g!;
    data[i * 4 + 2] = b!;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}
