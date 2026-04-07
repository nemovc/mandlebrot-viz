import type { JuliaJob, JuliaResult } from "./jobs";
import { buildImageData } from "$lib/utils/colorPalettes";
import init, { compute_tile_f64_julia } from "$lib/wasm/mandelbrot.js";
import wasmUrl from "$lib/wasm/mandelbrot_bg.wasm?url";

const wasmReady = init(wasmUrl);

self.onmessage = async (e: MessageEvent<JuliaJob>) => {
  try {
    await wasmReady;
    const { id, cRe, cIm, viewCx, viewCy, scale, size, maxIter, power, colorConfig } = e.data;
    const iters = compute_tile_f64_julia(cRe, cIm, viewCx, viewCy, scale, size, size, maxIter, power);
    const imageData = buildImageData(iters, size, size, maxIter, colorConfig);
    const result: JuliaResult = { id, imageData };
    (self as unknown as Worker).postMessage(result, { transfer: [imageData.data.buffer] });
  } catch (err) {
    console.error("[julia worker] error:", err);
    self.reportError(err);
  }
};
