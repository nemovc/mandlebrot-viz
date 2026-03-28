<script lang="ts">
	import { onMount } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { debugState } from '$lib/stores/debugState.svelte';
	import { getPrecisionMode } from '$lib/utils/precision';
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import ToggleButton from './ToggleButton.svelte';

	type PoolDebug = {
		poolSize: number;
		idle: number;
		activeS2: number;
		activeS3: number;
		queued: number;
	};

	let {
		s2Completed,
		s2Total,
		s3Completed,
		s3Total,
		rcCompleted,
		rcTotal,
		renderPoolDebug,
		recolorPoolDebug
	}: {
		s2Completed: number;
		s2Total: number;
		s3Completed: number;
		s3Total: number;
		rcCompleted: number;
		rcTotal: number;
		renderPoolDebug: PoolDebug;
		recolorPoolDebug: PoolDebug;
	} = $props();

	let memUsed = $state<number | null>(null);
	let memTotal = $state<number | null>(null);

	onMount(() => {
		const interval = setInterval(() => {
			const mem = (performance as any).memory;
			if (mem) {
				memUsed = mem.usedJSHeapSize;
				memTotal = mem.jsHeapSizeLimit;
			}
		}, 2000);
		return () => clearInterval(interval);
	});

	function fmtBytes(b: number) {
		return (b / 1024 / 1024).toFixed(0) + ' MB';
	}

	function bar(completed: number, total: number) {
		return total > 0 ? Math.round((completed / total) * 100) : 0;
	}
</script>

<CollapsiblePanel title="Debug" defaultOpen={false} position="bottom-left">
	<div class="flex flex-col gap-4 px-3 pb-3">
		<!-- Toggles -->
		<div class="flex flex-col gap-1.5 pt-3">
			<ToggleButton active={debugState.debugLogging} onclick={() => debugState.debugLogging = !debugState.debugLogging}>Debug logging</ToggleButton>
			<ToggleButton active={debugState.showCrosshair} onclick={() => debugState.showCrosshair = !debugState.showCrosshair}>Show crosshair</ToggleButton>
			<ToggleButton active={debugState.showTileSquare} onclick={() => debugState.showTileSquare = !debugState.showTileSquare}>Show tile square</ToggleButton>
			<ToggleButton active={debugState.slowMode} onclick={() => debugState.slowMode = !debugState.slowMode}>Slow mode</ToggleButton>
		</div>

		<!-- Render pool -->
		<div class="flex flex-col gap-1.5">
			<div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">
				Render Pool ({renderPoolDebug.poolSize})
			</div>
			<div class="font-mono text-xs text-neutral-300 leading-5">
				<div class="flex gap-3">
					<span>idle <span class="text-white">{renderPoolDebug.idle}</span></span>
					<span>S2 <span class="text-blue-400">{renderPoolDebug.activeS2}</span></span>
					<span>S3 <span class="text-green-400">{renderPoolDebug.activeS3}</span></span>
					<span>q <span class="text-white">{renderPoolDebug.queued}</span></span>
				</div>
			</div>
			{#if s2Total > 0}
				<div class="flex items-center gap-2">
					<span class="text-xs text-neutral-500 w-4">S2</span>
					<div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
						<div class="h-full bg-blue-400 transition-all" style="width:{bar(s2Completed, s2Total)}%"></div>
					</div>
					<span class="text-xs text-neutral-500 w-12 text-right">{s2Completed}/{s2Total}</span>
				</div>
			{/if}
			{#if s3Total > 0}
				<div class="flex items-center gap-2">
					<span class="text-xs text-neutral-500 w-4">S3</span>
					<div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
						<div class="h-full bg-green-500 transition-all" style="width:{bar(s3Completed, s3Total)}%"></div>
					</div>
					<span class="text-xs text-neutral-500 w-12 text-right">{s3Completed}/{s3Total}</span>
				</div>
			{/if}
		</div>

		<!-- Recolor pool -->
		<div class="flex flex-col gap-1.5">
			<div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">
				Recolor Pool ({recolorPoolDebug.poolSize})
			</div>
			<div class="font-mono text-xs text-neutral-300 leading-5">
				<div class="flex gap-3">
					<span>idle <span class="text-white">{recolorPoolDebug.idle}</span></span>
					<span>active <span class="text-purple-400">{recolorPoolDebug.activeS3}</span></span>
					<span>q <span class="text-white">{recolorPoolDebug.queued}</span></span>
				</div>
			</div>
			{#if rcTotal > 0}
				<div class="flex items-center gap-2">
					<span class="text-xs text-neutral-500 w-4">RC</span>
					<div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
						<div class="h-full bg-purple-400 transition-all" style="width:{bar(rcCompleted, rcTotal)}%"></div>
					</div>
					<span class="text-xs text-neutral-500 w-12 text-right">{rcCompleted}/{rcTotal}</span>
				</div>
			{/if}
		</div>

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
