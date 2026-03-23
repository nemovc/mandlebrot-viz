<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { PRESETS } from '$lib/utils/colorPalettes';

	let selectedPreset = $state('Classic Blue-Gold');

	function applyPreset(name: string) {
		selectedPreset = name;
		viewerState.colors = { ...PRESETS[name] };
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

<div class="flex flex-col gap-3 p-3 text-sm bg-neutral-900 rounded-lg border border-neutral-800 min-w-48">
	<div class="text-neutral-400 text-xs font-medium uppercase tracking-wider">Color Scheme</div>

	<div>
		<div class="text-neutral-400 text-xs mb-1">Algorithm</div>
		<select
			class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
			value={viewerState.colors.algorithm}
			onchange={onAlgorithmChange}
		>
			<option value="smooth">Smooth (normalized)</option>
			<option value="escape_time">Escape Time (bands)</option>
		</select>
	</div>

	<div>
		<div class="text-neutral-400 text-xs mb-1">Palette</div>
		<div class="flex flex-col gap-1">
			{#each Object.keys(PRESETS) as name}
				<button
					class="text-left px-2 py-1 rounded text-xs transition-colors
						{selectedPreset === name
						? 'bg-blue-700 text-white'
						: 'text-neutral-300 hover:bg-neutral-800'}"
					onclick={() => applyPreset(name)}
				>
					{name}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<label class="text-neutral-400 text-xs" for="cyclePeriod">Cycle Period</label>
		<div class="flex items-center gap-2 mt-1">
			<input
				id="cyclePeriod"
				type="range"
				min="4"
				max="256"
				step="4"
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
