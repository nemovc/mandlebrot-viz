import type { ColorConfig } from '$lib/utils/colorPalettes';
import type { DoneCallback } from 'leaflet';
import { ViewerS2Pool } from '$lib/rendering/worker/pools/viewerS2Pool';
import { ViewerS3Pool } from '$lib/rendering/worker/pools/viewerS3Pool';
import { ViewerRecolorPool } from '$lib/rendering/worker/pools/viewerRecolorPool';
import { debugLog, debugState } from '$lib/stores/debugState.svelte';
import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
import { buildCdf, baseAlgorithm } from '$lib/utils/colorPalettes';

const TILE_SIZE = 256;
const STAGE2_SIZE = 64; // low-res quick pass

// Flash colors per render stage
const FLASH_S2 = 'rgba(40, 120, 255, 0.5)';
const FLASH_S3 = 'rgba(40, 200,  60, 0.5)';
const FLASH_RECOLOR = 'rgba(255, 160,   0, 0.5)';

type ItersCache = Map<
	string,
	{ iters: Float32Array; maxIter: number; power: number; algorithm: string }
>;

// Augment Leaflet's GridLayer with the internal properties we need.
declare module 'leaflet' {
	interface GridLayer {
		_removeTile(key: string): void;
	}
}

// Per-tile-element side data stored in a WeakMap to avoid untyped property
// writes on HTMLElement. activeJobs holds cancel closures so each job can be
// cancelled from its own pool without knowing which pool it belongs to.
type TileElementData = {
	canvas: HTMLCanvasElement;
	flashOverlay: HTMLDivElement;
	activeJobs: Array<{ id: string; cancel: () => void }>;
};
const tileData = new WeakMap<HTMLElement, TileElementData>();

/** Get the render canvas from a tile wrapper element. */
function tileCanvas(el: HTMLElement): HTMLCanvasElement {
	return tileData.get(el)?.canvas ?? (el as HTMLCanvasElement);
}

/** Flash a tile's overlay with a color, fading out over 0.4s. */
function flashTile(el: HTMLElement, color: string) {
	if (!debugState.showTileFlash) return;
	const overlay = tileData.get(el)?.flashOverlay;
	if (!overlay) return;
	overlay.style.transition = 'none';
	overlay.style.backgroundColor = color;
	overlay.style.opacity = '1';
	requestAnimationFrame(() =>
		requestAnimationFrame(() => {
			overlay.style.transition = 'opacity 0.4s ease-out';
			overlay.style.opacity = '0';
		})
	);
}

let _tileSeq = 0;
/** Returns unique job ids for a tile's rendering stages. */
function tileIds(x: number, y: number, z: number): { s2id: string; s3id: string; rcId: string } {
	const seq = ++_tileSeq;
	return {
		s2id: `${z}/${x}/${y}/s2-${seq}`,
		s3id: `${z}/${x}/${y}/s3-${seq}`,
		rcId: `${z}/${x}/${y}/rc-${seq}`
	};
}

