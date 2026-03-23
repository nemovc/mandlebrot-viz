<script lang="ts">
	import { animationState } from '$lib/stores/animationState.svelte';
	import type { EasingType } from '$lib/stores/animationState.svelte';

	let { trackIdx, keyframeIdx }: { trackIdx: number; keyframeIdx: number } = $props();

	const track = $derived(animationState.project.tracks[trackIdx]);
	const kf = $derived(track?.keyframes[keyframeIdx]);

	const EASINGS: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier'];

	function update(patch: Partial<typeof kf>) {
		if (!kf) return;
		const updated = { ...kf, ...patch };
		animationState.project.tracks[trackIdx].keyframes[keyframeIdx] = updated;
	}
</script>

{#if kf}
	<div class="flex flex-col gap-3 p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-sm">
		<div class="text-neutral-400 text-xs font-medium uppercase tracking-wider">
			Keyframe — {track.parameter}
		</div>

		<div>
			<label class="text-neutral-400 text-xs" for="kf-time">Time (s)</label>
			<input
				id="kf-time"
				type="number"
				step="0.1"
				min="0"
				max={animationState.project.duration}
				value={kf.time}
				oninput={(e) => update({ time: parseFloat((e.target as HTMLInputElement).value) })}
				class="w-full mt-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
			/>
		</div>

		<div>
			<label class="text-neutral-400 text-xs" for="kf-value">Value</label>
			<input
				id="kf-value"
				type="text"
				value={kf.value}
				oninput={(e) => update({ value: (e.target as HTMLInputElement).value })}
				class="w-full mt-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
			/>
		</div>

		<div>
			<label class="text-neutral-400 text-xs" for="kf-easing">Easing</label>
			<select
				id="kf-easing"
				class="w-full mt-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
				value={kf.easing}
				onchange={(e) => update({ easing: (e.target as HTMLSelectElement).value as EasingType })}
			>
				{#each EASINGS as e}
					<option value={e}>{e}</option>
				{/each}
			</select>
		</div>
	</div>
{:else}
	<div class="text-neutral-600 text-sm p-3">Select a keyframe to edit.</div>
{/if}
