<script lang="ts">
	import { samplePalette } from '$lib/utils/colorPalettes';
	import type { ColorConfig } from '$lib/stores/viewerState.svelte';

	let { colors, class: extraClass = '' }: { colors: ColorConfig; class?: string } = $props();

	const display = $derived((() => {
		const { palette, offset, reverse } = colors;

		const displayStops = palette
			.map(({ stop, color }) => {
				const d = reverse ? 1 - stop : stop;
				return { pos: d - offset + (d < offset ? 1 : 0), color };
			})
			.sort((a, b) => a.pos - b.pos);

		const edgeT = reverse ? 1 - offset : offset;
		const [r, g, b] = samplePalette(palette, edgeT);
		const edgeColor = `rgb(${r},${g},${b})`;

		const parts = [
			`${edgeColor} 0%`,
			...displayStops.map(({ pos, color }) => `${color} ${(pos * 100).toFixed(2)}%`),
			`${edgeColor} 100%`
		];

		return { gradient: `linear-gradient(to right, ${parts.join(', ')})`, displayStops };
	})());
</script>

<div class="relative h-4 rounded flex-1 overflow-visible {extraClass}" style="background: {display.gradient}">
	{#each display.displayStops as { pos }}
		<div
			class="absolute top-[-3px] bottom-[-3px] w-px bg-white/60"
			style="left: {(pos * 100).toFixed(2)}%"
		></div>
	{/each}
</div>
