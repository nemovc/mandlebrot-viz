<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import ToggleButton from './ToggleButton.svelte';
	import LocationsPanel from './LocationsPanel.svelte';

	let showLocations = $state(false);

	let { onNavigate }: { onNavigate: (re: number, im: number, zoom?: number) => void } = $props();

	// Local editable copies — only sync from store when not focused
	let reInput = $state(viewerState.cx);
	let imInput = $state(viewerState.cy);
	let zoomInput = $state(viewerState.zoom.toString());
	let iterInput = $state(viewerState.maxIter.toString());
	let reFocused = false;
	let imFocused = false;
	let zoomFocused = false;
	let iterFocused = false;

	// Always read the store value to maintain reactivity dependency,
	// then conditionally apply it so we don't clobber an in-progress edit.
	$effect(() => {
		const val = (+viewerState.cx).toPrecision(8).replace(/\.?0+$/, '');
		if (!reFocused) reInput = val;
	});
	$effect(() => {
		const val = (+viewerState.cy).toPrecision(8).replace(/\.?0+$/, '');
		if (!imFocused) imInput = val;
	});
	$effect(() => {
		const val = viewerState.zoom.toString();
		if (!zoomFocused) zoomInput = val;
	});
	$effect(() => {
		const val = viewerState.maxIter.toString();
		if (!iterFocused) iterInput = val;
	});

	function commitCoords() {
		const re = parseFloat(reInput);
		const im = parseFloat(imInput);
		if (!isNaN(re) && !isNaN(im)) onNavigate(re, im);
	}

	function commitZoom() {
		const z = parseInt(zoomInput);
		if (!isNaN(z) && z >= 0) onNavigate(parseFloat(reInput), parseFloat(imInput), z);
	}

	function commitIter() {
		const v = parseInt(iterInput);
		if (!isNaN(v) && v > 0) viewerState.maxIter = v;
	}

	function onKeydown(e: KeyboardEvent, commit: () => void) {
		if (e.key === 'Enter') { commit(); (e.target as HTMLElement).blur(); }
	}
</script>

<div class="flex flex-row items-start gap-2">
	<CollapsiblePanel title="Position" position="top-left" oncollapse={() => (showLocations = false)}>
	<div class="flex flex-col gap-3 p-3">
		<ToggleButton active={showLocations} onclick={() => (showLocations = !showLocations)} class="w-full" chevron="right">
			Locations
		</ToggleButton>
		<div>
			<div class="text-neutral-400 text-xs mb-1">Zoom level</div>
			<input
				class="w-full bg-neutral-800 text-white font-mono rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
				type="text"
				value={zoomInput}
				onfocus={() => (zoomFocused = true)}
				onblur={() => { zoomFocused = false; commitZoom(); }}
				oninput={(e) => (zoomInput = (e.target as HTMLInputElement).value)}
				onkeydown={(e) => onKeydown(e, commitZoom)}
			/>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-1">Center (Re)</div>
			<input
				class="w-full bg-neutral-800 text-white font-mono rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
				type="text"
				value={reInput}
				onfocus={() => (reFocused = true)}
				onblur={() => { reFocused = false; commitCoords(); }}
				oninput={(e) => (reInput = (e.target as HTMLInputElement).value)}
				onkeydown={(e) => onKeydown(e, commitCoords)}
			/>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-1">Center (Im)</div>
			<input
				class="w-full bg-neutral-800 text-white font-mono rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
				type="text"
				value={imInput}
				onfocus={() => (imFocused = true)}
				onblur={() => { imFocused = false; commitCoords(); }}
				oninput={(e) => (imInput = (e.target as HTMLInputElement).value)}
				onkeydown={(e) => onKeydown(e, commitCoords)}
			/>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-1">Max Iterations</div>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="64"
					max="4096"
					step="4"
					value={viewerState.maxIter}
					oninput={(e) => {
						viewerState.maxIter = parseInt((e.target as HTMLInputElement).value);
					}}
					class="flex-1 accent-blue-500"
				/>
				<input
					class="w-16 bg-neutral-800 text-white font-mono rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
					type="text"
					value={iterInput}
					onfocus={() => (iterFocused = true)}
					onblur={() => { iterFocused = false; commitIter(); }}
					oninput={(e) => (iterInput = (e.target as HTMLInputElement).value)}
					onkeydown={(e) => onKeydown(e, commitIter)}
				/>
			</div>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-1">Exponent</div>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="2"
					max="10"
					step="1"
					value={viewerState.power}
					oninput={(e) => {
						viewerState.power = parseInt((e.target as HTMLInputElement).value);
					}}
					class="flex-1 accent-blue-500"
				/>
				<input
					class="w-10 bg-neutral-800 text-white font-mono rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
					type="number"
					min="2"
					max="10"
					value={viewerState.power}
					oninput={(e) => {
						const v = parseInt((e.target as HTMLInputElement).value);
						if (!isNaN(v) && v >= 2 && v <= 10) viewerState.power = v;
					}}
				/>
			</div>
		</div>
	</div>
</CollapsiblePanel>

	{#if showLocations}
		<LocationsPanel
			{onNavigate}
			onClose={() => (showLocations = false)}
		/>
	{/if}
</div>
