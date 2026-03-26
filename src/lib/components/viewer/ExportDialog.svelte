<script lang="ts">
	import { onDestroy } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { encodeState } from '$lib/utils/urlSerializer';
	import { getWorkerPool } from '$lib/rendering/worker/workerPool';
	import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
	import { PRESETS } from '$lib/utils/colorPalettes';
	import type { ColorConfig } from '$lib/stores/viewerState.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const resolutions = [
		{ label: '256×256', w: 256, h: 256 },
		{ label: `Current view (${window.innerWidth}×${window.innerHeight})`, w: window.innerWidth, h: window.innerHeight },
		{ label: '1920×1080 (FHD)', w: 1920, h: 1080 },
		{ label: '3840×2160 (4K)', w: 3840, h: 2160 },
		{ label: '7680×4320 (8K)', w: 7680, h: 4320 },
	];

	let selectedRes = $state(1);
	let showOverlay = $state(false);
	let shareUrl = $state('');

	type Phase = 'idle' | 'exporting' | 'done';
	let phase = $state<Phase>('idle');
	let progress = $state(0);
	let resultUrl = $state('');
	let resultFilename = $state('');
	let cancelFn: (() => void) | null = null;

	onDestroy(() => { if (resultUrl) URL.revokeObjectURL(resultUrl); });

	function copyShareLink() {
		const encoded = encodeState(viewerState.toJSON());
		const url = `${location.origin}${location.pathname}#${encoded}`;
		shareUrl = url;
		navigator.clipboard.writeText(url);
	}

	function saveFile() {
		const a = document.createElement('a');
		a.href = resultUrl;
		a.download = resultFilename;
		a.click();
	}

	function reset() {
		URL.revokeObjectURL(resultUrl);
		resultUrl = '';
		phase = 'idle';
	}

	function drawOverlay(
		ctx: OffscreenCanvasRenderingContext2D,
		w: number, h: number,
		cx: string, cy: string, zoom: number, maxIter: number, colorConfig: ColorConfig
	) {
		const fontSize = Math.max(12, Math.round(Math.min(w, h) / 50));
		const pad = fontSize;
		const lineH = fontSize * 1.6;

		const paletteName = Object.entries(PRESETS).find(
			([, p]) => JSON.stringify(p) === JSON.stringify(colorConfig)
		)?.[0] ?? 'Custom';

		const lines = [
			`Center: (${cx}, ${cy})`,
			`Zoom: ${zoom}`,
			`Max iterations: ${maxIter}`,
			`Palette: ${paletteName}`,
			`Cycle period: ${colorConfig.cyclePeriod}`,
			`Offset: ${colorConfig.offset.toFixed(3)}`,
		];

		ctx.font = `${fontSize}px monospace`;
		const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
		const boxW = textWidth + pad * 2;
		const boxH = lines.length * lineH + pad * 1.5;

		ctx.fillStyle = 'rgba(0,0,0,0.65)';
		ctx.fillRect(pad / 2, h - boxH - pad / 2, boxW, boxH);
		ctx.fillStyle = 'white';
		lines.forEach((line, i) => {
			ctx.fillText(line, pad, h - boxH - pad / 2 + pad + i * lineH + fontSize);
		});
	}

	async function exportPng() {
		const { w, h } = resolutions[selectedRes];
		phase = 'exporting';
		progress = 0;

		const TILE = 256;
		const tilesX = Math.ceil(w / TILE);
		const tilesY = Math.ceil(h / TILE);
		const total = tilesX * tilesY;

		const offscreen = new OffscreenCanvas(w, h);
		const ctx = offscreen.getContext('2d')!;

		const zoom = viewerState.zoom;
		const cx = viewerState.cx;
		const cy = viewerState.cy;
		const scale = scaleForZoom(zoom, TILE);
		const precisionMode = getPrecisionMode(zoom);
		const pool = getWorkerPool();
		const cxCenter = parseFloat(cx);
		const cyCenter = parseFloat(cy);
		const colorConfig: ColorConfig = JSON.parse(JSON.stringify(viewerState.colors));
		const maxIter = viewerState.maxIter;
		const exportId = Date.now();
		const jobIds: string[] = [];

		try {
			await new Promise<void>((resolve, reject) => {
				cancelFn = () => {
					for (const id of jobIds) pool.cancel(id);
					reject(new Error('cancelled'));
				};

				if (total === 0) { resolve(); return; }
				let done = 0;

				for (let ty = 0; ty < tilesY; ty++) {
					for (let tx = 0; tx < tilesX; tx++) {
						const tileCx = (cxCenter + (tx * TILE + TILE / 2 - w / 2) * scale).toString();
						const tileCy = (cyCenter + (ty * TILE + TILE / 2 - h / 2) * scale).toString();
						const id = `export-${exportId}-${tx}-${ty}`;
						jobIds.push(id);

						pool.submit(
							{ id, cx: tileCx, cy: tileCy, scale: scale.toString(), tileSize: TILE,
							  maxIter, precisionMode, colorConfig, priority: 0, stage: 3 },
							(result) => {
								ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
								done++;
								progress = done / total;
								if (done === total) resolve();
							}
						);
					}
				}
			});

			if (showOverlay) drawOverlay(ctx, w, h, cx, cy, zoom, maxIter, colorConfig);

			const blob = await offscreen.convertToBlob({ type: 'image/png' });
			if (resultUrl) URL.revokeObjectURL(resultUrl);
			resultUrl = URL.createObjectURL(blob);
			resultFilename = `mandelbrot-z${zoom}-${w}x${h}.png`;
			phase = 'done';
		} catch (e: any) {
			if (e.message !== 'cancelled') throw e;
			phase = 'idle';
		} finally {
			cancelFn = null;
		}
	}
