<script lang="ts">
	import { savedProjects } from '$lib/stores/savedProjects.svelte';
	import type { AnimationProject } from '$lib/stores/animationState.svelte';

	let {
		currentProject,
		onSaveAndNew,
		onDiscardAndNew,
		onCancel
	}: {
		currentProject: AnimationProject;
		onSaveAndNew: (name: string) => void;
		onDiscardAndNew: () => void;
		onCancel: () => void;
	} = $props();

	let nameInput = $state('');
	let errorMsg = $state<string | null>(null);
	let confirmOverwrite = $state(false);

	$effect(() => {
		nameInput;
		confirmOverwrite = false;
		errorMsg = null;
	});

	function handleSaveAndNew() {
		const newName = nameInput.trim();
		const err = savedProjects.validateName(newName);
		if (err) {
			errorMsg = err;
			return;
		}
		if (savedProjects.exists(newName) && !confirmOverwrite) {
			confirmOverwrite = true;
			return;
		}
		savedProjects.save(newName, currentProject);
		onSaveAndNew(newName);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSaveAndNew();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<div
	class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
	role="dialog"
	aria-modal="true"
	aria-label="New project"
>
	<div
		class="w-80 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl p-4 flex flex-col gap-3"
	>
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium text-white">New Project</span>
			<button
				class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
				onclick={onCancel}
				aria-label="Close">✕</button
			>
		</div>

		<p class="text-xs text-neutral-400">Save the current project before continuing?</p>

		<div class="flex flex-col gap-1">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
				placeholder="Project name"
				maxlength="48"
				bind:value={nameInput}
				onkeydown={handleKeydown}
				autofocus
			/>
			{#if errorMsg}
				<p class="text-red-400 text-xs">{errorMsg}</p>
			{/if}
			{#if confirmOverwrite}
				<p class="text-yellow-500 text-xs">Already saved — click "Save & New" to overwrite.</p>
			{/if}
		</div>

		<div class="flex gap-2">
			<button
				class="flex-1 px-2 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
				onclick={handleSaveAndNew}>{confirmOverwrite ? 'Confirm & New' : 'Save & New'}</button
			>
			<button
				class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
				onclick={onDiscardAndNew}>Discard & New</button
			>
		</div>
	</div>
</div>
