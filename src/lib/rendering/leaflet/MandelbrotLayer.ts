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
			const colorConfig = this.colorConfig!;
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
					priority: 0
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
							priority: 1
						},
						(finalResult) => {
							ctx.putImageData(finalResult.imageData, 0, 0);
						}
					);
				}
			);

			// Attach cleanup to canvas for cancellation
			(canvas as any)._tileIds = [s2id, tileId(x, y, z, 3)];
			return canvas;
		},

		_removeTile(key: string) {
			const tile = (this as any)._tiles[key];
			if (tile && tile.el) {
				const ids: string[] = (tile.el as any)._tileIds || [];
				const pool = getWorkerPool();
				for (const id of ids) pool.cancel(id);
			}
			// @ts-ignore — call parent
			L.GridLayer.prototype._removeTile.call(this, key);
		}
	});
}
