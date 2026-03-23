import type { RenderJob, TileResult } from './workerPool';
import { buildImageData } from '$lib/utils/colorPalettes';
import { getPrecisionBits } from '$lib/utils/precision';

type WasmModule = {
	compute_tile_f64: (cx: number, cy: number, scale: number, w: number, h: number, maxIter: number) => Float32Array;
	compute_tile_dd: (cx_hi: number, cx_lo: number, cy_hi: number, cy_lo: number, scale_hi: number, scale_lo: number, w: number, h: number, maxIter: number) => Float32Array;
	compute_tile_arb: (cx: string, cy: string, scale: string, bits: number, w: number, h: number, maxIter: number) => Float32Array;
};

let wasm: WasmModule | null = null;

async function initWasm(): Promise<WasmModule> {
	// Dynamic import of wasm-pack JS glue from static dir (runtime URL)
	// @ts-expect-error — no type declarations for runtime wasm output
	const mod = await import(/* @vite-ignore */ '/wasm/mandelbrot.js');
	await mod.default('/wasm/mandelbrot_bg.wasm');
	return mod as WasmModule;
}

const wasmPromise = initWasm().then((m) => { wasm = m; });

/** Split a float64 into high/low parts (Veltkamp) */
function split(x: number): [number, number] {
	const hi = Math.fround(x);
	const lo = x - hi;
	return [hi, lo];
}

self.onmessage = async (e: MessageEvent<RenderJob>) => {
	if (!wasm) await wasmPromise;
	const w = wasm!;

	const job = e.data;
	const { id, cx, cy, scale, tileSize, maxIter, precisionMode, colorConfig } = job;
	const sz = tileSize;

	let iters: Float32Array;

	if (precisionMode === 'f64') {
		iters = w.compute_tile_f64(
			parseFloat(cx), parseFloat(cy), parseFloat(scale),
			sz, sz, maxIter
		);
	} else if (precisionMode === 'double_double') {
		const [cxHi, cxLo] = split(parseFloat(cx));
		const [cyHi, cyLo] = split(parseFloat(cy));
		const [sHi, sLo] = split(parseFloat(scale));
		iters = w.compute_tile_dd(cxHi, cxLo, cyHi, cyLo, sHi, sLo, sz, sz, maxIter);
	} else {
		const bits = getPrecisionBits(Math.round(-Math.log2(parseFloat(scale))));
		iters = w.compute_tile_arb(cx, cy, scale, bits, sz, sz, maxIter);
	}

	const imageData = buildImageData(iters, sz, sz, maxIter, colorConfig);
	const result: TileResult = { id, imageData };

	// Transfer the underlying buffer for zero-copy
	(self as unknown as Worker).postMessage(result, { transfer: [imageData.data.buffer] });
};
