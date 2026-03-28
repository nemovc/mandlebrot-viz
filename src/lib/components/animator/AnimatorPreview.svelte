<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { animationState } from '$lib/stores/animationState.svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { interpolateAll } from '$lib/utils/animator/interpolation';
	import { getWorkerPool } from '$lib/rendering/worker/workerPool';
	import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
	import type { ColorConfig } from '$lib/stores/viewerState.svelte';

	const TILE = 256;

	let canvas: HTMLCanvasElement;
	let wrapper: HTMLDivElement;
	let container: HTMLDivElement;
	let canvasW = 0;
	let canvasH = 0;

	let activeJobIds: string[] = [];
	let renderSeq = 0;

	function cancelActive() {
		const pool = getWorkerPool();
		for (const id of activeJobIds) pool.cancel(id);
		activeJobIds = [];
	}

	function renderFrame(frame: number) {
		if (!canvas || canvasW === 0 || canvasH === 0) return;
		// Don't render (or corrupt viewerState) until the project has been seeded
		if (animationState.project.tracks.every((t) => t.keyframes.length === 0)) return;

		cancelActive();
		const seq = ++renderSeq;

		const project = animationState.project;
		const state = interpolateAll(project, frame);

		// Keep explorer in sync so returning to viewer shows this frame's position
		viewerState.loadFrom(state);

		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, canvasW, canvasH);

		const zoom = state.zoom;
		const cxCenter = parseFloat(state.cx);
		const cyCenter = parseFloat(state.cy);
		const scale = scaleForZoom(zoom, TILE);
		const precisionMode = getPrecisionMode(zoom);
		const colorConfig: ColorConfig = JSON.parse(JSON.stringify(state.colors));
		const maxIter = state.maxIter;
		const power = state.power;

		const tilesX = Math.ceil(canvasW / TILE);
		const tilesY = Math.ceil(canvasH / TILE);
		const total = tilesX * tilesY;
		if (total === 0) return;

		const pool = getWorkerPool();
		const batchId = `preview-${Date.now()}`;

		for (let ty = 0; ty < tilesY; ty++) {
			for (let tx = 0; tx < tilesX; tx++) {
				const tileCx = (cxCenter + (tx * TILE + TILE / 2 - canvasW / 2) * scale).toString();
				const tileCy = (cyCenter + (ty * TILE + TILE / 2 - canvasH / 2) * scale).toString();
				const id = `${batchId}-${tx}-${ty}`;
				activeJobIds.push(id);

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
						priority: 1,
						stage: 3,
					},
					(result) => {
						if (seq !== renderSeq) return;
						ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
					},
				);
			}
		}
	}

	function updateCanvasSize() {
		if (!canvas || !wrapper || !container) return;
		const { width: projW, height: projH } = animationState.project;
		const ar = projW / projH;
		// Cap at animation dimensions — don't upscale beyond what the export would be
		const availW = Math.min(container.clientWidth, projW);
		const availH = Math.min(container.clientHeight, projH);
		let w = availW;
		let h = availW / ar;
		if (h > availH) { h = availH; w = availH * ar; }
		canvasW = Math.round(w);
		canvasH = Math.round(h);
		wrapper.style.width = `${canvasW}px`;
		wrapper.style.height = `${canvasH}px`;
		canvas.width = canvasW;
		canvas.height = canvasH;
		renderFrame(animationState.currentFrame);
	}

	// Re-size canvas when animation dimensions change
	$effect(() => {
		animationState.project.width;
		animationState.project.height;
		updateCanvasSize();
	});

	// Re-render when frame changes OR when project is first seeded (keyframes go from 0 → >0)
	const hasKeyframes = $derived(
		animationState.project.tracks.some((t) => t.keyframes.length > 0),
	);
	$effect(() => {
		const frame = animationState.currentFrame;
		hasKeyframes; // also re-run when seeding completes
		renderFrame(frame);
	});

	let ro: ResizeObserver;
	onMount(() => {
		ro = new ResizeObserver(updateCanvasSize);
		ro.observe(container);
		updateCanvasSize();
	});

	onDestroy(() => {
		ro?.disconnect();
		cancelActive();
	});


</script>

<!--
  The wrapper sizes itself to fit the available space while maintaining the animation aspect ratio.
  CSS `aspect-ratio` + `max-width/max-height` gives contain-style behavior.
-->
<div bind:this={container} class="flex items-center justify-center w-full h-full bg-neutral-950 overflow-hidden">
	<div bind:this={wrapper} class="relative bg-black shrink-0">
		<canvas bind:this={canvas} class="absolute inset-0 w-full h-full block"></canvas>

		<div
			class="absolute bottom-2 right-2 text-[10px] font-mono text-neutral-500 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none select-none"
		>
			{animationState.currentFrame + 1} / {animationState.project.totalFrames}
		</div>
	</div>
</div>
