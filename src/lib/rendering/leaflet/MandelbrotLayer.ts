import type { ColorConfig } from '$lib/stores/viewerState.svelte';
import { getWorkerPool } from '$lib/rendering/worker/workerPool';
import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
import { buildImageData } from '$lib/utils/colorPalettes';

const TILE_SIZE = 256;
const STAGE2_SIZE = 64; // low-res quick pass

/** Returns a unique job id for a tile */
function tileId(x: number, y: number, z: number, stage: 2 | 3): string {
	return `${z}/${x}/${y}/s${stage}`;
}

export function createMandelbrotLayer(L: typeof import('leaflet')) {
	return L.GridLayer.extend({
		options: {
			tileSize: TILE_SIZE,
			maxZoom: 200,
			keepBuffer: 1
		},

		// Set by caller before adding to map
		maxIter: 256,
		colorConfig: null as ColorConfig | null,

		initialize(options: unknown) {
			(L.GridLayer.prototype as any).initialize?.call(this, options);
			(this as any)._itersCache = new Map<string, { iters: Float32Array; maxIter: number }>();
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

			// Stage 2: low-res quick tile
			const s2id = tileId(x, y, z, 2);
			pool.submit(
				{
					id: s2id,
					cx, cy,
					scale: scaleForZoom(z, STAGE2_SIZE).toString(),
					tileSize: STAGE2_SIZE,
					maxIter,
					precisionMode,
					colorConfig,
					priority: 0,
					stage: 2
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
					const s3id = tileId(x, y, z, 3);
					pool.submit(
						{
							id: s3id,
							cx, cy,
							scale: scale.toString(),
							tileSize: TILE_SIZE,
							maxIter,
							precisionMode,
							colorConfig,
							priority: 1,
							stage: 3
						},
						(finalResult) => {
							if (finalResult.iters) (this as any)._itersCache.set(`${z}/${x}/${y}`, { iters: finalResult.iters, maxIter });
							ctx.putImageData(finalResult.imageData, 0, 0);
						}
					);
				}
			);

			// Attach cleanup to canvas for cancellation
			(canvas as any)._tileIds = [s2id, tileId(x, y, z, 3)];
			return canvas;
		},

		/** Re-render all visible tiles in-place without removing them (no grey flash). */
		softRedraw() {
			const pool = getWorkerPool();
			const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
			const maxIter = this.maxIter;
			const tiles = (this as any)._tiles as Record<string, { el: HTMLCanvasElement; coords: { x: number; y: number; z: number } }>;
			const itersCache: Map<string, { iters: Float32Array; maxIter: number }> = (this as any)._itersCache;
			const tileCount = Object.keys(tiles).length;
			let fastCount = 0;
			let fullCount = 0;

			const t0 = performance.now();
			console.log(`[softRedraw] ${tileCount} tiles, maxIter=${maxIter}`);

			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const canvas = tile.el;
				const ctx = canvas.getContext('2d')!;
				const key = `${z}/${x}/${y}`;

				// Fast path: color-only change — copy cached iters to a worker, skip WASM
				const cached = itersCache.get(key);
				if (cached && cached.maxIter === maxIter) {
					const itersCopy = new Float32Array(cached.iters); // copy preserves cache
					const rcId = `${key}-rc-${Date.now()}`;
					pool.submit(
						{ id: rcId, recolorOnly: true, iters: itersCopy, tileSize: TILE_SIZE, maxIter, colorConfig,
						  cx: '', cy: '', scale: '', precisionMode: 'f64', priority: 0, stage: 3 },
						(result) => { ctx.putImageData(result.imageData, 0, 0); }
					);
					(canvas as any)._tileIds = [rcId];
					fastCount++;
					continue;
				}

				fullCount++;
				// Cancel any in-flight jobs for this tile
				const oldIds: string[] = (canvas as any)._tileIds || [];
				for (const id of oldIds) pool.cancel(id);

				const scale = scaleForZoom(z, TILE_SIZE);
				const tileUnits = scale * TILE_SIZE;
				const cx = (-4 + (x + 0.5) * tileUnits).toString();
				const cy = (-4 + (y + 0.5) * tileUnits).toString();
				const precisionMode = getPrecisionMode(z);

				const s3id = tileId(x, y, z, 3) + '-r' + Date.now();
				pool.submit(
					{ id: s3id, cx, cy, scale: scale.toString(), tileSize: TILE_SIZE, maxIter, precisionMode, colorConfig, priority: 0, stage: 3 },
					(result) => {
						if (result.iters) itersCache.set(key, { iters: result.iters, maxIter }); // update cache with new maxIter
						ctx.putImageData(result.imageData, 0, 0);
					}
				);
				(canvas as any)._tileIds = [s3id];
			}
			console.log(`[softRedraw] fast=${fastCount} full=${fullCount} (${(performance.now() - t0).toFixed(1)}ms)`);
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
