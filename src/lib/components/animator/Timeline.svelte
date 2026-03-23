<script lang="ts">
	import { animationState } from '$lib/stores/animationState.svelte';

	let { onSelectKeyframe }: { onSelectKeyframe?: (trackIdx: number, timeIdx: number) => void } = $props();

	const { project, currentTime } = $derived(animationState);

	function onTrackClick(e: MouseEvent, trackEl: HTMLDivElement, trackIdx: number) {
		const rect = trackEl.getBoundingClientRect();
		const t = ((e.clientX - rect.left) / rect.width) * project.duration;
		animationState.currentTime = Math.max(0, Math.min(t, project.duration));
	}

	function keyframeX(time: number): string {
		return `${(time / project.duration) * 100}%`;
	}
</script>

<div class="flex flex-col gap-1 select-none">
	<!-- Time ruler -->
	<div class="relative h-5 bg-neutral-800 rounded text-xs text-neutral-500 overflow-hidden">
		{#each Array.from({ length: Math.floor(project.duration) + 1 }, (_, i) => i) as s}
			<div
				class="absolute top-0 bottom-0 border-l border-neutral-600 flex items-center pl-0.5"
				style="left: {(s / project.duration) * 100}%"
			>
				{s}s
			</div>
		{/each}
		<!-- Playhead -->
		<div
			class="absolute top-0 bottom-0 w-0.5 bg-blue-400"
			style="left: {(currentTime / project.duration) * 100}%"
		></div>
	</div>

	{#each project.tracks as track, trackIdx}
		<div class="flex items-center gap-2">
			<div class="w-20 text-xs text-neutral-400 shrink-0 text-right">{track.parameter}</div>
			<div
				class="relative flex-1 h-8 bg-neutral-800 rounded cursor-crosshair"
				role="slider"
				aria-label={track.parameter}
				aria-valuenow={currentTime}
				tabindex="0"
				onclick={(e) => {
					const el = e.currentTarget as HTMLDivElement;
					onTrackClick(e, el, trackIdx);
				}}
				onkeydown={() => {}}
			>
				{#each track.keyframes as kf, kfIdx}
					<button
						class="absolute top-1 bottom-1 w-3 -translate-x-1.5 bg-blue-500 hover:bg-blue-400 rounded-sm cursor-pointer"
						style="left: {keyframeX(kf.time)}"
						onclick={(e) => {
							e.stopPropagation();
							onSelectKeyframe?.(trackIdx, kfIdx);
						}}
						title="{kf.time.toFixed(2)}s = {kf.value}"
					></button>
				{/each}
				<!-- Playhead -->
				<div
					class="absolute top-0 bottom-0 w-0.5 bg-blue-400 pointer-events-none"
					style="left: {(currentTime / project.duration) * 100}%"
				></div>
			</div>
		</div>
	{/each}

	{#if project.tracks.length === 0}
		<div class="text-neutral-600 text-sm text-center py-4">No tracks. Add a parameter track below.</div>
	{/if}
</div>