export function createMandelbrotLayer(L: typeof import('leaflet')) {
	class MandelbrotLayer extends L.GridLayer {
		_itersCache: ItersCache = new Map();
		_lastCdf: Float32Array | null = null;
		_recolorTimer: ReturnType<typeof setTimeout> | null = null;

		// Set by caller before adding to map
		maxIter = 256;
		power = 2;
		colorConfig: ColorConfig | null = null;

		constructor(options?: L.GridLayerOptions) {
			super({ tileSize: TILE_SIZE, maxZoom: 200, keepBuffer: 1, ...options });
		}

		override createTile(
			coords: { x: number; y: number; z: number },
			done: DoneCallback
		): HTMLElement {
			const { x, y, z } = coords;

			const wrapper = document.createElement('div');
			wrapper.style.cssText = 'overflow:hidden;';

			const canvas = document.createElement('canvas');
			canvas.width = TILE_SIZE;
			canvas.height = TILE_SIZE;
			canvas.style.cssText = 'display:block;width:100%;height:100%;';
			wrapper.appendChild(canvas);

			const flashOverlay = document.createElement('div');
			flashOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;';
			wrapper.appendChild(flashOverlay);
			tileData.set(wrapper, { canvas, flashOverlay, activeJobs: [] });

			const ctx = canvas.getContext('2d')!;

			const scale = scaleForZoom(z, TILE_SIZE);
			const tileUnits = scale * TILE_SIZE;
			const cxNum = -4 + (x + 0.5) * tileUnits;
			const cyNum = -4 + (y + 0.5) * tileUnits;
			const cx = cxNum.toString();
			const cy = cyNum.toString();
			const precisionMode = getPrecisionMode(z);
			const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
			const maxIter = this.maxIter;
			const power = this.power;

			const { s2id, s3id } = tileIds(x, y, z);
			const lastCdf = this._lastCdf;

			const s2Pool = ViewerS2Pool.instance;
			const s3Pool = ViewerS3Pool.instance;

			// Stage 2: low-res quick tile
			s2Pool.submit(
				{
					id: s2id,
					cx,
					cy,
					scale: scaleForZoom(z, STAGE2_SIZE).toString(),
					tileW: STAGE2_SIZE,
					tileH: STAGE2_SIZE,
					maxIter,
					power,
					precisionMode,
					colorConfig,
					cdf: lastCdf ? new Float32Array(lastCdf) : undefined,
					priority: 0,
					debug: debugState.debugLogging,
					slow: debugState.slowMode
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
					done(undefined, wrapper);
					flashTile(wrapper, FLASH_S2);

					// Stage 3: full-res refinement
					s3Pool.submit(
						{
							id: s3id,
							cx,
							cy,
							scale: scale.toString(),
							tileW: TILE_SIZE,
							tileH: TILE_SIZE,
							maxIter,
							power,
							precisionMode,
							colorConfig,
							cdf: lastCdf ? new Float32Array(lastCdf) : undefined,
							priority: 1,
							debug: debugState.debugLogging,
							slow: debugState.slowMode
						},
						(finalResult) => {
							if (finalResult.iters)
								this._itersCache.set(`${z}/${x}/${y}`, {
									iters: finalResult.iters,
									maxIter,
									power,
									algorithm: colorConfig.algorithm
								});
							ctx.putImageData(finalResult.imageData, 0, 0);
							flashTile(wrapper, FLASH_S3);
							if (this.colorConfig && baseAlgorithm(this.colorConfig.algorithm) === 'histogram') {
								if (ViewerS3Pool.instance.pending === 1) this._rebuildHistogramAndRecolor();
							}
						}
					);
				}
			);

			tileData.get(wrapper)!.activeJobs = [
				{ id: s2id, cancel: () => s2Pool.cancel(s2id) },
				{ id: s3id, cancel: () => s3Pool.cancel(s3id) }
			];
			return wrapper;
		}

		/** Recolor all visible tiles via the dedicated recolor worker pool. */
		recolor() {
			const pool = ViewerRecolorPool.instance;
			if (this._recolorTimer) clearTimeout(this._recolorTimer);

			this._recolorTimer = setTimeout(() => {
				this._recolorTimer = null;

				if (this.colorConfig && baseAlgorithm(this.colorConfig.algorithm) === 'histogram') {
					this._rebuildHistogramAndRecolor();
					return;
				}

				pool.cancelAll();

				const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
				const maxIter = this.maxIter;
				const power = this.power;
				const tiles = this._tiles;
				const tileCount = Object.keys(tiles).length;
				let submittedCount = 0;
				let skippedNoCache = 0;
				let skippedMismatch = 0;

				const t0 = performance.now();
				for (const tile of Object.values(tiles)) {
					const { x, y, z } = tile.coords;
					const canvas = tile.el;
					const cached = this._itersCache.get(`${z}/${x}/${y}`);
					if (!cached) {
						skippedNoCache++;
						continue;
					}
					if (cached.maxIter !== maxIter || cached.power !== power) {
						skippedMismatch++;
						continue;
					}
					const isDem = (a: string) =>
						baseAlgorithm(a as ColorConfig['algorithm']) === 'distance_estimation';
					if (isDem(cached.algorithm) !== isDem(colorConfig.algorithm)) {
						skippedNoCache++;
						continue;
					}

					const { rcId } = tileIds(x, y, z);
					const iters = new Float32Array(cached.iters);
					pool.submit(
						{
							id: rcId,
							iters,
							tileW: TILE_SIZE,
							tileH: TILE_SIZE,
							maxIter,
							colorConfig,
							priority: 0,
							slow: debugState.slowMode
						},
						(result) => {
							tileCanvas(canvas).getContext('2d')!.putImageData(result.imageData, 0, 0);
							flashTile(canvas, FLASH_RECOLOR);
						},
						[iters.buffer]
					);
					tileData.get(canvas)!.activeJobs = [{ id: rcId, cancel: () => pool.cancel(rcId) }];
					submittedCount++;
				}
				debugLog(
					() =>
						`[recolor] submitted ${submittedCount}/${tileCount}, ` +
						`skipped ${skippedNoCache} no-cache, ${skippedMismatch} mismatch ` +
						`(${(performance.now() - t0).toFixed(1)}ms to submit)`
				);
			}, 50);
		}

		/** Recompute all visible tiles via workers (used when maxIter or power changes). */
		recompute() {
			this._lastCdf = null;
			const s3Pool = ViewerS3Pool.instance;
			const rcPool = ViewerRecolorPool.instance;
			const colorConfig = JSON.parse(JSON.stringify(this.colorConfig!));
			const maxIter = this.maxIter;
			const power = this.power;
			const tiles = this._tiles;
			const tileCount = Object.keys(tiles).length;

			const t0 = performance.now();
			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const canvas = tile.el;
				const key = `${z}/${x}/${y}`;

				for (const { cancel } of tileData.get(canvas)?.activeJobs ?? []) cancel();

				const scale = scaleForZoom(z, TILE_SIZE);
				const tileUnits = scale * TILE_SIZE;
				const cx = (-4 + (x + 0.5) * tileUnits).toString();
				const cy = (-4 + (y + 0.5) * tileUnits).toString();
				const precisionMode = getPrecisionMode(z);

				const { s3id } = tileIds(x, y, z);
				s3Pool.submit(
					{
						id: s3id,
						cx,
						cy,
						scale: scale.toString(),
						tileW: TILE_SIZE,
						tileH: TILE_SIZE,
						maxIter,
						power,
						precisionMode,
						colorConfig,
						priority: 0,
						debug: debugState.debugLogging,
						slow: debugState.slowMode
					},
					(result) => {
						if (result.iters)
							this._itersCache.set(key, {
								iters: result.iters,
								maxIter,
								power,
								algorithm: colorConfig.algorithm
							});
						const liveConfig = JSON.parse(JSON.stringify(this.colorConfig!));
						if (baseAlgorithm(liveConfig.algorithm) === 'histogram') {
							tileCanvas(canvas).getContext('2d')!.putImageData(result.imageData, 0, 0);
							flashTile(canvas, FLASH_S3);
							if (ViewerS3Pool.instance.pending === 1) this._rebuildHistogramAndRecolor();
							return;
						}
						if (result.iters && liveConfig.algorithm === colorConfig.algorithm) {
							const { rcId } = tileIds(x, y, z);
							const iters = new Float32Array(result.iters);
							rcPool.submit(
								{
									id: rcId,
									iters,
									tileW: TILE_SIZE,
									tileH: TILE_SIZE,
									maxIter,
									colorConfig: liveConfig,
									priority: 0,
									slow: debugState.slowMode
								},
								(rc) => {
									tileCanvas(canvas).getContext('2d')!.putImageData(rc.imageData, 0, 0);
									flashTile(canvas, FLASH_RECOLOR);
								},
								[iters.buffer]
							);
							const data = tileData.get(canvas);
							if (data) data.activeJobs = [{ id: rcId, cancel: () => rcPool.cancel(rcId) }];
						} else {
							tileCanvas(canvas).getContext('2d')!.putImageData(result.imageData, 0, 0);
							flashTile(canvas, FLASH_S3);
						}
					}
				);
				const data = tileData.get(canvas);
				if (data) data.activeJobs = [{ id: s3id, cancel: () => s3Pool.cancel(s3id) }];
			}
			debugLog(
				() => `[recompute] ${tileCount} tiles submitted (${(performance.now() - t0).toFixed(1)}ms)`
			);
		}

		_rebuildHistogramAndRecolor() {
			const liveConfig = this.colorConfig;
			if (!liveConfig || baseAlgorithm(liveConfig.algorithm) !== 'histogram') return;

			const tiles = this._tiles;
			const maxIter = this.maxIter;
			const power = this.power;

			const arrays: Float32Array[] = [];
			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const cached = this._itersCache.get(`${z}/${x}/${y}`);
				if (cached && cached.maxIter === maxIter && cached.power === power) {
					arrays.push(cached.iters);
				}
			}
			if (arrays.length === 0) return;

			const cdf = buildCdf(arrays, maxIter);
			this._lastCdf = cdf;
			const colorConfig = JSON.parse(JSON.stringify(liveConfig));
			const pool = ViewerRecolorPool.instance;
			pool.cancelAll();

			for (const tile of Object.values(tiles)) {
				const { x, y, z } = tile.coords;
				const canvas = tile.el;
				const cached = this._itersCache.get(`${z}/${x}/${y}`);
				if (!cached || cached.maxIter !== maxIter || cached.power !== power) continue;

				const { rcId } = tileIds(x, y, z);
				const iters = new Float32Array(cached.iters);
				pool.submit(
					{
						id: rcId,
						iters,
						tileW: TILE_SIZE,
						tileH: TILE_SIZE,
						maxIter,
						colorConfig,
						cdf: new Float32Array(cdf),
						priority: 0,
						slow: debugState.slowMode
					},
					(result) => {
						tileCanvas(canvas).getContext('2d')!.putImageData(result.imageData, 0, 0);
						flashTile(canvas, FLASH_RECOLOR);
					},
					[iters.buffer]
				);
				const data = tileData.get(canvas);
				if (data) data.activeJobs = [{ id: rcId, cancel: () => pool.cancel(rcId) }];
			}
		}

		override _removeTile(key: string) {
			const tile = this._tiles[key];
			if (tile?.el) {
				for (const { cancel } of tileData.get(tile.el)?.activeJobs ?? []) cancel();
				if (tile.coords) {
					const { x, y, z } = tile.coords;
					this._itersCache.delete(`${z}/${x}/${y}`);
				}
			}
			super._removeTile(key);
		}
	}

	return MandelbrotLayer;
}

export type MandelbrotLayerInstance = InstanceType<ReturnType<typeof createMandelbrotLayer>>;
