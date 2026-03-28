<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { debugState } from '$lib/stores/debugState.svelte';
	import { encodeState } from '$lib/utils/urlSerializer';
	import CollapsiblePanel from './CollapsiblePanel.svelte';

	let { onResetView, onExport }: { onResetView: () => void; onExport: () => void } = $props();

	let shareCopied = $state(false);

	function shareLink() {
		const encoded = encodeState(viewerState.toJSON(), debugState.toJSON());
		navigator.clipboard.writeText(`${location.origin}${location.pathname}#${encoded}`);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}
</script>

<CollapsiblePanel title="Actions" position="bottom-right">
	<div class="flex flex-col gap-1.5 p-3">
		<button
			class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
			onclick={onResetView}>Reset View</button
		>
		<button
			class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
			onclick={shareLink}
			>{#if shareCopied}<span class="text-green-400">✓ Copied</span>{:else}Share Link{/if}</button
		>
		<button
			class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
			onclick={onExport}>Export Image</button
		>
	</div>
</CollapsiblePanel>
