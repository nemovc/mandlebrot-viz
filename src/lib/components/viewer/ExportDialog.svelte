<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { encodeState } from '$lib/utils/urlSerializer';
	import { getWorkerPool } from '$lib/rendering/worker/workerPool';
	import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';

	let { onclose }: { onclose: () => void } = $props();

	const RESOLUTIONS = [
		{ label: '1920×1080 (FHD)', w: 1920, h: 1080 },
		{ label: '3840×2160 (4K)', w: 3840, h: 2160 },
		{ label: '7680×4320 (8K)', w: 7680, h: 4320 }
	];

	let selectedRes = $state(0);
	let progress = $state(0);
	let exporting = $state(false);
	let shareUrl = $state('');

	function copyShareLink() {
		const encoded = encodeState(viewerState.toJSON());
		const url = `${location.origin}${location.pathname}#${encoded}`;
		shareUrl = url;
		navigator.clipboard.writeText(url);
	}

	async function exportPng() {
		const { w, h } = RESOLUTIONS[selectedRes];
		exporting = true;
		progress = 0;

		const TILE = 256;
		const tilesX = Math.ceil(w / TILE);
		const tilesY = Math.ceil(h / TILE);
		const total = tilesX * tilesY;
		let done = 0;

		const offscreen = new OffscreenCanvas(w, h);
		const ctx = offscreen.getContext('2d')!;

		const zoom = viewerState.zoom;
		const scale = scaleForZoom(zoom, TILE);
		const precisionMode = getPrecisionMode(zoom);
		const pool = getWorkerPool();
		const cxCenter = parseFloat(viewerState.cx);
		const cyCenter = parseFloat(viewerState.cy);

		const pending: Promise<void>[] = [];

		for (let ty = 0; ty < tilesY; ty++) {
			for (let tx = 0; tx < tilesX; tx++) {
				const cx = (cxCenter + (tx - tilesX / 2 + 0.5) * scale * TILE).toString();
				const cy = (cyCenter + (ty - tilesY / 2 + 0.5) * scale * TILE).toString();

				const p = new Promise<void>((resolve) => {
					pool.submit(
						{
							id: `export-${tx}-${ty}`,
							cx, cy,
							scale: scale.toString(),
							tileSize: TILE,
							maxIter: viewerState.maxIter,
							precisionMode,
							colorConfig: viewerState.colors,
							priority: 0
						},
						(result) => {
							ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
							done++;
							progress = done / total;
							resolve();
						}
					);
				});
				pending.push(p);
			}
		}

		await Promise.all(pending);

		const blob = await offscreen.convertToBlob({ type: 'image/png' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `mandelbrot-z${zoom}.png`;
		a.click();
		URL.revokeObjectURL(url);

		exporting = false;
	}
</script>

<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-modal="true">
	<div class="bg-neutral-900 border border-neutral-700 rounded-lg p-5 w-80 flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<h2 class="text-white font-medium">Export / Share</h2>
			<button class="text-neutral-400 hover:text-white" onclick={onclose}>✕</button>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-2">Share Link</div>
			<button
				class="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-1.5 rounded border border-neutral-700 transition-colors"
				onclick={copyShareLink}
			>
				Copy Link
			</button>
			{#if shareUrl}
				<div class="mt-1 text-xs text-green-400 break-all">Copied!</div>
			{/if}
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-2">Export PNG</div>
			<select
				class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-sm border border-neutral-700 mb-2"
				bind:value={selectedRes}
			>
				{#each RESOLUTIONS as r, i}
					<option value={i}>{r.label}</option>
				{/each}
			</select>

			<button
				class="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm py-1.5 rounded transition-colors"
				onclick={exportPng}
				disabled={exporting}
			>
				{exporting ? `Exporting… ${Math.round(progress * 100)}%` : 'Export PNG'}
			</button>

			{#if exporting}
				<div class="mt-2 h-1.5 bg-neutral-700 rounded overflow-hidden">
					<div class="h-full bg-blue-500 transition-all" style="width:{progress * 100}%"></div>
				</div>
			{/if}
		</div>
	</div>
</div>
