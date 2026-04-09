<script lang="ts">
	import { untrack } from 'svelte';
	import MandelbrotMap from '$lib/components/viewer/MandelbrotMap.svelte';
	import type { ViewerState } from '$lib/stores/viewerState.svelte';

	let {
		initialState,
		onUpdate,
		projectWidth,
		panelWidth,
		syncSignal = 0
	}: {
		initialState: ViewerState;
		onUpdate: (state: ViewerState) => void;
		projectWidth: number;
		panelWidth: number;
		syncSignal?: number;
	} = $props();

	const zoomOffset = $derived(Math.log2(projectWidth / panelWidth));

	let localState = $state<ViewerState>(JSON.parse(JSON.stringify(initialState)));
	let mapRef: { panTo: (re: number, im: number, zoom?: number) => void } | undefined = $state();

	$effect(() => {
		syncSignal;
		untrack(() => {
			const s = initialState;
			localState.maxIter = s.maxIter;
			localState.power = s.power;
			localState.colors = JSON.parse(JSON.stringify(s.colors));
			if (mapRef) {
				mapRef.panTo(parseFloat(s.cx), parseFloat(s.cy), s.zoom);
			} else {
				localState.cx = s.cx;
				localState.cy = s.cy;
				localState.zoom = s.zoom;
			}
		});
	});

	$effect(() => {
		onUpdate(localState);
	});
</script>

<div class="w-full h-full">
	<MandelbrotMap bind:this={mapRef} bind:state={localState} {zoomOffset} zoomSnap={0} />
</div>
