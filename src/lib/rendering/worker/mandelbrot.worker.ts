import type { ComputeJob, ComputeResult } from "./jobs";
import { buildImageData, baseAlgorithm } from "$lib/utils/colorPalettes";
import { getPrecisionBits } from "$lib/utils/precision";
import init, {
  compute_tile_f64,
  compute_tile_f64_dem,
  compute_tile_dd,
  compute_tile_dd_dem,
  compute_tile_arb,
  compute_tile_arb_dem,
} from "$lib/wasm/mandelbrot.js";
import wasmUrl from "$lib/wasm/mandelbrot_bg.wasm?url";


console.log("[worker] initialising, loading WASM from", wasmUrl);
const wasmReady = init(wasmUrl).then(() => {
  console.log("[worker] WASM ready");
});

/** Split a float64 into high/low parts (Veltkamp) */
function split(x: number): [number, number] {
  const hi = Math.fround(x);
  const lo = x - hi;
  return [hi, lo];
}

self.onmessage = async (e: MessageEvent<ComputeJob>) => {
  try {
    await wasmReady;
    if (e.data.slow) await new Promise((r) => setTimeout(r, 300));

    const { id, tileW, tileH, maxIter, colorConfig } = e.data;
    const { cx, cy, scale, precisionMode, power, debug } = e.data;

    if (debug) console.log(
      `[worker] job ${id} | ${tileW}×${tileH} | ${precisionMode} | cx=${cx} cy=${cy} scale=${scale} maxIter=${maxIter} power=${power}`,
    );
    const t0 = performance.now();

    let iters: Float32Array;
    const isDem = baseAlgorithm(colorConfig.algorithm) === 'distance_estimation';

    if (precisionMode === "f64") {
      iters = isDem
        ? compute_tile_f64_dem(parseFloat(cx), parseFloat(cy), parseFloat(scale), tileW, tileH, maxIter, power)
        : compute_tile_f64(parseFloat(cx), parseFloat(cy), parseFloat(scale), tileW, tileH, maxIter, power);
    } else if (precisionMode === "double_double") {
      const [cxHi, cxLo] = split(parseFloat(cx));
      const [cyHi, cyLo] = split(parseFloat(cy));
      const [sHi, sLo] = split(parseFloat(scale));
      iters = isDem
        ? compute_tile_dd_dem(cxHi, cxLo, cyHi, cyLo, sHi, sLo, tileW, tileH, maxIter, power)
        : compute_tile_dd(cxHi, cxLo, cyHi, cyLo, sHi, sLo, tileW, tileH, maxIter, power);
    } else {
      const bits = getPrecisionBits(Math.round(-Math.log2(parseFloat(scale))));
      console.log(`[worker] arb precision: ${bits} bits`);
      iters = isDem
        ? compute_tile_arb_dem(cx, cy, scale, bits, tileW, tileH, maxIter, power)
        : compute_tile_arb(cx, cy, scale, bits, tileW, tileH, maxIter, power);
    }

    const elapsed = (performance.now() - t0).toFixed(1);
    if (debug) console.log(`[worker] job ${id} done in ${elapsed}ms`);

    const imageData = buildImageData(iters, tileW, tileH, maxIter, colorConfig, e.data.cdf);
    const result: ComputeResult = { id, imageData, iters };
    (self as unknown as Worker).postMessage(result, {
      transfer: [imageData.data.buffer, iters.buffer],
    });
  } catch (err) {
    console.error("[worker] unhandled error:", err);
    self.reportError(err);
  }
};
