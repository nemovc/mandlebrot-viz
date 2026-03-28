<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import AnimatorPreview from './AnimatorPreview.svelte';
	import Timeline from './Timeline.svelte';
	import ExpandedTrack from './ExpandedTrack.svelte';
	import { animationState } from '$lib/stores/animationState.svelte';
	import { exportWebM, type ExportProgress } from '$lib/utils/animator/videoExporter';
	import { PRESETS } from '$lib/utils/colorPalettes';

	let selectedTrack = $state<number | null>(null);

	// Seed from explorer on first load if project is empty
	onMount(() => {
		const hasWork = animationState.project.tracks.some((t) => t.keyframes.length > 0);
		if (!hasWork) animationState.seedFromExplorer();
	});

	// ---- Keyboard shortcuts ----
	function handleKey(e: KeyboardEvent) {
		// Don't fire when typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

		if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
			e.preventDefault();
			animationState.undo();
		} else if (
			(e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
			(e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
		) {
			e.preventDefault();
			animationState.redo();
		} else if (e.key === 'ArrowLeft' && e.shiftKey) {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame - 10;
		} else if (e.key === 'ArrowRight' && e.shiftKey) {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame + 10;
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame - 1;
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame + 1;
		}
	}

	// ---- Settings helpers ----
	const project = $derived(animationState.project);

	function setFps(v: string) {
		const n = parseInt(v);
		if (n > 0 && n <= 120) animationState.updateProject({ fps: n });
	}
	function setTotalFrames(v: string) {
		const n = parseInt(v);
		if (n > 0 && n <= 100_000) animationState.updateProject({ totalFrames: n });
	}
	function setWidth(v: string) {
		const n = parseInt(v);
		if (n > 0) animationState.updateProject({ width: n });
	}
	function setHeight(v: string) {
		const n = parseInt(v);
		if (n > 0) animationState.updateProject({ height: n });
	}
	function setPower(v: string) {
		const n = parseInt(v);
		if (n >= 2 && n <= 10) animationState.updateProject({ power: n });
	}

	// Palette selector — show preset names
	const presetNames = Object.keys(PRESETS);
	const currentPresetName = $derived(
		presetNames.find(
			(name) => JSON.stringify(PRESETS[name].palette) === JSON.stringify(project.palette),
		) ?? 'Custom',
	);
	function applyPreset(name: string) {
		const p = PRESETS[name];
		if (!p) return;
		animationState.updateProject({
			algorithm: p.algorithm,
			palette: JSON.parse(JSON.stringify(p.palette)),
			inSetColor: p.inSetColor ?? '#000000',
			reverse: p.reverse ?? false,
		});
	}

	// Duration display helper
	const durationSecs = $derived((project.totalFrames / project.fps).toFixed(1));

	// Cancel/clear export whenever the project is mutated
	let exportWatchInitialized = false;
	$effect(() => {
		animationState.revision; // only dep we want
		if (!exportWatchInitialized) { exportWatchInitialized = true; return; }
		// untrack so reading exportPhase/exportUrl doesn't add them as dependencies
		untrack(() => {
			cancelExport();
			if (exportPhase !== 'idle') resetExport();
		});
	});

	// ---- Video export ----
	type ExportPhase = 'idle' | 'exporting' | 'done';
	let exportPhase = $state<ExportPhase>('idle');
	let exportProgress = $state<ExportProgress | null>(null);
	let exportUrl = $state('');
	let exportAbort: AbortController | null = null;

	async function startExport() {
		if (exportPhase === 'exporting') return;
		exportPhase = 'exporting';
		exportProgress = null;
		if (exportUrl) URL.revokeObjectURL(exportUrl);
		exportUrl = '';

		exportAbort = new AbortController();
		try {
			const blob = await exportWebM(
				JSON.parse(JSON.stringify(project)), // plain clone — no Svelte proxies
				(p) => (exportProgress = p),
				exportAbort.signal,
			);
			exportUrl = URL.createObjectURL(blob);
			exportPhase = 'done';
		} catch (e: any) {
			if (e.name !== 'AbortError') throw e;
			exportPhase = 'idle';
		} finally {
			exportAbort = null;
		}
	}

	function cancelExport() {
		exportAbort?.abort();
	}

	function saveVideo() {
		const a = document.createElement('a');
		a.href = exportUrl;
		a.download = `mandelbrot-${project.width}x${project.height}-${project.fps}fps.webm`;
		a.click();
	}

	function resetExport() {
		URL.revokeObjectURL(exportUrl);
		exportUrl = '';
		exportPhase = 'idle';
		exportProgress = null;
	}

	const exportProgressPct = $derived(() => {
		if (!exportProgress) return 0;
		return Math.round((exportProgress.frame / exportProgress.totalFrames) * 100);
	});
</script>

<svelte:window onkeydown={handleKey} />

<div class="flex flex-col h-full bg-neutral-950 text-white overflow-hidden">
	<!-- Preview (takes remaining vertical space) -->
	<div class="flex-1 min-h-0">
		<AnimatorPreview />
	</div>

	<!-- Settings bar -->
	<div class="shrink-0 flex items-center gap-3 px-3 py-1.5 bg-neutral-900 border-t border-neutral-800 text-[11px] flex-wrap">
		<label class="flex items-center gap-1 text-neutral-400">
			fps
			<input
				type="number"
				min="1"
				max="120"
				value={project.fps}
				onchange={(e) => setFps((e.target as HTMLInputElement).value)}
				class="w-12 bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			/>
		</label>

		<label class="flex items-center gap-1 text-neutral-400">
			frames
			<input
				type="number"
				min="1"
				value={project.totalFrames}
				onchange={(e) => setTotalFrames((e.target as HTMLInputElement).value)}
				class="w-16 bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			/>
			<span class="text-neutral-600">({durationSecs}s)</span>
		</label>

		<span class="text-neutral-700">·</span>

		<label class="flex items-center gap-1 text-neutral-400">
			W
			<input
				type="number"
				min="1"
				value={project.width}
				onchange={(e) => setWidth((e.target as HTMLInputElement).value)}
				class="w-16 bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			/>
		</label>
		<label class="flex items-center gap-1 text-neutral-400">
			H
			<input
				type="number"
				min="1"
				value={project.height}
				onchange={(e) => setHeight((e.target as HTMLInputElement).value)}
				class="w-16 bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			/>
		</label>

		<span class="text-neutral-700">·</span>

		<label class="flex items-center gap-1 text-neutral-400">
			power
			<input
				type="number"
				min="2"
				max="10"
				value={project.power}
				onchange={(e) => setPower((e.target as HTMLInputElement).value)}
				class="w-12 bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			/>
		</label>

		<span class="text-neutral-700">·</span>

		<label class="flex items-center gap-1 text-neutral-400">
			palette
			<select
				value={currentPresetName}
				onchange={(e) => applyPreset((e.target as HTMLSelectElement).value)}
				class="bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
			>
				{#each presetNames as name}
					<option value={name}>{name}</option>
				{/each}
				{#if currentPresetName === 'Custom'}
					<option value="Custom" disabled>Custom</option>
				{/if}
			</select>
		</label>

		<span class="text-neutral-700">·</span>

		<!-- Undo / Redo -->
		<div class="flex gap-1">
			<button
				onclick={() => animationState.undo()}
				disabled={!animationState.canUndo}
				class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				title="Undo (Ctrl+Z)"
			>↩</button>
			<button
				onclick={() => animationState.redo()}
				disabled={!animationState.canRedo}
				class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				title="Redo (Ctrl+Y)"
			>↪</button>
		</div>

	</div>

	<!-- Timeline -->
	<div class="shrink-0 border-t border-neutral-800">
		<Timeline bind:selectedTrack />
	</div>

	<!-- Expanded track editor -->
	{#if selectedTrack !== null}
		<ExpandedTrack trackIdx={selectedTrack} />
	{/if}

	<!-- Export bar -->
	<div class="shrink-0 flex items-center gap-3 px-3 py-2 bg-neutral-900 border-t border-neutral-800 text-[11px]">
		{#if exportPhase === 'idle'}
			<button
				onclick={startExport}
				class="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors text-[11px]"
			>
				Generate WebM — {project.width}×{project.height} @ {project.fps}fps
			</button>
			<span class="text-neutral-600">{project.totalFrames} frames · {durationSecs}s</span>
		{:else if exportPhase === 'exporting'}
			<div class="flex-1 flex items-center gap-3">
				<div class="flex-1 h-1.5 bg-neutral-700 rounded overflow-hidden">
					<div
						class="h-full bg-blue-500 transition-all"
						style="width: {exportProgressPct()}%"
					></div>
				</div>
				<span class="text-neutral-400 whitespace-nowrap">
					{exportProgress?.phase === 'encoding' ? 'Encoding' : 'Rendering'} frame
					{(exportProgress?.frame ?? 0) + 1}/{project.totalFrames}
					({exportProgressPct()}%)
				</span>
				<button onclick={cancelExport} class="text-red-400 hover:text-red-300 transition-colors">
					Cancel
				</button>
			</div>
		{:else if exportPhase === 'done'}
			<button
				onclick={saveVideo}
				class="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors text-[11px]"
			>
				Save WebM
			</button>
			<button
				onclick={resetExport}
				class="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 rounded transition-colors text-[11px]"
			>
				Export Another
			</button>
			<span class="text-neutral-500">Done</span>
		{/if}
	</div>
</div>
