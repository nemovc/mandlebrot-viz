<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';

	let iterInput = $derived(viewerState.maxIter);

	function onIterChange(e: Event) {
		viewerState.maxIter = parseInt((e.target as HTMLInputElement).value);
	}
</script>

<div class="flex flex-col gap-3 p-3 text-sm bg-neutral-900 rounded-lg border border-neutral-800 min-w-48">
	<div>
		<div class="text-neutral-400 text-xs mb-1">Zoom</div>
		<div class="font-mono text-white">{viewerState.zoom}</div>
	</div>

	<div>
		<div class="text-neutral-400 text-xs mb-1">Center</div>
		<div class="font-mono text-white text-xs break-all">{viewerState.cx}</div>
		<div class="font-mono text-white text-xs break-all">{viewerState.cy}i</div>
	</div>

	<div>
		<label class="text-neutral-400 text-xs" for="maxIter">Max Iterations</label>
		<div class="flex items-center gap-2 mt-1">
			<input
				id="maxIter"
				type="range"
				min="64"
				max="4096"
				step="64"
				value={iterInput}
				oninput={onIterChange}
				class="flex-1 accent-blue-500"
			/>
			<span class="font-mono text-white w-12 text-right">{viewerState.maxIter}</span>
		</div>
	</div>
</div>
