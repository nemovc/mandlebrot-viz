<script lang="ts">
	import { onMount } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { debugState } from '$lib/stores/debugState.svelte';
	import { getPrecisionMode } from '$lib/utils/precision';
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import ToggleButton from './ToggleButton.svelte';
	import PoolDebug from './PoolDebug.svelte';
	import { ViewerS2Pool } from '$lib/rendering/worker/pools/viewerS2Pool';
	import { ViewerS3Pool } from '$lib/rendering/worker/pools/viewerS3Pool';
	import { ViewerRecolorPool } from '$lib/rendering/worker/pools/viewerRecolorPool';
	import { ViewerExportPool } from '$lib/rendering/worker/pools/viewerExportPool';
	import { AnimatorPreviewPool } from '$lib/rendering/worker/pools/animatorPreviewPool';
	import { AnimatorCachePool } from '$lib/rendering/worker/pools/animatorCachePool';
	import { AnimatorExportPool } from '$lib/rendering/worker/pools/animatorExportPool';
	import { AnimatorRecolorPool } from '$lib/rendering/worker/pools/animatorRecolorPool';

	let {
		s2Completed, s2Total,
		s3Completed, s3Total,
		rcCompleted, rcTotal
	}: {
		s2Completed: number; s2Total: number;
		s3Completed: number; s3Total: number;
		rcCompleted: number; rcTotal: number;
	} = $props();

	// Animator pools only appear once they've been instantiated (e.g. after visiting the animator)
	let showAnimator = $state(AnimatorPreviewPool.hasInstance);
	let memUsed = $state<number | null>(null);
	let memTotal = $state<number | null>(null);

	onMount(() => {
		const interval = setInterval(() => {
			if (AnimatorPreviewPool.hasInstance) showAnimator = true;
			const mem = (performance as any).memory;
			if (mem) { memUsed = mem.usedJSHeapSize; memTotal = mem.jsHeapSizeLimit; }
		}, 2000);
		return () => clearInterval(interval);
	});

	function fmtBytes(b: number) {
		return (b / 1024 / 1024).toFixed(0) + ' MB';
	}
</script>

<CollapsiblePanel title="Debug" defaultOpen={false} position="bottom-left">
	<div class="flex flex-col gap-4 px-3 pb-3">
		<!-- Toggles -->
		<div class="flex flex-col gap-1.5 pt-3">
			<ToggleButton active={debugState.debugLogging} onclick={() => debugState.debugLogging = !debugState.debugLogging} checkbox>Debug logging</ToggleButton>
			<ToggleButton active={debugState.showCrosshair} onclick={() => debugState.showCrosshair = !debugState.showCrosshair} checkbox>Show crosshair</ToggleButton>
			<ToggleButton active={debugState.showTileSquare} onclick={() => debugState.showTileSquare = !debugState.showTileSquare} checkbox>Show tile square</ToggleButton>
			<ToggleButton active={debugState.slowMode} onclick={() => debugState.slowMode = !debugState.slowMode} checkbox>Slow mode</ToggleButton>
			<ToggleButton active={debugState.showTileFlash} onclick={() => debugState.showTileFlash = !debugState.showTileFlash} checkbox>Tile flash</ToggleButton>
		</div>

		<!-- Viewer pools -->
		<div class="flex flex-col gap-2">
			<div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">Viewer Pools</div>
			<PoolDebug name="S2" pool={ViewerS2Pool.instance} color="bg-blue-400" />
			<PoolDebug name="S3" pool={ViewerS3Pool.instance} color="bg-green-500" />
			<PoolDebug name="Recolor" pool={ViewerRecolorPool.instance} color="bg-purple-400" />
			<PoolDebug name="Export" pool={ViewerExportPool.instance} color="bg-yellow-400" />
		</div>

		<!-- Animator pools (appear once instantiated) -->
		{#if showAnimator}
			<div class="flex flex-col gap-2">
				<div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">Animator Pools</div>
				<PoolDebug name="Preview" pool={AnimatorPreviewPool.instance} color="bg-blue-400" />
				<PoolDebug name="Cache" pool={AnimatorCachePool.instance} color="bg-green-500" />
				<PoolDebug name="Export" pool={AnimatorExportPool.instance} color="bg-yellow-400" />
				<PoolDebug name="Recolor" pool={AnimatorRecolorPool.instance} color="bg-purple-400" />
			</div>
		{/if}

		<!-- System info -->
		<div class="flex flex-col gap-1.5">
			<div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">System</div>
			<div class="font-mono text-xs text-neutral-300 leading-5 flex flex-col gap-0.5">
				<div>{window.innerWidth}×{window.innerHeight} px @ {window.devicePixelRatio}x DPR</div>
				<div>zoom {viewerState.zoom} · {getPrecisionMode(viewerState.zoom)}</div>
				<div>{navigator.hardwareConcurrency} concurrency</div>
				{#if memUsed !== null && memTotal !== null}
					<div>heap {fmtBytes(memUsed)} / {fmtBytes(memTotal)}</div>
				{:else}
					<div class="text-neutral-600">heap n/a</div>
				{/if}
			</div>
		</div>
	</div>
</CollapsiblePanel>
