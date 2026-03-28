<script lang="ts">
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { PRESET_LOCATIONS } from '$lib/utils/locations';
	import { savedLocations } from '$lib/stores/savedLocations.svelte';

	let { onNavigate, onClose }: {
		onNavigate: (re: number, im: number, zoom: number) => void;
		onClose: () => void;
	} = $props();

	let saving = $state(false);
	let saveName = $state('');
	let saveError = $state<string | null>(null);
	let pendingDelete = $state<string | null>(null);

	function confirmSave() {
		const err = savedLocations.validateName(saveName);
		if (err) { saveError = err; return; }
		savedLocations.save({
			name: saveName.trim(),
			re: parseFloat(viewerState.cx),
			im: parseFloat(viewerState.cy),
			zoom: viewerState.zoom,
		});
		saving = false;
		saveName = '';
	}

	function cancelSave() {
		saving = false;
		saveName = '';
		saveError = null;
	}
</script>

<div class="w-64 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl flex flex-col overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
		<span class="text-xs font-medium uppercase tracking-wider text-neutral-400">Locations</span>
		<button
			class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
			onclick={onClose}
			aria-label="Close"
		>✕</button>
	</div>

	<!-- Save current -->
	<div class="px-2 pt-2 pb-1">
		{#if saving}
			<div class="flex flex-col gap-1">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
					placeholder="Location name"
					maxlength="48"
					bind:value={saveName}
					onkeydown={(e) => { if (e.key === 'Enter') confirmSave(); else if (e.key === 'Escape') cancelSave(); }}
					autofocus
				/>
				{#if saveError}
					<p class="text-red-400 text-xs">{saveError}</p>
				{/if}
				<div class="flex gap-1">
					<button
						class="flex-1 px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
						onclick={cancelSave}
					>Cancel</button>
					<button
						class="flex-1 px-2 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
						onclick={confirmSave}
					>Save</button>
				</div>
			</div>
		{:else}
			<button
				class="w-full px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors text-left"
				onclick={() => { saving = true; saveError = null; saveName = ''; }}
			>+ Save current position</button>
		{/if}
	</div>

	<!-- Location list -->
	<div class="overflow-y-auto max-h-[50vh] p-2 flex flex-col gap-0">
		<div class="grid grid-cols-2 gap-1">
			{#each PRESET_LOCATIONS as loc}
				<button
					class="text-left px-2 py-1 rounded text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-500 truncate"
					onclick={() => onNavigate(loc.re, loc.im, loc.zoom)}
				>{loc.name}</button>
			{/each}
		</div>

		{#if savedLocations.all.length > 0}
			<div class="flex items-center gap-2 my-2">
				<div class="flex-1 border-t border-neutral-700"></div>
				<span class="text-[10px] text-neutral-600 uppercase tracking-wider">Saved</span>
				<div class="flex-1 border-t border-neutral-700"></div>
			</div>
			<div class="grid grid-cols-2 gap-1">
				{#each savedLocations.all as loc}
					{#if pendingDelete === loc.name}
						<div class="col-span-2 flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
							<span class="text-xs text-neutral-300 flex-1 truncate">Delete "{loc.name}"?</span>
							<button
								class="text-xs px-2 py-0.5 rounded bg-red-700 border border-red-600 text-white hover:bg-red-600 transition-colors"
								onclick={() => { savedLocations.remove(loc.name); pendingDelete = null; }}
							>Yes</button>
							<button
								class="text-xs px-2 py-0.5 rounded border border-neutral-600 text-neutral-400 hover:text-white transition-colors"
								onclick={() => (pendingDelete = null)}
							>No</button>
						</div>
					{:else}
						<div class="relative group">
							<button
								class="w-full text-left px-2 py-1 rounded text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-500 truncate"
								onclick={() => onNavigate(loc.re, loc.im, loc.zoom)}
							>{loc.name}</button>
							<button
								class="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all opacity-0 group-hover:opacity-100 text-[10px] leading-none"
								onclick={(e) => { e.stopPropagation(); pendingDelete = loc.name; }}
								aria-label="Delete {loc.name}"
							>✕</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
