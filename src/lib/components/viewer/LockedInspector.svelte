<script lang="ts">
	import type { ColorConfig } from '$lib/utils/colorPalettes';

	import InspectorTooltip from './InspectorTooltip.svelte';

	let {
		target,
		re,
		im,
		maxIter,
		power,
		colorConfig,
		lastCdf,
		getIterAt,
		onCenterPoint
	}: {
		target: HTMLElement;
		re: number;
		im: number;
		maxIter: number;
		power: number;
		colorConfig: ColorConfig;
		lastCdf: Float32Array | null;
		getIterAt: (re: number, im: number) => number | null;
		onCenterPoint?: () => void;
	} = $props();

	let wrapperEl: HTMLElement | undefined = $state();

	// Portal: move our root element into the Leaflet marker container so that
	// Leaflet's own pan/zoom transforms keep us positioned correctly.
	$effect(() => {
		const el = wrapperEl;
		const t = target;
		if (!el || !t) return;
		t.appendChild(el);
		return () => {
			el.remove();
		};
	});
</script>

<!-- Root element is portalled into the Leaflet marker container by the effect above.
     Position (0,0) within the container = the locked complex coordinate. -->
<div bind:this={wrapperEl}>
	<!-- Crosshair centred on the lock point.
	     Layered SVG strokes (dark behind, white in front) ensure visibility on any background. -->
	<svg
		style="position:absolute; left:-10px; top:-10px; pointer-events:none; overflow:visible;"
		width="20"
		height="20"
	>
		<line x1="10" y1="0" x2="10" y2="5.5" stroke="black" stroke-width="3" stroke-opacity="0.55" />
		<line x1="10" y1="14.5" x2="10" y2="20" stroke="black" stroke-width="3" stroke-opacity="0.55" />
		<line x1="0" y1="10" x2="5.5" y2="10" stroke="black" stroke-width="3" stroke-opacity="0.55" />
		<line x1="14.5" y1="10" x2="20" y2="10" stroke="black" stroke-width="3" stroke-opacity="0.55" />
		<circle
			cx="10"
			cy="10"
			r="4"
			fill="none"
			stroke="black"
			stroke-width="3"
			stroke-opacity="0.55"
		/>
		<line x1="10" y1="0" x2="10" y2="5.5" stroke="white" stroke-width="1.25" />
		<line x1="10" y1="14.5" x2="10" y2="20" stroke="white" stroke-width="1.25" />
		<line x1="0" y1="10" x2="5.5" y2="10" stroke="white" stroke-width="1.25" />
		<line x1="14.5" y1="10" x2="20" y2="10" stroke="white" stroke-width="1.25" />
		<circle cx="10" cy="10" r="4" fill="none" stroke="white" stroke-width="1.25" />
	</svg>

	<InspectorTooltip
		{re}
		{im}
		locked={true}
		embedded={true}
		{maxIter}
		{power}
		{colorConfig}
		{lastCdf}
		{getIterAt}
		{onCenterPoint}
	/>
</div>
