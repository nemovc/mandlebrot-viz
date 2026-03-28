<script lang="ts">
	import { PRESETS } from '$lib/utils/colorPalettes';
	import { savedPalettes } from '$lib/stores/savedPalettes.svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import PalettePreview from './PalettePreview.svelte';
	import ToggleButton from './ToggleButton.svelte';

	let {
		activePaletteName,
		onClose,
		onApply
	}: {
		activePaletteName: string | null;
		onClose: () => void;
		onApply: (name: string) => void;
	} = $props();

	let includeOffsets = $state(false);
	let pendingDelete = $state<string | null>(null);

	function applyPalette(name: string) {
		const config = PRESETS[name] ?? savedPalettes.all.find((p) => p.name === name)?.config;
		if (!config) return;
		if (includeOffsets) {
			viewerState.colors = JSON.parse(JSON.stringify(config));
		} else {
			viewerState.colors = {
				...viewerState.colors,
				palette: JSON.parse(JSON.stringify(config.palette))
			};
		}
		onApply(name);
	}

	function confirmDelete(name: string) {
		pendingDelete = name;
	}

	function doDelete(name: string) {
		savedPalettes.remove(name);
		pendingDelete = null;
	}
</script>

<div class="w-64 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl flex flex-col overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
		<span class="text-xs font-medium uppercase tracking-wider text-neutral-400">Palettes</span>
		<button
			class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
			onclick={onClose}
			aria-label="Close"
		>✕</button>
	</div>

	<!-- Include cycle/offset toggle -->
	<div class="px-2 py-1.5 border-b border-neutral-800">
		<ToggleButton
			active={includeOffsets}
			onclick={() => (includeOffsets = !includeOffsets)}
			class="w-full"
			checkbox
			title="When on, applying a palette also loads its saved algorithm, cycle period, offset, reverse, and in-set colour"
		>
			{includeOffsets ? 'Applying full settings' : 'Applying colours only'}
		</ToggleButton>
	</div>

	<!-- Scrollable palette list -->
	<div class="overflow-y-auto max-h-[50vh] p-2 flex flex-col gap-0">
		<!-- Built-in presets -->
		<div class="grid grid-cols-2 gap-1">
			{#each Object.entries(PRESETS) as [name, config]}
				<button
					class="flex flex-col rounded overflow-hidden border transition-colors text-left {activePaletteName === name
						? 'border-blue-500'
						: 'border-neutral-700 hover:border-neutral-500'}"
					onclick={() => applyPalette(name)}
				>
					<span class="px-2 py-1 text-xs text-neutral-300 truncate">{name}</span>
					<PalettePreview colors={config} class="h-6 rounded-none" />
				</button>
			{/each}
		</div>

		<!-- Saved palettes (only if any exist) -->
		{#if savedPalettes.all.length > 0}
			<div class="flex items-center gap-2 my-2">
				<div class="flex-1 border-t border-neutral-700"></div>
				<span class="text-[10px] text-neutral-600 uppercase tracking-wider">Saved</span>
				<div class="flex-1 border-t border-neutral-700"></div>
			</div>
			<div class="grid grid-cols-2 gap-1">
				{#each savedPalettes.all as saved}
					{#if pendingDelete === saved.name}
						<!-- Inline delete confirmation spans 2 columns -->
						<div class="col-span-2 flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
							<span class="text-xs text-neutral-300 flex-1 truncate">Delete "{saved.name}"?</span>
							<button
								class="text-xs px-2 py-0.5 rounded bg-red-700 border border-red-600 text-white hover:bg-red-600 transition-colors"
								onclick={() => doDelete(saved.name)}
							>Yes</button>
							<button
								class="text-xs px-2 py-0.5 rounded border border-neutral-600 text-neutral-400 hover:text-white transition-colors"
								onclick={() => (pendingDelete = null)}
							>No</button>
						</div>
					{:else}
						<div class="relative group">
							<button
								class="w-full flex flex-col rounded overflow-hidden border transition-colors text-left {activePaletteName === saved.name
									? 'border-blue-500'
									: 'border-neutral-700 hover:border-neutral-500'}"
								onclick={() => applyPalette(saved.name)}
							>
								<span class="px-2 py-1 text-xs text-neutral-300 truncate">{saved.name}</span>
								<PalettePreview colors={saved.config} class="h-6 rounded-none" />
							</button>
							<!-- Delete button -->
							<button
								class="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all opacity-0 group-hover:opacity-100 text-[10px] leading-none"
								onclick={(e) => { e.stopPropagation(); confirmDelete(saved.name); }}
								aria-label="Delete {saved.name}"
							>✕</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
