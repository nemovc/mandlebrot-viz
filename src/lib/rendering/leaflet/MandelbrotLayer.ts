import type { ColorConfig } from '$lib/stores/viewerState.svelte';
import { getWorkerPool, getRecolorPool } from '$lib/rendering/worker/workerPool';
import { debugLog, debugState } from '$lib/stores/debugState.svelte';
import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
import { buildCdf, baseAlgorithm } from '$lib/utils/colorPalettes';

const TILE_SIZE = 256;
const STAGE2_SIZE = 64; // low-res quick pass

let _tileSeq = 0;
/** Returns unique job ids for a tile's rendering stages. */
function tileIds(x: number, y: number, z: number): { s2id: string; s3id: string; rcId: string } {
	const seq = ++_tileSeq;
	return {
		s2id: `${z}/${x}/${y}/s2-${seq}`,
		s3id: `${z}/${x}/${y}/s3-${seq}`,
		rcId: `${z}/${x}/${y}/rc-${seq}`,
	};
}

type ItersCache = Map<string, { iters: Float32Array; maxIter: number; power: number; algorithm: string }>;

export function createMandelbrotLayer(L: typeof import('leaflet')) {
	return L.GridLayer.extend({
		options: {
			tileSize: TILE_SIZE,
			maxZoom: 200,
			keepBuffer: 1
		},

		// Set by caller before adding to map
		maxIter: 256,
		power: 2,
		colorConfig: null as ColorConfig | null,

		initialize(options: unknown) {
			(L.GridLayer.prototype as any).initialize?.call(this, options);
			(this as any)._itersCache = new Map() as ItersCache;
		},

		createTile(coords: { x: number; y: number; z: number }, done: (err: Error | null, tile: HTMLElement) => void) {
			const { x, y, z } = coords;
			const canvas = document.createElement('canvas');
			canvas.width = TILE_SIZE;
			canvas.height = TILE_SIZE;
			const ctx = canvas.getContext('2d')!;

			const scale = scaleForZoom(z, TILE_SIZE); // complex units/pixel
			const tileUnits = scale * TILE_SIZE;
			const cxNum = -4 + (x + 0.5) * tileUnits;
			const cyNum = -4 + (y + 0.5) * tileUnits;
			const cx = cxNum.toString();
			const cy = cyNum.toString();
			const precisionMode = getPrecisionMode(z);
			const pool = getWorkerPool();
			// Snapshot to a plain object — colorConfig may be a Svelte $state Proxy
			// which cannot be structured-cloned across postMessage.
			const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
			const maxIter = this.maxIter;
			const power = this.power;

			const { s2id, s3id } = tileIds(x, y, z);

			// Stage 2: low-res quick tile
			pool.submit(
				{
					id: s2id,
					cx, cy,
					scale: scaleForZoom(z, STAGE2_SIZE).toString(),
					tileSize: STAGE2_SIZE,
					maxIter,
					power,
					precisionMode,
					colorConfig,
					priority: 0,
					stage: 2,
					debug: debugState.debugLogging,
					slow: debugState.slowMode,
				},
				(result) => {
					// Upscale 64→256 via drawImage
					const tmpCanvas = document.createElement('canvas');
					tmpCanvas.width = STAGE2_SIZE;
					tmpCanvas.height = STAGE2_SIZE;
					tmpCanvas.getContext('2d')!.putImageData(result.imageData, 0, 0);
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(tmpCanvas, 0, 0, TILE_SIZE, TILE_SIZE);
					done(null, canvas);

					// Stage 3: full-res refinement
					pool.submit(
						{
							id: s3id,
							cx, cy,
							scale: scale.toString(),
							tileSize: TILE_SIZE,
							maxIter,
							power,
							precisionMode,
							colorConfig,
							priority: 1,
							stage: 3,
							debug: debugState.debugLogging,
							slow: debugState.slowMode,
						},
						(finalResult) => {
							if (finalResult.iters) (this as any)._itersCache.set(`${z}/${x}/${y}`, { iters: finalResult.iters, maxIter, power, algorithm: colorConfig.algorithm });
							if ((this as any).colorConfig && baseAlgorithm((this as any).colorConfig.algorithm) === 'histogram') {
								(this as any)._rebuildHistogramAndRecolor(true);
							} else {
								ctx.putImageData(finalResult.imageData, 0, 0);
							}
						}
					);
				}
			);

			// Attach cleanup to canvas for cancellation
			(canvas as any)._tileIds = [s2id, s3id];
			return canvas;
		},

		/** Recolor all visible tiles via the dedicated recolor worker pool. */
		recolor() {
			const pool = getRecolorPool();
			if ((this as any)._recolorTimer) clearTimeout((this as any)._recolorTimer);

			(this as any)._recolorTimer = setTimeout(() => {
				(this as any)._recolorTimer = null;

				if (this.colorConfig && baseAlgorithm(this.colorConfig.algorithm) === 'histogram') {
					(this as any)._rebuildHistogramAndRecolor();
					return;
				}

				// Clear any queued recolor jobs — pool is exclusively for recolor so this is safe
				pool.cancelAll();

				const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
				const maxIter = this.maxIter;
				const power = this.power;
				const tiles = (this as any)._tiles as Record<string, { el: HTMLCanvasElement; coords: { x: number; y: number; z: number } }>;
				const itersCache = (this as any)._itersCache as ItersCache;
				const tileCount = Object.keys(tiles).length;
				let submittedCount = 0;
				let skippedNoCache = 0;
				let skippedMismatch = 0;

				const t0 = performance.now();
				for (const tile of Object.values(tiles)) {
					const { x, y, z } = tile.coords;
					const canvas = tile.el;
					const cached = itersCache.get(`${z}/${x}/${y}`);
					if (!cached) { skippedNoCache++; continue; }
					if (cached.maxIter !== maxIter || cached.power !== power) { skippedMismatch++; continue; }
					if (baseAlgorithm(cached.algorithm) !== baseAlgorithm(colorConfig.algorithm)) { skippedNoCache++; continue; }

					const { rcId } = tileIds(x, y, z);
					pool.submit(
						{ id: rcId, recolorOnly: true, iters: new Float32Array(cached.iters), tileSize: TILE_SIZE, maxIter, power,
						  colorConfig, cx: '', cy: '', scale: '', precisionMode: 'f64', priority: 0, stage: 3, slow: debugState.slowMode },
						(result) => { canvas.getContext('2d')!.putImageData(result.imageData, 0, 0); }
					);
					(canvas as any)._tileIds = [rcId];
					submittedCount++;
				}
				debugLog(() =>
					`[recolor] submitted ${submittedCount}/${tileCount}, ` +
					`skipped ${skippedNoCache} no-cache, ${skippedMismatch} mismatch ` +
					`(${(performance.now() - t0).toFixed(1)}ms to submit)`
				);
			}, 50);
		},

		/** Recompute all visible tiles via workers (used when maxIter or power changes). */
		recompute() {
			const pool = getWorkerPool();
			const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
			const maxIter = this.maxIter;
			const power = this.power;
			const tiles = (this as any)._tiles as Record<string, { el: HTMLCanvasElement; coords: { x: number; y: number; z: number } }>;
			const itersCache = (this as any)._itersCache as ItersCache;
			const tileCount = Object.keys(tiles).length;

			const t0 = performance.now();
			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const canvas = tile.el;
				const key = `${z}/${x}/${y}`;

				const oldIds: string[] = (canvas as any)._tileIds || [];
				for (const id of oldIds) pool.cancel(id);

				const scale = scaleForZoom(z, TILE_SIZE);
				const tileUnits = scale * TILE_SIZE;
				const cx = (-4 + (x + 0.5) * tileUnits).toString();
				const cy = (-4 + (y + 0.5) * tileUnits).toString();
				const precisionMode = getPrecisionMode(z);

				const { s3id } = tileIds(x, y, z);
				pool.submit(
					{ id: s3id, cx, cy, scale: scale.toString(), tileSize: TILE_SIZE, maxIter, power, precisionMode, colorConfig, priority: 0, stage: 3, debug: debugState.debugLogging, slow: debugState.slowMode },
					(result) => {
						if (result.iters) itersCache.set(key, { iters: result.iters, maxIter, power, algorithm: colorConfig.algorithm });
						// Color settings may have changed while this job was in flight — recolor to latest.
						const liveConfig = JSON.parse(JSON.stringify((this as any).colorConfig!));
						if (baseAlgorithm(liveConfig.algorithm) === 'histogram') {
							(this as any)._rebuildHistogramAndRecolor(true);
							return;
						}
						if (result.iters && liveConfig.algorithm === colorConfig.algorithm) {
							const { rcId } = tileIds(x, y, z);
							getRecolorPool().submit(
								{ id: rcId, recolorOnly: true, iters: new Float32Array(result.iters),
								  tileSize: TILE_SIZE, maxIter, power, colorConfig: liveConfig,
								  cx: '', cy: '', scale: '', precisionMode: 'f64', priority: 0, stage: 3, slow: debugState.slowMode },
								(rc) => { canvas.getContext('2d')!.putImageData(rc.imageData, 0, 0); }
							);
							(canvas as any)._tileIds = [rcId];
						} else {
							canvas.getContext('2d')!.putImageData(result.imageData, 0, 0);
						}
					}
				);
				(canvas as any)._tileIds = [s3id];
			}
			debugLog(() => `[recompute] ${tileCount} tiles submitted (${(performance.now() - t0).toFixed(1)}ms)`);
		},

		/** @param calledFromTileCallback - true when called from within a worker result callback,
		 *  where the pool hasn't decremented pending[3] yet. In that case s3Pending === 1
		 *  means "this is the last tile". */
		_rebuildHistogramAndRecolor(calledFromTileCallback = false) {
			const s3Pending = getWorkerPool().s3Pending;
			if (s3Pending > (calledFromTileCallback ? 1 : 0)) return;

			const liveConfig: ColorConfig | null = (this as any).colorConfig;
			if (!liveConfig || baseAlgorithm(liveConfig.algorithm) !== 'histogram') return;

			const tiles = (this as any)._tiles as Record<string, { el: HTMLCanvasElement; coords: { x: number; y: number; z: number } }>;
			const itersCache = (this as any)._itersCache as ItersCache;
			const maxIter = this.maxIter;
			const power = this.power;

			const arrays: Float32Array[] = [];
			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const cached = itersCache.get(`${z}/${x}/${y}`);
				if (cached && cached.maxIter === maxIter && cached.power === power) {
					arrays.push(cached.iters);
				}
			}
			if (arrays.length === 0) return;

			const cdf = buildCdf(arrays, maxIter);
			const colorConfig = JSON.parse(JSON.stringify(liveConfig));
			const pool = getRecolorPool();
			pool.cancelAll();

			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const canvas = tile.el;
				const cached = itersCache.get(`${z}/${x}/${y}`);
				if (!cached || cached.maxIter !== maxIter || cached.power !== power) continue;

				const { rcId } = tileIds(x, y, z);
				pool.submit(
					{
						id: rcId, recolorOnly: true,
						iters: new Float32Array(cached.iters),
						tileSize: TILE_SIZE, maxIter, power, colorConfig,
						cx: '', cy: '', scale: '', precisionMode: 'f64', priority: 0, stage: 3,
						cdf: new Float32Array(cdf),
					},
					(result) => { canvas.getContext('2d')!.putImageData(result.imageData, 0, 0); }
				);
				(canvas as any)._tileIds = [rcId];
			}
		},

		_removeTile(key: string) {
			const tile = (this as any)._tiles[key];
			if (tile && tile.el) {
				const ids: string[] = (tile.el as any)._tileIds || [];
				const pool = getWorkerPool();
				for (const id of ids) pool.cancel(id);
				// Evict cached iters so stale data doesn't linger
				if (tile.coords) {
					const { x, y, z } = tile.coords;
					(this as any)._itersCache.delete(`${z}/${x}/${y}`);
				}
			}
			// @ts-ignore — call parent
			L.GridLayer.prototype._removeTile.call(this, key);
		}
	});
}
