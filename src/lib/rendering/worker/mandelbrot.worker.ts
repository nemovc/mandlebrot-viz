import type { RenderJob, TileResult } from './workerPool';
import { buildImageData } from '$lib/utils/colorPalettes';
import { getPrecisionBits } from '$lib/utils/precision';
import init, {
	compute_tile_f64,
	compute_tile_dd,
	compute_tile_arb
} from '$lib/wasm/mandelbrot.js';
import wasmUrl from '$lib/wasm/mandelbrot_bg.wasm?url';

console.log('[worker] initialising, loading WASM from', wasmUrl);
const wasmReady = init(wasmUrl).then(() => {
	console.log('[worker] WASM ready');
});

/** Split a float64 into high/low parts (Veltkamp) */
function split(x: number): [number, number] {
	const hi = Math.fround(x);
	const lo = x - hi;
	return [hi, lo];
}

self.onmessage = async (e: MessageEvent<RenderJob>) => {
	await wasmReady;

	const { id, tileSize, maxIter, colorConfig, recolorOnly } = e.data;

	if (recolorOnly) {
		const imageData = buildImageData(e.data.iters!, tileSize, tileSize, maxIter, colorConfig);
		(self as unknown as Worker).postMessage({ id, imageData } satisfies TileResult, { transfer: [imageData.data.buffer] });
		return;
	}

	const { cx, cy, scale, precisionMode } = e.data;
	const sz = tileSize;

	console.log(`[worker] job ${id} | ${sz}×${sz} | ${precisionMode} | cx=${cx} cy=${cy} scale=${scale} maxIter=${maxIter}`);
	const t0 = performance.now();

	let iters: Float32Array;

	if (precisionMode === 'f64') {
		iters = compute_tile_f64(parseFloat(cx), parseFloat(cy), parseFloat(scale), sz, sz, maxIter);
	} else if (precisionMode === 'double_double') {
		const [cxHi, cxLo] = split(parseFloat(cx));
		const [cyHi, cyLo] = split(parseFloat(cy));
		const [sHi, sLo] = split(parseFloat(scale));
		iters = compute_tile_dd(cxHi, cxLo, cyHi, cyLo, sHi, sLo, sz, sz, maxIter);
	} else {
		const bits = getPrecisionBits(Math.round(-Math.log2(parseFloat(scale))));
		console.log(`[worker] arb precision: ${bits} bits`);
		iters = compute_tile_arb(cx, cy, scale, bits, sz, sz, maxIter);
	}

	const elapsed = (performance.now() - t0).toFixed(1);
	console.log(`[worker] job ${id} done in ${elapsed}ms`);

	const imageData = buildImageData(iters, sz, sz, maxIter, colorConfig);
	const result: TileResult = { id, imageData, iters };
	(self as unknown as Worker).postMessage(result, { transfer: [imageData.data.buffer, iters.buffer] });
};
