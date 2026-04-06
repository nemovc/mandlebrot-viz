<script lang="ts">
	import { untrack } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { wheelSlider } from '$lib/actions/wheelSlider';
	import { samplePalette, baseAlgorithm } from '$lib/utils/colorPalettes';
  import type { ColorConfig, ColorStop } from "$lib/utils/colorPalettes";
	import SavePaletteModal from './SavePaletteModal.svelte';

	let {
		activePaletteName,
		baseline,
		onClose,
		onSave
	}: {
		activePaletteName: string | null;
		baseline: ColorStop[];
		onClose: () => void;
		onSave: (name: string) => void;
	} = $props();

	let cancelSnapshot = $state<ColorConfig>(JSON.parse(JSON.stringify(viewerState.colors)));
	let selectedStopIdx = $state<number | null>(null);
	let draggingIdx = $state<number | null>(null);
	let barEl = $state<HTMLElement | null>(null);
	let showSaveModal = $state(false);

	// When baseline changes (new palette selected from panel), update the cancel snapshot
	$effect(() => {
		// Use JSON.stringify of baseline as the reactive dependency
		const _dep = JSON.stringify(baseline);
		untrack(() => {
			cancelSnapshot = JSON.parse(JSON.stringify(viewerState.colors));
		});
	});

	const dirty = $derived(
		JSON.stringify(viewerState.colors.palette) !== JSON.stringify(baseline)
	);

	const sortedPalette = $derived(
		[...viewerState.colors.palette].sort((a, b) => a.stop - b.stop)
	);

	const gradient = $derived(
		`linear-gradient(to right, ${sortedPalette.map((s) => `${s.color} ${(s.stop * 100).toFixed(2)}%`).join(', ')})`
	);

	const displayName = $derived(
		activePaletteName ? (dirty ? activePaletteName + '*' : activePaletteName) : 'Custom'
	);

	function updateStop(idx: number, partial: Partial<ColorStop>) {
		const palette = viewerState.colors.palette.map((s, i) =>
			i === idx ? { ...s, ...partial } : { ...s }
		);
		viewerState.colors = { ...viewerState.colors, palette };
	}

	function addStop(t: number) {
		const clamped = Math.max(0, Math.min(1, t));
		const [r, g, b] = samplePalette(viewerState.colors.palette, clamped);
		const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
		const newPalette = [...viewerState.colors.palette.map((s) => ({ ...s })), { stop: clamped, color }];
		newPalette.sort((a, b) => a.stop - b.stop);
		viewerState.colors = { ...viewerState.colors, palette: newPalette };
		selectedStopIdx = newPalette.findIndex((s) => s.stop === clamped && s.color === color);
	}

	function deleteStop(idx: number) {
		if (viewerState.colors.palette.length <= 2) return;
		const newPalette = viewerState.colors.palette.filter((_, i) => i !== idx);
		viewerState.colors = { ...viewerState.colors, palette: newPalette };
		if (selectedStopIdx === idx) {
			selectedStopIdx = null;
		} else if (selectedStopIdx !== null && selectedStopIdx > idx) {
			selectedStopIdx = selectedStopIdx - 1;
		}
	}

	function cancel() {
		viewerState.colors = JSON.parse(JSON.stringify(cancelSnapshot));
		onClose();
	}

	function tFromBarEvent(e: PointerEvent): number {
		if (!barEl) return 0;
		const rect = barEl.getBoundingClientRect();
		return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
	}

	function onHandlePointerDown(e: PointerEvent, idx: number) {
		e.stopPropagation();
		draggingIdx = idx;
		selectedStopIdx = idx;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onHandlePointerMove(e: PointerEvent) {
		if (draggingIdx === null) return;
		const t = tFromBarEvent(e);
		updateStop(draggingIdx, { stop: t });
	}

	function onHandlePointerUp(_e: PointerEvent) {
		draggingIdx = null;
	}

	function onBarDblClick(e: MouseEvent) {
		// Don't add stop if click was on a handle (handles call stopPropagation)
		if (!barEl) return;
		const rect = barEl.getBoundingClientRect();
		const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		addStop(t);
	}

	function onHandleDblClick(e: MouseEvent, idx: number) {
		e.stopPropagation();
		deleteStop(idx);
	}

	function handleSaveModalSave(name: string) {
		showSaveModal = false;
		// Update baseline snapshot via parent
		onSave(name);
	}
</script>

<div class="w-[33vw] min-w-72 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden flex flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800 gap-2">
		<span class="text-xs font-medium uppercase tracking-wider text-neutral-400 truncate flex-1">
			Editing {displayName} palette
		</span>
		<div class="flex items-center gap-1">
			<button
				class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				onclick={() => { viewerState.colors = JSON.parse(JSON.stringify(cancelSnapshot)); selectedStopIdx = null; }}
				disabled={!dirty}
				title="Reset to pre-edit state"
			>Reset</button>
			<button
				class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
				onclick={cancel}
			>Cancel</button>
			<button
				class="px-2 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
				onclick={() => (showSaveModal = true)}
			>Save</button>
		</div>
	</div>

	<!-- Editor body -->
	<div class="p-3 flex flex-col gap-2">
		<!-- Gradient bar -->
		<div
			bind:this={barEl}
			class="h-10 rounded cursor-crosshair relative overflow-visible select-none"
			style="background: {gradient}"
			ondblclick={onBarDblClick}
			role="img"
			aria-label="Palette gradient — double-click to add a stop"
		>
			<!-- Stop lines (pointer-events-none) -->
			{#each sortedPalette as stop}
				<div
					class="absolute top-0 bottom-0 w-px bg-white/40 pointer-events-none"
					style="left: {(stop.stop * 100).toFixed(2)}%"
				></div>
			{/each}
		</div>

		<!-- Handles row -->
		<div class="relative h-4 mt-0.5">
			{#each viewerState.colors.palette as stop, i}
				<button
					class="absolute top-0 w-3 h-3 rounded-full border-2 cursor-ew-resize -translate-x-1/2 transition-shadow
						{selectedStopIdx === i
							? 'border-white shadow-[0_0_0_2px_rgba(59,130,246,0.8)]'
							: 'border-neutral-300 hover:border-white'}"
					style="left: {(stop.stop * 100).toFixed(2)}%; background: {stop.color}"
					onpointerdown={(e) => onHandlePointerDown(e, i)}
					onpointermove={onHandlePointerMove}
					onpointerup={onHandlePointerUp}
					ondblclick={(e) => onHandleDblClick(e, i)}
					onclick={() => (selectedStopIdx = i)}
					aria-label="Color stop at {(stop.stop * 100).toFixed(0)}%"
				></button>
			{/each}
		</div>

		<!-- Selected stop controls -->
		{#if selectedStopIdx !== null && selectedStopIdx < viewerState.colors.palette.length}
			{@const stop = viewerState.colors.palette[selectedStopIdx]}
			<div class="flex items-center gap-2 pt-1">
				<label for="stop-color" class="text-xs text-neutral-400 shrink-0">Color</label>
				<input
					id="stop-color"
					type="color"
					class="w-8 h-7 rounded border border-neutral-700 cursor-pointer p-0 bg-transparent"
					value={stop.color}
					oninput={(e) => updateStop(selectedStopIdx!, { color: (e.target as HTMLInputElement).value })}
				/>
				<label for="stop-position" class="text-xs text-neutral-400 shrink-0">Position</label>
				<input
					id="stop-position"
					type="number"
					class="w-16 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
					min="0"
					max="1"
					step="0.01"
					value={stop.stop.toFixed(3)}
					onchange={(e) => {
						const v = parseFloat((e.target as HTMLInputElement).value);
						if (!isNaN(v)) updateStop(selectedStopIdx!, { stop: Math.max(0, Math.min(1, v)) });
					}}
					onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
				/>
				<label for="stop-hex" class="text-xs text-neutral-400 shrink-0">Hex</label>
				<input
					id="stop-hex"
					type="text"
					class="w-20 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
					value={stop.color}
					onblur={(e) => {
						const v = (e.target as HTMLInputElement).value.trim();
						const raw = v.startsWith('#') ? v : '#' + v;
						let hex = raw;
						if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
							hex = '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
						}
						if (/^#[0-9a-fA-F]{6}$/.test(hex)) updateStop(selectedStopIdx!, { color: hex });
						else (e.target as HTMLInputElement).value = stop.color;
					}}
					onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
				/>
				<button
					class="ml-auto px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-red-400 hover:border-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					onclick={() => deleteStop(selectedStopIdx!)}
					disabled={viewerState.colors.palette.length <= 2}
					title="Delete stop (minimum 2 stops)"
				>Delete</button>
			</div>
		{:else}
			<p class="text-xs text-neutral-600 pt-1">Click a handle to edit. Double-click bar to add. Double-click handle to delete.</p>
		{/if}

		<!-- Cycle Period -->
		<div class="flex items-center gap-2 pt-1">
			<label class="text-neutral-400 text-xs shrink-0 w-20 {baseAlgorithm(viewerState.colors.algorithm) === 'histogram' ? 'opacity-30' : ''}" for="pe-cyclePeriod">Cycle Period</label>
			<input
				id="pe-cyclePeriod"
				type="range"
				min="4"
				max="256"
				step="1"
				value={viewerState.colors.cyclePeriod}
				oninput={(e) => { viewerState.colors = { ...viewerState.colors, cyclePeriod: parseInt((e.target as HTMLInputElement).value) }; }}
				use:wheelSlider
				disabled={baseAlgorithm(viewerState.colors.algorithm) === 'histogram'}
				class="flex-1 min-w-0 accent-blue-500 disabled:opacity-30"
			/>
			<input
				type="text"
				disabled={baseAlgorithm(viewerState.colors.algorithm) === 'histogram'}
				class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right disabled:opacity-30"
				value={viewerState.colors.cyclePeriod}
				onblur={(e) => {
					const v = parseInt((e.target as HTMLInputElement).value);
					if (!isNaN(v) && v > 0) viewerState.colors = { ...viewerState.colors, cyclePeriod: v };
				}}
				onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
			/>
		</div>

		<!-- Offset -->
		<div class="flex items-center gap-2">
			<label class="text-neutral-400 text-xs shrink-0 w-20" for="pe-offset">Offset</label>
			<input
				id="pe-offset"
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={viewerState.colors.offset}
				oninput={(e) => { viewerState.colors = { ...viewerState.colors, offset: parseFloat((e.target as HTMLInputElement).value) }; }}
				use:wheelSlider
				class="flex-1 min-w-0 accent-blue-500"
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

		<!-- In-set color + Reverse -->
		<div class="flex items-center gap-3">
			<label class="text-neutral-400 text-xs shrink-0" for="pe-inSetColor">In-set color</label>
			<input
				id="pe-inSetColor"
				type="color"
				class="w-8 h-6 rounded border border-neutral-700 cursor-pointer p-0 bg-transparent"
				value={viewerState.colors.inSetColor ?? '#000000'}
				oninput={(e) => { viewerState.colors = { ...viewerState.colors, inSetColor: (e.target as HTMLInputElement).value }; }}
			/>
			<button
				class="px-2 py-0.5 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
				onclick={() => { viewerState.colors = { ...viewerState.colors, inSetColor: '#000000' }; }}
				title="Reset to black"
			>Reset</button>
			<button
				class="ml-auto px-2 py-1 rounded text-xs border transition-colors
					{viewerState.colors.reverse
						? 'border-blue-600 bg-blue-900/40 text-blue-300'
						: 'border-neutral-700 text-neutral-400 hover:text-white'}"
				onclick={() => { viewerState.colors = { ...viewerState.colors, reverse: !viewerState.colors.reverse }; }}
				title="Reverse palette"
			>⇄ Reverse</button>
		</div>

	</div>
</div>

{#if showSaveModal}
	<SavePaletteModal
		config={viewerState.colors}
		initialName={activePaletteName ?? ''}
		onSave={handleSaveModalSave}
		onCancel={() => (showSaveModal = false)}
	/>
{/if}
