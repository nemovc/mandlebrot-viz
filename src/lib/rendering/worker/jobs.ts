import type { ColorConfig } from "$lib/utils/colorPalettes";
import type { PrecisionMode } from "$lib/utils/precision";

export interface BaseJob {
  id: string;
  priority: number;
}

export interface BaseResult {
  id: string;
}

/** A full WASM compute job — runs Mandelbrot iteration and produces a coloured tile. */
export interface ComputeJob extends BaseJob {
  cx: string;
  cy: string;
  scale: string;
  tileW: number;
  tileH: number;
  maxIter: number;
  power: number;
  precisionMode: PrecisionMode;
  colorConfig: ColorConfig;
  cdf?: Float32Array;
  debug?: boolean;
  slow?: boolean;
}

export interface ComputeResult extends BaseResult {
  imageData: ImageData;
  iters: Float32Array;
}

/** A colour-only recolor job — no WASM, uses pre-computed iters from cache. */
export interface RecolorJob extends BaseJob {
  iters: Float32Array;
  cdf?: Float32Array;
  tileW: number;
  tileH: number;
  maxIter: number;
  colorConfig: ColorConfig;
  slow?: boolean;
}

export interface RecolorResult extends BaseResult {
  imageData: ImageData;
}

/** A Julia set render job — always f64, c is fixed at (cRe, cIm). */
export interface JuliaJob extends BaseJob {
  cRe: number;
  cIm: number;
  viewCx: number;
  viewCy: number;
  scale: number;
  size: number;
  maxIter: number;
  power: number;
  colorConfig: ColorConfig;
}

export interface JuliaResult extends BaseResult {
  imageData: ImageData;
}
