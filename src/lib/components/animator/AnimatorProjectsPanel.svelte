<script lang="ts">
	import { savedProjects } from '$lib/stores/savedProjects.svelte';
	import type { AnimationProject } from '$lib/stores/animationState.svelte';

	let {
		activeProjectName,
		currentProject,
		onLoad,
		onSave,
		onExport,
		onImport,
		onClose
	}: {
		activeProjectName: string | null;
		currentProject: AnimationProject;
		onLoad: (project: AnimationProject, name: string) => void;
		onSave: (name: string) => void;
		onExport: () => void;
		onImport: () => void;
		onClose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let saveName = $state(activeProjectName ?? '');
	let saveError = $state<string | null>(null);
	let confirmOverwrite = $state(false);
	let pendingDelete = $state<string | null>(null);

	$effect(() => {
		saveName;
		confirmOverwrite = false;
		saveError = null;
	});

	const wouldOverwrite = $derived(savedProjects.exists(saveName.trim()));

	function confirmSave() {
		const err = savedProjects.validateName(saveName);
		if (err) {
			saveError = err;
			return;
		}
		if (wouldOverwrite && !confirmOverwrite) {
			confirmOverwrite = true;
			return;
		}
		savedProjects.save(saveName.trim(), currentProject);
		onSave(saveName.trim());
		confirmOverwrite = false;
	}
</script>

<div
	class="w-64 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl flex flex-col overflow-hidden"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
		<span class="text-xs font-medium uppercase tracking-wider text-neutral-400">Projects</span>
		<button
			class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
			onclick={onClose}
			aria-label="Close">✕</button
		>
	</div>

	<!-- Saved project list -->
	<div class="overflow-y-auto max-h-[40vh] p-2 flex flex-col gap-1">
		{#if savedProjects.all.length === 0}
			<p class="text-xs text-neutral-600 px-1 py-2">No saved projects yet.</p>
		{:else}
			{#each savedProjects.all as entry (entry.name)}
				{#if pendingDelete === entry.name}
					<div
						class="flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700"
					>
						<span class="text-xs text-neutral-300 flex-1 truncate">Delete "{entry.name}"?</span>
						<button
							class="text-xs px-2 py-0.5 rounded bg-red-700 border border-red-600 text-white hover:bg-red-600 transition-colors"
							onclick={() => {
								savedProjects.remove(entry.name);
								pendingDelete = null;
							}}>Yes</button
						>
						<button
							class="text-xs px-2 py-0.5 rounded border border-neutral-600 text-neutral-400 hover:text-white transition-colors"
							onclick={() => (pendingDelete = null)}>No</button
						>
					</div>
				{:else}
					<div class="relative group flex items-center gap-1">
						<button
							class="flex-1 text-left px-2 py-1 rounded text-xs transition-colors truncate
								{activeProjectName === entry.name
								? 'bg-blue-900/40 border border-blue-700 text-blue-300'
								: 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'}"
							onclick={() => onLoad(entry.project, entry.name)}>{entry.name}</button
						>
						<button
							class="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-700 transition-all opacity-0 group-hover:opacity-100 text-[10px] leading-none"
							onclick={(e) => {
								e.stopPropagation();
								pendingDelete = entry.name;
							}}
							aria-label="Delete {entry.name}">✕</button
						>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Export / Import -->
	<div class="px-2 py-2 border-t border-neutral-800 flex gap-1">
		<button
			class="flex-1 px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
			onclick={onExport}>Export JSON</button
		>
		<button
			class="flex-1 px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
			onclick={onImport}>Import JSON</button
		>
	</div>

	<!-- Save current -->
	<div class="px-2 pb-2 pt-1 border-t border-neutral-800 flex flex-col gap-1">
		<input
			type="text"
			class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
			placeholder="Project name"
			maxlength="48"
			bind:value={saveName}
			onkeydown={(e) => {
				if (e.key === 'Enter') confirmSave();
			}}
		/>
		{#if saveError}
			<p class="text-red-400 text-xs">{saveError}</p>
		{/if}
		{#if confirmOverwrite}
			<p class="text-yellow-500 text-xs">Already saved — click Save to overwrite.</p>
		{:else if wouldOverwrite && saveName.trim()}
			<p class="text-yellow-500 text-xs">Will overwrite existing project.</p>
		{/if}
		<button
			class="w-full px-2 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
			onclick={confirmSave}>{confirmOverwrite ? 'Confirm Save' : 'Save'}</button
		>
	</div>
</div>