</script>

<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" role="dialog" aria-modal="true">
	<div class="bg-neutral-900 border border-neutral-700 rounded-lg p-5 flex flex-col gap-4 {phase === 'done' ? 'max-w-[90vw]' : 'w-80'}">

		<div class="flex items-center justify-between">
			<h2 class="text-white font-medium">Export / Share</h2>
			<button class="text-neutral-400 hover:text-white" onclick={onclose}>✕</button>
		</div>

		{#if phase !== 'done'}
			<div>
				<div class="text-neutral-400 text-xs mb-2">Share Link</div>
				<button
					class="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-1.5 rounded border border-neutral-700 transition-colors"
					onclick={copyShareLink}
				>Copy Link</button>
				{#if shareUrl}
					<div class="mt-1 text-xs text-green-400">Copied!</div>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<div class="text-neutral-400 text-xs">Export PNG</div>

				<select
					class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-sm border border-neutral-700"
					bind:value={selectedRes}
					disabled={phase === 'exporting'}
				>
					{#each resolutions as r, i}
						<option value={i}>{r.label}</option>
					{/each}
				</select>

				{#if selectedRes === 1}
					<p class="text-xs text-neutral-400">Pixel-exact match of the current view.</p>
				{:else}
					<p class="text-xs text-neutral-400">Centered on the current view, but the field of view will differ due to the different aspect ratio and resolution.</p>
				{/if}

				<label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
					<input type="checkbox" bind:checked={showOverlay} disabled={phase === 'exporting'} class="accent-blue-500" />
					Include info overlay
				</label>

				{#if phase === 'exporting'}
					<div class="h-1.5 bg-neutral-700 rounded overflow-hidden">
						<div class="h-full bg-blue-500 transition-all" style="width:{progress * 100}%"></div>
					</div>
					<div class="flex items-center justify-between text-xs text-neutral-400">
						<span>Generating… {Math.round(progress * 100)}%</span>
						<button class="text-red-400 hover:text-red-300" onclick={() => cancelFn?.()}>Cancel</button>
					</div>
				{:else}
					<button
						class="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm py-1.5 rounded transition-colors"
						onclick={exportPng}
					>Export PNG</button>
				{/if}
			</div>

		{:else}
			<img src={resultUrl} alt="Export preview" class="rounded border border-neutral-700 max-h-[70vh] object-contain" />
			<div class="flex gap-2">
				<button
					class="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-sm py-1.5 rounded transition-colors"
					onclick={saveFile}
				>Save PNG</button>
				<button
					class="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-1.5 rounded border border-neutral-700 transition-colors"
					onclick={reset}
				>Export Another</button>
			</div>
		{/if}
	</div>
</div>
