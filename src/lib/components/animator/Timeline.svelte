<script lang="ts">
	import { animationState, TRACK_LABELS } from '$lib/stores/animationState.svelte';
	import { interpolateTrack } from '$lib/utils/animator/interpolation';
	import { baseAlgorithm } from '$lib/utils/colorPalettes';
	import { frameCache } from '$lib/utils/animator/frameCache.svelte';

	const CELL_W = 10; // px per frame
	const GRID_BG = `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent ${CELL_W * 10}px)`;

	let { selectedTrack = $bindable<number | null>(null) } = $props();

	let scrollEl: HTMLDivElement;
	let contentEl: HTMLDivElement;

	const project = $derived(animationState.project);
	const totalFrames = $derived(project.totalFrames);
	const currentFrame = $derived(animationState.currentFrame);
	const isHistogram = $derived(baseAlgorithm(project.algorithm) === 'histogram');

	// Cached frame ranges for the ruler strip
	const cachedRanges = $derived(frameCache.ranges);

	const disabledTracks = $derived(
		new Set(
			isHistogram
				? project.tracks
						.map((t, i) => (t.parameter === 'cyclePeriod' ? i : -1))
						.filter((i) => i >= 0)
				: []
		)
	);

	// Deselect track if it becomes disabled (e.g. switching to histogram while cyclePeriod selected)
	$effect(() => {
		if (selectedTrack !== null && disabledTracks.has(selectedTrack)) {
			selectedTrack = null;
		}
	});

	// Auto-scroll playhead into view
	$effect(() => {
		const frame = currentFrame;
		if (!scrollEl) return;
		const px = frame * CELL_W + CELL_W / 2;
		const { scrollLeft, clientWidth } = scrollEl;
		const margin = CELL_W * 8;
		if (px < scrollLeft + margin) {
			scrollEl.scrollLeft = Math.max(0, px - margin);
		} else if (px > scrollLeft + clientWidth - margin) {
			scrollEl.scrollLeft = px - clientWidth + margin;
		}
	});

	// Ruler markers
	const rulerInterval = $derived(
		totalFrames <= 100 ? 5 : totalFrames <= 600 ? 10 : totalFrames <= 1800 ? 30 : 60
	);
	const rulerMarkers = $derived(() => {
		const out: { x: number; label: string }[] = [];
		for (let f = 0; f <= totalFrames; f += rulerInterval) {
			out.push({ x: f * CELL_W, label: (f + 1).toString() });
		}
		return out;
	});

	// ---- Frame calculation from a clientX ----
	function frameFromClientX(clientX: number): number | null {
		const rect = contentEl.getBoundingClientRect();
		const x = clientX - rect.left;
		const frame = Math.max(0, Math.min(Math.floor(x / CELL_W), totalFrames));
		return frame > totalFrames - 1 ? null : frame;
	}

	// ---- Hover highlight ----
	let hoveredFrame = $state<number | null>(null);
	let hoveredTrackIdx = $state<number | null>(null);

	function onContentMouseMove(e: MouseEvent) {
		hoveredFrame = frameFromClientX(e.clientX);
	}

	function onContentMouseLeave() {
		hoveredFrame = null;
		hoveredTrackIdx = null;
	}

	// ---- Scrubbing (click-drag on ruler or track rows) ----
	let scrubbing = $state(false);

	function startScrub(e: MouseEvent, trackIdx?: number) {
		if (dragInfo) return;
		e.preventDefault();
		(document.activeElement as HTMLElement)?.blur();
		scrubbing = true;
		if (trackIdx !== undefined) selectedTrack = trackIdx;
		const frame = frameFromClientX(e.clientX);
		if (frame !== null) animationState.currentFrame = frame;
	}

	// ---- Double-click: create or delete keyframe ----
	function handleDblClick(e: MouseEvent, trackIdx: number) {
		const frame = frameFromClientX(e.clientX);
		if (frame === null) return;
		const track = project.tracks[trackIdx];
		selectedTrack = trackIdx;
		animationState.currentFrame = frame;
		const existing = track.keyframes.find((k) => k.frame === frame);
		if (existing) {
			if (frame !== 0 && frame !== totalFrames) animationState.removeKeyframe(trackIdx, frame);
		} else {
			animationState.addKeyframe(trackIdx, frame, interpolateTrack(track, frame, totalFrames));
		}
	}

	// ---- Keyframe drag ----
	interface DragInfo {
		trackIdx: number;
		fromFrame: number;
		toFrame: number;
		startX: number;
	}
	let dragInfo = $state<DragInfo | null>(null);

	function startKeyframeDrag(e: MouseEvent, trackIdx: number, frame: number) {
		e.stopPropagation();
		e.preventDefault();
		animationState.currentFrame = frame;
		selectedTrack = trackIdx;
		if (frame === 0 || frame === totalFrames) return; // anchor keyframes are immovable
		dragInfo = { trackIdx, fromFrame: frame, toFrame: frame, startX: e.clientX };
	}

	// ---- Shared window handlers ----
	function onMouseMove(e: MouseEvent) {
		if (dragInfo) {
			const delta = Math.round((e.clientX - dragInfo.startX) / CELL_W);
			const clamped = Math.max(0, Math.min(dragInfo.fromFrame + delta, totalFrames - 1));
			if (clamped !== dragInfo.toFrame) dragInfo = { ...dragInfo, toFrame: clamped };
		} else if (scrubbing) {
			const frame = frameFromClientX(e.clientX);
			if (frame !== null) animationState.currentFrame = frame;
		}
	}

	function onMouseUp() {
		if (dragInfo) {
			const { trackIdx, fromFrame, toFrame } = dragInfo;
			dragInfo = null;
			if (fromFrame !== toFrame) {
				animationState.moveKeyframe(trackIdx, fromFrame, toFrame);
				animationState.currentFrame = toFrame;
			}
		}
		scrubbing = false;
	}

	const contentWidth = $derived(totalFrames * CELL_W);
	const playheadX = $derived(currentFrame * CELL_W + CELL_W / 2);
	const hoverX = $derived(hoveredFrame !== null ? hoveredFrame * CELL_W : null);
	const ghostX = $derived(dragInfo ? dragInfo.toFrame * CELL_W + CELL_W / 2 : null);
	const activeCursor = $derived(dragInfo ? 'grabbing' : scrubbing ? 'col-resize' : 'default');
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<div class="flex overflow-hidden text-[11px] select-none" style="cursor: {activeCursor}">
	<!-- Label column (fixed, doesn't scroll) -->
	<div class="w-20 shrink-0 flex flex-col border-r border-neutral-800 bg-neutral-900">
		<div class="h-6 border-b border-neutral-800 shrink-0"></div>
		{#each project.tracks as track, i (track.parameter)}
			{@const disabled = disabledTracks.has(i)}
			<button
				class="h-10 flex items-center justify-end pr-2 shrink-0 w-full border-b border-neutral-800/40 transition-colors text-right
					{disabled
					? 'text-neutral-600 cursor-not-allowed bg-neutral-700 opacity-60'
					: selectedTrack === i
						? 'text-neutral-200 bg-neutral-800/40'
						: hoveredTrackIdx === i
							? 'text-neutral-300 bg-white/10'
							: 'text-neutral-500'}"
				onclick={() => {
					if (!disabled) selectedTrack = selectedTrack === i ? null : i;
				}}
				onmouseenter={() => (hoveredTrackIdx = i)}
				onmouseleave={() => (hoveredTrackIdx = null)}
				title={disabled ? 'Not available for histogram coloring' : undefined}
			>
				{TRACK_LABELS[track.parameter]}
			</button>
		{/each}
	</div>

	<!-- Scrollable content -->
	<div bind:this={scrollEl} class="flex-1 overflow-x-auto overflow-y-hidden pr-44">
		<div
			bind:this={contentEl}
			class="relative"
			style="width: {contentWidth}px"
			onmousemove={onContentMouseMove}
			onmouseleave={onContentMouseLeave}
			role="none"
		>
			<!-- Ruler — draggable to scrub -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="h-6 relative border-b border-neutral-800 bg-neutral-900/80 shrink-0 overflow-hidden"
				onmousedown={(e) => startScrub(e)}
			>
				{#each rulerMarkers() as m (m.x)}
					<div
						class="absolute top-0 h-full flex items-end pb-0.5 pl-0.5 text-neutral-600 border-l border-neutral-700/60 pointer-events-none"
						style="left: {m.x}px"
					>
						{m.label}
					</div>
				{/each}
				<!-- Cached frames strip -->
				{#each cachedRanges as range (`${range.start}-${range.end}`)}
					<div
						class="absolute bottom-0 h-0.5 bg-blue-400/50 pointer-events-none"
						style="left: {range.start * CELL_W}px; width: {(range.end - range.start + 1) *
							CELL_W}px"
					></div>
				{/each}
				<!-- Hover column on ruler -->
				{#if hoverX !== null}
					<div
						class="absolute top-0 h-full pointer-events-none bg-white/10"
						style="left: {hoverX}px; width: {CELL_W}px"
					></div>
				{/if}
				<div
					class="absolute top-0 h-full w-px bg-blue-400/80 pointer-events-none"
					style="left: {playheadX}px"
				></div>
			</div>

			<!-- Track rows -->
			{#each project.tracks as track, i (track.parameter)}
				{@const disabled = disabledTracks.has(i)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative h-10 border-b border-neutral-800/40
						{disabled
						? 'bg-neutral-700 opacity-60'
						: selectedTrack === i
							? 'bg-neutral-800/25'
							: 'bg-neutral-900'}"
					style="background-image: {GRID_BG};"
					onmousedown={(e) => {
						if (!disabled) startScrub(e, i);
					}}
					onmouseenter={() => (hoveredTrackIdx = i)}
					ondblclick={(e) => {
						if (!disabled) handleDblClick(e, i);
					}}
				>
					<!-- Hover row highlight -->
					{#if hoveredTrackIdx === i}
						<div
							class="absolute inset-0 pointer-events-none"
							style="background: rgba(255,255,255,0.05)"
						></div>
					{/if}
					<!-- Selected cell highlight (selectedTrack × currentFrame) -->
					{#if selectedTrack === i}
						<div
							class="absolute top-0 bottom-0 pointer-events-none ring-1 ring-inset ring-blue-400/60"
							style="left: {currentFrame *
								CELL_W}px; width: {CELL_W}px; background: rgba(96,165,250,0.15)"
						></div>
					{/if}
					<!-- Hover column highlight -->
					{#if hoverX !== null}
						<div
							class="absolute top-0 bottom-0 pointer-events-none"
							style="left: {hoverX}px; width: {CELL_W}px; background: {hoveredTrackIdx === i
								? 'rgba(96,165,250,0.18)'
								: 'rgba(255,255,255,0.05)'}"
						></div>
					{/if}

					<!-- Keyframe markers -->
					{#each track.keyframes as kf (kf.frame)}
						{@const isDragging = dragInfo?.trackIdx === i && dragInfo.fromFrame === kf.frame}
						{@const displayFrame = isDragging ? dragInfo!.toFrame : kf.frame}
						{@const easingColor =
							(
								{
									linear: 'bg-blue-500 hover:bg-blue-400',
									'ease-in': 'bg-purple-500 hover:bg-purple-400',
									'ease-out': 'bg-green-500 hover:bg-green-400',
									'ease-in-out': 'bg-amber-500 hover:bg-amber-400'
								} as Record<string, string>
							)[kf.easing] ?? 'bg-blue-500 hover:bg-blue-400'}
						{@const selectedColor =
							(
								{
									linear: 'bg-blue-300 ring-blue-200/50',
									'ease-in': 'bg-purple-300 ring-purple-200/50',
									'ease-out': 'bg-green-300 ring-green-200/50',
									'ease-in-out': 'bg-amber-300 ring-amber-200/50'
								} as Record<string, string>
							)[kf.easing] ?? 'bg-blue-300 ring-blue-200/50'}
						<button
							class="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rotate-45 transition-colors
								{kf.frame === 0 || kf.frame === totalFrames
								? 'cursor-default'
								: isDragging
									? 'cursor-grabbing'
									: 'cursor-grab'}
								{selectedTrack === i && currentFrame === kf.frame ? `${selectedColor} ring-1` : easingColor}
								{isDragging ? 'opacity-50' : ''}"
							style="left: {displayFrame * CELL_W + CELL_W / 2 - 5}px"
							onmousedown={(e) => {
								if (!disabled) startKeyframeDrag(e, i, kf.frame);
							}}
							title="Frame {kf.frame}: {kf.value} ({kf.easing})"
						></button>
					{/each}

					<div
						class="absolute top-0 bottom-0 w-px bg-blue-400/50 pointer-events-none"
						style="left: {playheadX}px"
					></div>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute top-1/2 -translate-y-1/2"
						style="left: calc({contentWidth}px + 0.5rem)"
						onmousedown={(e) => e.stopPropagation()}
					>
						{#if track.endFrame === null}
							<button
								onclick={() => animationState.addEndKeyframe(i)}
								class="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 transition-colors whitespace-nowrap"
							>
								<span class="text-blue-400">+</span> Add end keyframe
							</button>
						{:else}
							<div
								class="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300"
							>
								<span class="text-blue-400">◆</span>
								<input
									type="number"
									step="any"
									value={track.endFrame}
									onblur={(e) => {
										const v = parseFloat((e.target as HTMLInputElement).value);
										if (!isNaN(v)) animationState.updateEndKeyframe(i, v);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
										if (e.key === 'Escape') {
											(e.target as HTMLInputElement).value = String(track.endFrame);
											(e.target as HTMLInputElement).blur();
										}
									}}
									class="w-28 bg-neutral-800 text-white border border-neutral-600 rounded px-2 py-0.5 font-mono text-[11px] focus:outline-none focus:border-blue-500"
								/>
								<button
									onclick={() => animationState.removeEndKeyframe(i)}
									class="flex items-center justify-center w-4 h-4 text-[13px] leading-none text-neutral-500 hover:text-red-400 transition-colors"
									title="Remove end keyframe">✕</button
								>
							</div>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Keyframe ghost line during drag -->
			{#if ghostX !== null && dragInfo && dragInfo.fromFrame !== dragInfo.toFrame}
				<div
					class="absolute bottom-0 w-px bg-yellow-400/60 pointer-events-none"
					style="left: {ghostX}px; top: 24px"
				></div>
			{/if}
		</div>
	</div>
</div>
