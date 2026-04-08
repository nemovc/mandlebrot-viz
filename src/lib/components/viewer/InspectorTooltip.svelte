<script lang="ts">
	import { onDestroy } from 'svelte';
	import { buildImageData, baseAlgorithm, isBanded } from '$lib/utils/colorPalettes';
	import type { ColorConfig } from '$lib/utils/colorPalettes';
	import { InspectorPool } from '$lib/rendering/worker/pools/inspectorPool';
	import CopyText from '$lib/components/ui/CopyText.svelte';
	import SaveModal from '$lib/components/ui/SaveModal.svelte';
	import { savedLocations } from '$lib/stores/savedLocations.svelte';
	import { PRESET_LOCATIONS } from '$lib/utils/locations';
	import { viewerState } from '$lib/stores/viewerState.svelte';

	const JULIA_SIZE = 192;
	const JULIA_SCALE = 2 / JULIA_SIZE; // shows [-2,2]² centred on origin
	const TOOLTIP_W = 224; // w-56 = 14rem = 224px
	const TOOLTIP_H_LOCKED = 360; // with action buttons
	const TOOLTIP_H_UNLOCKED = 310; // without action buttons

	let {
		re,
		im,
		screenX = 0,
		screenY = 0,
		locked,
		embedded = false,
		maxIter,
		power,
		colorConfig,
		lastCdf,
		getIterAt,
		onCenterPoint
	}: {
		re: number;
		im: number;
		screenX?: number;
		screenY?: number;
		locked: boolean;
		embedded?: boolean;
		maxIter: number;
		power: number;
		colorConfig: ColorConfig;
		lastCdf: Float32Array | null;
		getIterAt: (re: number, im: number) => number | null;
		onCenterPoint?: () => void;
	} = $props();

	let showSaveLocation = $state(false);

	let juliaCanvas: HTMLCanvasElement | undefined = $state();
	let juliaJobId: string | null = null;

	// Synchronous iter + color lookup from cached tile data
	const iterValue = $derived(getIterAt(re, im));
	const isDem = $derived(baseAlgorithm(colorConfig.algorithm) === 'distance_estimation');
	const banded = $derived(isBanded(colorConfig.algorithm));

	function splitDecimal(s: string): [string, string] {
		const dot = s.indexOf('.');
		return dot === -1 ? [s, ''] : [s.slice(0, dot), s.slice(dot)];
	}

	const color = $derived.by(() => {
		if (iterValue === null) return null;
		const img = buildImageData(
			new Float32Array([iterValue]),
			1,
			1,
			maxIter,
			colorConfig,
			lastCdf ?? undefined
		);
		return [img.data[0], img.data[1], img.data[2]] as [number, number, number];
	});

	// Submit Julia preview job — cancel previous and resubmit immediately on point change
	$effect(() => {
		re;
		im;
		maxIter;
		power;
		colorConfig; // track dependencies

		if (juliaJobId) {
			InspectorPool.instance.cancel(juliaJobId);
			juliaJobId = null;
		}

		const id = `julia-${Date.now()}-${Math.random()}`;
		juliaJobId = id;
		InspectorPool.instance.submit(
			{
				id,
				priority: 2,
				cRe: re,
				cIm: im,
				viewCx: 0,
				viewCy: 0,
				scale: JULIA_SCALE,
				size: JULIA_SIZE,
				maxIter: Math.min(maxIter, 256),
				power,
				colorConfig: JSON.parse(JSON.stringify(colorConfig))
			},
			(result) => {
				if (juliaCanvas) {
					juliaCanvas.getContext('2d')!.putImageData(result.imageData, 0, 0);
				}
				juliaJobId = null;
			}
		);
	});

	onDestroy(() => {
		if (juliaJobId) InspectorPool.instance.cancel(juliaJobId);
	});

	// Tooltip position: prefer right/below anchor, flip if too close to edge.
	// For embedded (locked), offsets are relative to the marker container; for
	// floating, they are viewport-absolute.
	const tooltipH = $derived(locked ? TOOLTIP_H_LOCKED : TOOLTIP_H_UNLOCKED);
	const flipX = $derived(screenX + 16 + TOOLTIP_W > window.innerWidth);
	const flipY = $derived(screenY + tooltipH > window.innerHeight);
	const tipX = $derived(flipX ? screenX - 16 - TOOLTIP_W : screenX + 16);
	const tipY = $derived(flipY ? screenY - tooltipH : screenY);
	const embeddedStyle = $derived(
		`${flipX ? `right: 16px;` : `left: 16px;`} ${flipY ? `bottom: 0;` : `top: 0;`}`
	);

	function toHex([r, g, b]: [number, number, number]) {
		return [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
	}
</script>

<div
	class="bg-neutral-900/95 border border-neutral-700 rounded-lg shadow-xl text-[11px] font-mono p-3 w-56 {locked
		? 'pointer-events-auto select-text'
		: 'pointer-events-none select-none'} {embedded ? 'absolute' : 'fixed z-[9999]'}"
	style={embedded ? embeddedStyle : `left: ${tipX}px; top: ${tipY}px;`}
