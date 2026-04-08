<script lang="ts">
	import type { AnimationProject } from '$lib/stores/animationState.svelte';

	let {
		project,
		projectName,
		onClose
	}: {
		project: AnimationProject;
		projectName: string | null;
		onClose: () => void;
	} = $props();

	const json = $derived(JSON.stringify(project, null, 2));
	let copied = $state(false);

	function handleClick() {
		navigator.clipboard.writeText(json).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 1500);
		});
	}

	function handleDownload() {
		const filename = (projectName ?? 'untitled').replace(/[^a-zA-Z0-9 ]/g, '_') + '.json';
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
	role="dialog"
	aria-modal="true"
	aria-label="Export project"
>
	<div
		class="w-[520px] max-w-[95vw] rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl p-4 flex flex-col gap-3"
	>
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium text-white">Export Project</span>
			<button
				class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
				onclick={onClose}
				aria-label="Close">✕</button
			>
		</div>

		<p class="text-xs text-neutral-500">Click the text field to copy JSON to clipboard.</p>

		<textarea
			class="w-full h-48 bg-neutral-800 text-neutral-300 text-[11px] font-mono rounded border border-neutral-700 px-2 py-1.5 resize-none outline-none focus:border-blue-500 cursor-pointer select-all"
			readonly
			value={json}
			onclick={handleClick}
			title="Click to copy"
		></textarea>

		{#if copied}
			<p class="text-green-400 text-xs -mt-1">Copied to clipboard!</p>
		{/if}

		<div class="flex gap-2 justify-end">
			<button
				class="px-3 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
				onclick={handleDownload}>Download .json</button
			>
			<button
				class="px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
				onclick={onClose}>Close</button
			>
		</div>
	</div>
</div>
