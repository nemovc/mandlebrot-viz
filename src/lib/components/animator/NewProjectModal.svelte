<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { ModalAction } from '$lib/components/ui/Modal.svelte';
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

	const actions = $derived<ModalAction[]>([
		{ label: 'Cancel', callback: onCancel },
		{ label: 'Discard & New', callback: onDiscardAndNew },
		{
			label: confirmOverwrite ? 'Confirm & New' : 'Save & New',
			color: 'blue',
			isDefault: true,
			callback: handleSaveAndNew
		}
	]);
</script>

<Modal open={true} title="New Project" onClose={onCancel} {actions}>
	<div class="flex flex-col gap-3">
		<p class="text-xs text-neutral-400">Save the current project before continuing?</p>
		<div class="flex flex-col gap-1">
			<input
				type="text"
				class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
				placeholder="Project name"
				maxlength="48"
				bind:value={nameInput}
			/>
			{#if errorMsg}
				<p class="text-red-400 text-xs">{errorMsg}</p>
			{/if}
			{#if confirmOverwrite}
				<p class="text-yellow-500 text-xs">Already saved — click "Confirm & New" to overwrite.</p>
			{/if}
		</div>
	</div>
</Modal>
