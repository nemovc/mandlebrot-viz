<script lang="ts">
  import { viewerState } from '$lib/stores/viewerState.svelte';
  import { PRESET_LOCATIONS } from '$lib/utils/locations';
  import type { Location } from '$lib/utils/locations';
  import { savedLocations } from '$lib/stores/savedLocations.svelte';
  import { scaleForZoom } from '$lib/utils/precision';
  import ToggleButton from './ToggleButton.svelte';
  import SaveModal from '$lib/components/ui/SaveModal.svelte';
  import DeleteModal from '$lib/components/ui/DeleteModal.svelte';

  function isAt(loc: Location): boolean {
    if (viewerState.zoom !== loc.zoom) return false;
    const eps = scaleForZoom(loc.zoom) * 2;
    return (
      Math.abs(parseFloat(viewerState.cx) - loc.re) < eps &&
      Math.abs(parseFloat(viewerState.cy) - loc.im) < eps
    );
  }

  let {
    onNavigate,
    onClose
  }: {
    onNavigate: (re: number, im: number, zoom: number) => void;
    onClose: () => void;
  } = $props();

  let showSaveModal = $state(false);
  let showDeleteModal = $state(false);
  let pendingDelete = $state<string | null>(null);
</script>

<div
  class="w-64 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl flex flex-col overflow-hidden"
>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
    <span class="text-xs font-medium uppercase tracking-wider text-neutral-400">Locations</span>
    <button
      class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
      onclick={onClose}
      aria-label="Close">✕</button
    >
  </div>

  <!-- Location list -->
  <div class="overflow-y-auto max-h-[50vh] p-2 flex flex-col gap-0">
    {#if viewerState.power !== 2}
      <p class="text-yellow-500 text-xs mb-2 leading-snug">Preset locations are for exponent 2</p>
    {/if}
    <div class="grid grid-cols-2 gap-1">
      {#each PRESET_LOCATIONS as loc (loc.name)}
        <ToggleButton
          active={isAt(loc)}
          disabled={viewerState.power !== 2}
          onclick={() => onNavigate(loc.re, loc.im, loc.zoom)}
          class="w-full truncate">{loc.name}</ToggleButton
        >
      {/each}
    </div>

    {#if savedLocations.all.length > 0}
      <div class="flex items-center gap-2 my-2">
        <div class="flex-1 border-t border-neutral-700"></div>
        <span class="text-[10px] text-neutral-600 uppercase tracking-wider">Saved</span>
        <div class="flex-1 border-t border-neutral-700"></div>
      </div>
      {#if viewerState.power !== 2}
        <p class="text-yellow-500 text-xs mb-2 leading-snug">
          Saved locations may have been created with a different exponent.
        </p>
      {/if}
      <div class="grid grid-cols-2 gap-1">
        {#each savedLocations.all as loc (loc.name)}
          <div class="relative group">
            <ToggleButton
              active={isAt(loc)}
              onclick={() => onNavigate(loc.re, loc.im, loc.zoom)}
              class="w-full truncate">{loc.name}</ToggleButton
            >
            <button
              class="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all opacity-0 group-hover:opacity-100 text-[10px] leading-none"
              onclick={(e) => {
                e.stopPropagation();
                pendingDelete = loc.name;
                showDeleteModal = true;
              }}
              aria-label="Delete {loc.name}">✕</button
            >
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Save current -->
  <div class="px-2 pb-2 pt-1 border-t border-neutral-800">
    <button
      class="w-full px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors text-left"
      onclick={() => (showSaveModal = true)}>+ Save current position</button
    >
  </div>
</div>

<SaveModal
  bind:open={showSaveModal}
  title="Save Location"
  allowedNames={/.+/}
  maxLength={48}
  reservedNames={PRESET_LOCATIONS.map((l) => l.name)}
  checkIfOverwrites={savedLocations.exists}
  onComplete={(name) =>
    savedLocations.save({
      name,
      re: parseFloat(viewerState.cx),
      im: parseFloat(viewerState.cy),
      zoom: viewerState.zoom
    })}
/>

<DeleteModal
  bind:open={showDeleteModal}
  itemName={pendingDelete ?? ''}
  itemType="location"
  onDelete={() => {
    if (pendingDelete) {
      savedLocations.remove(pendingDelete);
      pendingDelete = null;
      showDeleteModal = false;
    }
  }}
  onCancel={() => (showDeleteModal = false)}
/>
