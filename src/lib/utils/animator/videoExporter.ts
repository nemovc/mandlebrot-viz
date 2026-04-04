import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { getWorkerPool, getRecolorPool } from '$lib/rendering/worker/workerPool';
import { interpolateAll } from '$lib/utils/animator/interpolation';
import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
import { buildCdf, baseAlgorithm } from '$lib/utils/colorPalettes';
import type { AnimationProject } from '$lib/stores/animationState.svelte';
import type { ColorConfig } from '$lib/stores/viewerState.svelte';

export interface ExportProgress {
	phase: 'rendering' | 'encoding';
	frame: number;
	totalFrames: number;
}

export async function exportWebM(
	project: AnimationProject,
	onProgress: (p: ExportProgress) => void,
	signal: AbortSignal,
): Promise<Blob> {
	const { width, height, fps, totalFrames } = project;
	const TILE = 256;

	const target = new ArrayBufferTarget();
	const muxer = new Muxer({
		target,
		video: {
			codec: 'V_VP9',
			width,
			height,
			frameRate: fps,
		},
	});

	const encoder = new VideoEncoder({
		output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
		error: (e) => {
			throw e;
		},
	});

	encoder.configure({
		codec: 'vp09.00.10.08',
		width,
		height,
		bitrate: 8_000_000,
		latencyMode: 'quality',
	});

	const offscreen = new OffscreenCanvas(width, height);
	const ctx = offscreen.getContext('2d')!;
	const pool = getWorkerPool();
	const tilesX = Math.ceil(width / TILE);
	const tilesY = Math.ceil(height / TILE);
	const tileCount = tilesX * tilesY;

	for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
		if (signal.aborted) {
			encoder.close();
			throw new DOMException('Export cancelled', 'AbortError');
		}

		onProgress({ phase: 'rendering', frame: frameNum, totalFrames });

		const state = interpolateAll(project, frameNum);
		const zoom = state.zoom;
		const cxCenter = parseFloat(state.cx);
		const cyCenter = parseFloat(state.cy);
		const scale = scaleForZoom(zoom, TILE);
		const precisionMode = getPrecisionMode(zoom);
		const colorConfig: ColorConfig = JSON.parse(JSON.stringify(state.colors));
		const maxIter = state.maxIter;
		const power = state.power;
		const batchId = `webm-${frameNum}`;
		const jobIds: string[] = [];
		const isHistogram = baseAlgorithm(colorConfig.algorithm) === 'histogram';
		const tileIters = new Map<string, Float32Array>();

		ctx.clearRect(0, 0, width, height);

		// Pass 1: render all tiles (placeholder coloring for histogram)
		await new Promise<void>((resolve, reject) => {
			if (signal.aborted) {
				reject(new DOMException('Export cancelled', 'AbortError'));
				return;
			}

			let done = 0;

			for (let ty = 0; ty < tilesY; ty++) {
				for (let tx = 0; tx < tilesX; tx++) {
					const tileCx = (
						cxCenter + (tx * TILE + TILE / 2 - width / 2) * scale
					).toString();
					const tileCy = (
						cyCenter + (ty * TILE + TILE / 2 - height / 2) * scale
					).toString();
					const id = `${batchId}-${tx}-${ty}`;
					jobIds.push(id);

					pool.submit(
						{
							id,
							cx: tileCx,
							cy: tileCy,
							scale: scale.toString(),
							tileSize: TILE,
							maxIter,
							power,
							precisionMode,
							colorConfig,
							priority: 0,
							stage: 3,
						},
						(result) => {
							ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
							if (isHistogram && result.iters) tileIters.set(`${tx},${ty}`, result.iters);
							done++;
							if (done === tileCount) resolve();
						},
					);
				}
			}
		}).catch((err) => {
			for (const id of jobIds) pool.cancel(id);
			throw err;
		});

		// Pass 2 (histogram only): build global CDF and recolor all tiles
		if (isHistogram && tileIters.size > 0) {
			if (signal.aborted) {
				encoder.close();
				throw new DOMException('Export cancelled', 'AbortError');
			}
			const cdf = buildCdf([...tileIters.values()], maxIter);
			const rcPool = getRecolorPool();
			const rcJobIds: string[] = [];
			await new Promise<void>((resolve, reject) => {
				let done = 0;
				const count = tileIters.size;
				for (let ty = 0; ty < tilesY; ty++) {
					for (let tx = 0; tx < tilesX; tx++) {
						const iters = tileIters.get(`${tx},${ty}`);
						if (!iters) continue;
						const rcId = `${batchId}-rc-${tx}-${ty}`;
						rcJobIds.push(rcId);
						rcPool.submit(
							{
								id: rcId, recolorOnly: true, iters: new Float32Array(iters),
								tileSize: TILE, maxIter, power, colorConfig, cdf,
								cx: '', cy: '', scale: '', precisionMode: 'f64', priority: 0, stage: 3,
							},
							(result) => {
								ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
								done++;
								if (done === count) resolve();
							},
						);
					}
				}
			}).catch((err) => {
				for (const id of rcJobIds) rcPool.cancel(id);
				throw err;
			});
		}

		if (signal.aborted) {
			encoder.close();
			throw new DOMException('Export cancelled', 'AbortError');
		}

		onProgress({ phase: 'encoding', frame: frameNum, totalFrames });

		const timestamp = Math.round((frameNum / fps) * 1_000_000);
		const duration = Math.round((1 / fps) * 1_000_000);
		const vf = new VideoFrame(offscreen, { timestamp, duration });
		encoder.encode(vf, { keyFrame: frameNum % 30 === 0 });
		vf.close();

		// Yield to browser periodically to keep UI responsive
		if (frameNum % 5 === 0) await new Promise((r) => setTimeout(r, 0));
	}

	await encoder.flush();
	muxer.finalize();

	const buffer = target.buffer;
	return new Blob([buffer], { type: 'video/webm' });
}
