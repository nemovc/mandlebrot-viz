<script lang="ts">
	import { animationState, TRACK_LABELS } from '$lib/stores/animationState.svelte';
	import { interpolateTrack } from '$lib/utils/animator/interpolation';

	let { trackIdx }: { trackIdx: number } = $props();

	const track = $derived(animationState.project.tracks[trackIdx]);
	const frame = $derived(animationState.currentFrame);
	const interpolated = $derived(track ? interpolateTrack(track, frame) : 0);
	const keyframeAtFrame = $derived(track?.keyframes.find((k) => k.frame === frame) ?? null);

	let editValue = $state('');

	// Sync edit field when keyframe or frame changes
	$effect(() => {
		editValue = keyframeAtFrame
			? keyframeAtFrame.value.toString()
			: interpolated.toFixed(6);
	});

	function addKeyframe() {
		animationState.addKeyframe(trackIdx, frame, interpolated);
	}

	function deleteKeyframe() {
		animationState.removeKeyframe(trackIdx, frame);
	}

	function commitEdit() {
		const v = parseFloat(editValue);
		if (isNaN(v)) return;
		if (keyframeAtFrame) {
			animationState.updateKeyframeValue(trackIdx, frame, v);
		} else {
			animationState.addKeyframe(trackIdx, frame, v);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
		if (e.key === 'Escape') {
			editValue = keyframeAtFrame?.value.toString() ?? interpolated.toFixed(6);
			(e.target as HTMLInputElement).blur();
		}
	}

	const label = $derived(track ? TRACK_LABELS[track.parameter] : '');
</script>

{#if track}
	<div class="flex items-center gap-3 px-3 py-2 bg-neutral-950 border-t border-neutral-800 text-[11px]">
		<span class="text-neutral-500 w-20 shrink-0 text-right">{label}</span>

		<span class="text-neutral-600">frame {frame}</span>

		{#if keyframeAtFrame}
			<!-- Editing an existing keyframe -->
			<span class="text-blue-400">◆</span>
			<input
				type="number"
				step="any"
				bind:value={editValue}
				onblur={commitEdit}
				onkeydown={onKeydown}
				class="w-36 bg-neutral-800 text-white border border-neutral-600 rounded px-2 py-0.5 font-mono text-[11px] focus:outline-none focus:border-blue-500"
			/>
			<button
				onclick={deleteKeyframe}
				class="text-neutral-500 hover:text-red-400 transition-colors px-1"
				title="Delete keyframe"
			>✕</button>
		{:else}
			<!-- No keyframe here — show interpolated value and option to add -->
			<span class="text-neutral-500 font-mono">{interpolated.toFixed(6)}</span>
			<button
				onclick={addKeyframe}
				class="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 transition-colors"
			>
				<span class="text-blue-400">+</span> Add keyframe
			</button>
		{/if}
	</div>
{/if}
