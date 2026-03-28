<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { PRESETS, samplePalette } from '$lib/utils/colorPalettes';
	import CollapsiblePanel from './CollapsiblePanel.svelte';
	import ToggleButton from './ToggleButton.svelte';

	const paletteDisplay = $derived((() => {
		const { palette, offset, reverse } = viewerState.colors;

		// Shift each palette stop into display space.
		// Normal:  stop `s` appears at display `s - offset` (wrap into [0,1])
		// Reverse: rendering does `1 - t` *after* offset, so stop `s` appears at display `(1-s) - offset`.
		//          Seam tie-break is ascending stop (palette[0] before palette[1]) because just before
		//          the seam t→1 so 1-t→0 (palette start), and just after t→0 so 1-t→1 (palette end).
		const displayStops = palette
			.map(({ stop, color }) => {
				const d = reverse ? 1 - stop : stop;
				return { stop, pos: d - offset + (d < offset ? 1 : 0), color };
			})
			.sort((a, b) => a.pos - b.pos || (reverse ? a.stop - b.stop : b.stop - a.stop));

		// Display 0% and 100% = palette at (offset) normally, palette at (1 - offset) when reversed.
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

	const gradientCss = $derived(paletteDisplay.gradient);

	const selectedPreset = $derived(
		Object.entries(PRESETS).find(([, preset]) =>
			JSON.stringify(preset.palette) === JSON.stringify(viewerState.colors.palette)
		)?.[0] ?? null
	);

	function applyPreset(name: string) {
		viewerState.colors = { ...viewerState.colors, palette: PRESETS[name].palette };
	}

	function onCyclePeriodChange(e: Event) {
		viewerState.colors = {
			...viewerState.colors,
			cyclePeriod: parseInt((e.target as HTMLInputElement).value)
		};
	}

	function onOffsetChange(e: Event) {
		viewerState.colors = {
			...viewerState.colors,
			offset: parseFloat((e.target as HTMLInputElement).value)
		};
	}

	function onAlgorithmChange(e: Event) {
		viewerState.colors = {
			...viewerState.colors,
			algorithm: (e.target as HTMLSelectElement).value as typeof viewerState.colors.algorithm
		};
	}
</script>

<CollapsiblePanel title="Color Scheme" position="top-right">
	<div class="flex flex-col gap-3 p-3">
		<div>
			<div class="text-neutral-400 text-xs mb-1">Algorithm</div>
			<select
				class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
				value={viewerState.colors.algorithm}
				onchange={onAlgorithmChange}
			>
				<option value="smooth">Smooth (normalized)</option>
				<option value="escape_time">Escape Time (bands)</option>
				<option value="distance_estimation">Distance Estimation</option>
			</select>
		</div>

		<div>
			<div class="text-neutral-400 text-xs mb-1">Palette</div>
			<div class="flex flex-col gap-1">
				{#each Object.keys(PRESETS) as name}
					<button
						class="text-left px-2 py-1 rounded text-xs transition-colors
							{selectedPreset !== null && selectedPreset === name
							? 'bg-blue-700 text-white'
							: 'text-neutral-300 hover:bg-neutral-800'}"
						onclick={() => applyPreset(name)}
					>
						{name}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<div class="relative h-4 rounded flex-1 overflow-visible" style="background: {gradientCss}">
				{#each paletteDisplay.displayStops as { pos }}
					<div
						class="absolute top-[-3px] bottom-[-3px] w-px bg-white/60"
						style="left: {(pos * 100).toFixed(2)}%"
					></div>
				{/each}
			</div>
			<ToggleButton
				active={viewerState.colors.reverse}
				onclick={() => viewerState.colors = { ...viewerState.colors, reverse: !viewerState.colors.reverse }}
				title="Reverse palette"
			>⇄</ToggleButton>
		</div>

		<div>
			<label class="text-neutral-400 text-xs" for="cyclePeriod">Cycle Period</label>
			<div class="flex items-center gap-2 mt-1">
				<input
					id="cyclePeriod"
					type="range"
					min="4"
					max="256"
					step="1"
					value={viewerState.colors.cyclePeriod}
					oninput={onCyclePeriodChange}
					class="flex-1 accent-blue-500"
				/>
				<input
					type="text"
					class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
					value={viewerState.colors.cyclePeriod}
					onblur={(e) => {
						const v = parseInt((e.target as HTMLInputElement).value);
						if (!isNaN(v) && v > 0) onCyclePeriodChange(e);
					}}
					onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
				/>
			</div>
			{#if viewerState.colors.algorithm === 'distance_estimation' && viewerState.colors.cyclePeriod > 32}
				<p class="text-yellow-500 text-xs mt-1 whitespace-normal break-words">High cycle period loses detail in distance estimation mode.</p>
			{/if}
		</div>

		<div>
			<label class="text-neutral-400 text-xs" for="colorOffset">Offset</label>
			<div class="flex items-center gap-2 mt-1">
				<input
					id="colorOffset"
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={viewerState.colors.offset}
					oninput={onOffsetChange}
					class="flex-1 accent-blue-500"
				/>
				<input
					type="text"
					class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
					value={viewerState.colors.offset.toFixed(2)}
					onblur={(e) => {
						const v = parseFloat((e.target as HTMLInputElement).value);
						if (!isNaN(v)) viewerState.colors = { ...viewerState.colors, offset: Math.max(0, Math.min(1, v)) };
					}}
					onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
				/>
			</div>
		</div>
	</div>
</CollapsiblePanel>