>
	<div class="flex items-center justify-between">
		<div>
			<div class="text-neutral-400">
				Re <span class="text-green-400">{re.toFixed(14)}</span>
			</div>
			<div class="text-neutral-400">
				Im <span class="text-green-400">{im.toFixed(14)}</span>
			</div>
		</div>
		{#if locked}
			<CopyText value={`${re}, ${im}`} title="Copy coordinates" class="ml-2 self-center" />
		{/if}
	</div>

	<div class="flex items-center justify-between mt-1">
		<div class="text-neutral-400">
			{isDem ? 'Dist' : 'Iter'}
			{#if iterValue === null}
				<span class="text-neutral-600">—</span>
			{:else if iterValue >= maxIter}
				<span class="text-neutral-500">∞ (in set)</span>
			{:else if isDem}
				<span class="text-yellow-400">{iterValue.toExponential(3)}</span>
			{:else if banded}
				{@const [int, dec] = splitDecimal(iterValue.toFixed(3))}
				<span class="text-yellow-400">{int}</span><span class="text-yellow-400/30">{dec}</span>
			{:else}
				<span class="text-yellow-400">{iterValue.toFixed(3)}</span>
			{/if}
		</div>
		{#if locked && iterValue !== null}
			<CopyText
				value={() => (iterValue >= maxIter ? '∞' : iterValue.toFixed(4))}
				title="Copy value"
				class="ml-2"
			/>
		{/if}
	</div>

	{#if color}
		<div class="flex items-center justify-between mt-1">
			<div class="flex items-center gap-1.5 text-neutral-400">
				Color
				<span
					class="inline-block w-3.5 h-3.5 rounded-sm border border-neutral-600 shrink-0"
					style="background: rgb({color[0]},{color[1]},{color[2]})"
				></span>
				<span class="text-neutral-500">#{toHex(color)}</span>
			</div>
			{#if locked}
				<CopyText value={`#${toHex(color)}`} title="Copy hex color" class="ml-2" />
			{/if}
		</div>
	{/if}

	<!-- Julia preview -->
	<div class="mt-2 border border-neutral-700 rounded overflow-hidden">
		<canvas
			bind:this={juliaCanvas}
			width={JULIA_SIZE}
			height={JULIA_SIZE}
			class="w-full block"
			style="image-rendering: auto"
		></canvas>
	</div>

	{#if locked}
		<div class="mt-2 flex flex-col gap-1.5">
			<button
				class="flex-1 px-2 py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 rounded transition-colors"
				onclick={onCenterPoint}>Center this point</button
			>
			<button
				class="flex-1 px-2 py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 rounded transition-colors"
				onclick={() => (showSaveLocation = true)}>Save location</button
			>
		</div>
	{/if}

	<SaveModal
		bind:open={showSaveLocation}
		title="Save Location"
		allowedNames={/.+/}
		maxLength={48}
		reservedNames={PRESET_LOCATIONS.map((l) => l.name)}
		checkIfOverwrites={savedLocations.exists}
		onComplete={(name) => savedLocations.save({ name, re, im, zoom: viewerState.zoom })}
	/>
</div>
