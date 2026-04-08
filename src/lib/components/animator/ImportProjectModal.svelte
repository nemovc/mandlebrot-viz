<script lang="ts">
	import { savedProjects } from '$lib/stores/savedProjects.svelte';
	import type { AnimationProject } from '$lib/stores/animationState.svelte';

	let {
		onImport,
		onCancel
	}: {
		onImport: (project: AnimationProject) => void;
		onCancel: () => void;
	} = $props();

	let jsonInput = $state('');
	let errorMsg = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	function handleImport() {
		if (!jsonInput.trim()) {
			errorMsg = 'Paste JSON or load a file first';
			return;
		}
		const result = savedProjects.parseImport(jsonInput);
		if (typeof result === 'string') {
			errorMsg = result;
			return;
		}
		onImport(result);
	}

	function handleFileLoad() {
		fileInput.click();
	}

	function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			jsonInput = (ev.target?.result as string) ?? '';
			errorMsg = null;
		};
		reader.readAsText(file);
		// Reset so the same file can be re-loaded
		(e.target as HTMLInputElement).value = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
	role="dialog"
	aria-modal="true"
	aria-label="Import project"
>
	<div
		class="w-[520px] max-w-[95vw] rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl p-4 flex flex-col gap-3"
	>
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium text-white">Import Project</span>
			<button
				class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
				onclick={onCancel}
				aria-label="Close">✕</button
			>
		</div>

		<textarea
			class="w-full h-48 bg-neutral-800 text-neutral-300 text-[11px] font-mono rounded border border-neutral-700 px-2 py-1.5 resize-none outline-none focus:border-blue-500"
			placeholder="Paste project JSON here…"
			bind:value={jsonInput}
			oninput={() => (errorMsg = null)}
		></textarea>

		{#if errorMsg}
			<p class="text-red-400 text-xs -mt-1">{errorMsg}</p>
		{/if}

		<input
			type="file"
			accept=".json,application/json"
			class="hidden"
			bind:this={fileInput}
			onchange={handleFileChange}
		/>

		<div class="flex gap-2 justify-between">
			<button
				class="px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
				onclick={handleFileLoad}>Load from .json file…</button
			>

			<div class="flex gap-2">
				<button
					class="px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
					onclick={onCancel}>Cancel</button
				>
				<button
					class="px-3 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
					onclick={handleImport}>Import</button
				>
			</div>
		</div>
	</div>
</div>
