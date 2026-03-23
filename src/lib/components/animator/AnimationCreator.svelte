<script lang="ts">
	import Timeline from './Timeline.svelte';
	import KeyframeEditor from './KeyframeEditor.svelte';
	import { animationState } from '$lib/stores/animationState.svelte';
	import type { TrackParameter } from '$lib/stores/animationState.svelte';

	let selectedTrack = $state<number | null>(null);
	let selectedKeyframe = $state<number | null>(null);

	const TRACK_PARAMS: TrackParameter[] = ['cx', 'cy', 'zoom', 'maxIter', 'colorOffset', 'colorCycle'];

	function addTrack(param: TrackParameter) {
		animationState.addTrack(param);
		selectedTrack = animationState.project.tracks.length - 1;
	}

	function addKeyframeAtPlayhead() {
		if (selectedTrack === null) return;
		animationState.addKeyframe(selectedTrack, {
			time: animationState.currentTime,
			value: 0,
			easing: 'linear'
		});
	}

	function togglePlay() {
		animationState.playing = !animationState.playing;
	}

	function formatTime(t: number): string {
		const m = Math.floor(t / 60);
		const s = (t % 60).toFixed(1).padStart(4, '0');
		return `${m}:${s}`;
	}
</script>

<div class="flex flex-col h-full bg-neutral-950 text-white">
	<!-- Preview area placeholder -->
	<div class="flex-1 min-h-0 bg-black flex items-center justify-center text-neutral-600">
		<span>Animation preview (Stage 1 GPU)</span>
	</div>

	<!-- Transport -->
	<div class="flex items-center gap-3 px-4 py-2 bg-neutral-900 border-t border-neutral-800">
		<button class="text-white hover:text-blue-400" onclick={togglePlay} title="Play/Pause">
			{animationState.playing ? '⏸' : '▶'}
		</button>
		<span class="font-mono text-sm text-neutral-300">
			{formatTime(animationState.currentTime)} / {formatTime(animationState.project.duration)}
		</span>
		<div class="flex-1"></div>
		<label class="text-xs text-neutral-400">Duration
			<input
				type="number"
				min="1"
				max="600"
				step="1"
				value={animationState.project.duration}
				oninput={(e) => (animationState.project.duration = parseFloat((e.target as HTMLInputElement).value))}
				class="ml-1 w-16 bg-neutral-800 text-white rounded px-1 py-0.5 text-xs border border-neutral-700"
			/>s
		</label>
	</div>

	<!-- Timeline -->
	<div class="px-4 py-3 bg-neutral-900 border-t border-neutral-800">
		<Timeline
			onSelectKeyframe={(ti, ki) => {
				selectedTrack = ti;
				selectedKeyframe = ki;
			}}
		/>

		<div class="flex gap-2 mt-3 flex-wrap">
			<span class="text-xs text-neutral-500">Add track:</span>
			{#each TRACK_PARAMS as p}
				<button
					class="text-xs px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 text-neutral-300"
					onclick={() => addTrack(p)}
				>{p}</button>
			{/each}
			{#if selectedTrack !== null}
				<button
					class="text-xs px-2 py-0.5 bg-blue-800 hover:bg-blue-700 rounded border border-blue-700 text-white ml-auto"
					onclick={addKeyframeAtPlayhead}
				>+ Keyframe at {formatTime(animationState.currentTime)}</button>
			{/if}
		</div>
	</div>

	<!-- Keyframe editor -->
	{#if selectedTrack !== null && selectedKeyframe !== null}
		<div class="p-3 border-t border-neutral-800">
			<KeyframeEditor trackIdx={selectedTrack} keyframeIdx={selectedKeyframe} />
		</div>
	{/if}

	<!-- Export stub -->
	<div class="px-4 py-2 bg-neutral-900 border-t border-neutral-800 flex items-center gap-3">
		<button
			class="px-3 py-1.5 text-sm bg-neutral-700 text-neutral-400 rounded cursor-not-allowed"
			disabled
			title="Export pipeline coming soon"
		>
			Export {animationState.project.width}×{animationState.project.height} @ {animationState.project.fps}fps WebM
		</button>
		<span class="text-xs text-neutral-600">(export pipeline: coming soon)</span>
	</div>
</div>
