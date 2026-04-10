<script lang="ts">
  import CollapsiblePanel from '$lib/components/viewer/CollapsiblePanel.svelte';
  import ToggleButton from '$lib/components/viewer/ToggleButton.svelte';
  import { savedProjects } from '$lib/stores/savedProjects.svelte';
  import type { AnimationProject } from '$lib/stores/animationState.svelte';
  import DeleteModal from '$lib/components/ui/DeleteModal.svelte';

  let {
    project,
    projectName,
    isDirty,
    onSave,
    onNew,
    onLoad,
    onExport,
    onImport,
    onExportWebM,
    onFpsChange,
    onFramesChange,
    onWidthChange,
    onHeightChange,
    onPowerChange
  }: {
    project: AnimationProject;
    projectName: string | null;
    isDirty: boolean;
    onSave: () => void;
    onNew: () => void;
    onLoad: (p: AnimationProject, name: string) => void;
    onExport: () => void;
    onImport: () => void;
    onExportWebM: () => void;
    onFpsChange?: (v: number) => void;
    onFramesChange?: (v: number) => void;
    onWidthChange?: (v: number) => void;
    onHeightChange?: (v: number) => void;
    onPowerChange?: (v: number) => void;
  } = $props();

  // Local editable copies
  let fpsInput = $state(project.fps.toString());
  let widthInput = $state(project.width.toString());
  let heightInput = $state(project.height.toString());
  let framesInput = $state(project.totalFrames.toString());
  let powerInput = $state(project.power.toString());

  let showLoadList = $state(false);
  let showDeleteModal = $state(false);
  let pendingDelete = $state<string | null>(null);

  // Sync inputs when project changes
  $effect(() => {
    fpsInput = project.fps.toString();
    widthInput = project.width.toString();
    heightInput = project.height.toString();
    framesInput = project.totalFrames.toString();
    powerInput = project.power.toString();
  });

  function commitFps() {
    const v = parseInt(fpsInput);
    if (v > 0 && v <= 120 && v !== project.fps) {
      onFpsChange?.(v);
    }
  }

  function commitWidth() {
    const v = parseInt(widthInput);
    if (v > 0 && v !== project.width) {
      onWidthChange?.(v);
    }
  }

  function commitHeight() {
    const v = parseInt(heightInput);
    if (v > 0 && v !== project.height) {
      onHeightChange?.(v);
    }
  }

  function commitFrames() {
    const v = parseInt(framesInput);
    if (v > 0 && v <= 100000 && v !== project.totalFrames) {
      onFramesChange?.(v);
    }
  }

  function commitPower() {
    const v = parseInt(powerInput);
    if (v >= 2 && v <= 10 && v !== project.power) {
      onPowerChange?.(v);
    }
  }

  const durationSecs = $derived((project.totalFrames / project.fps).toFixed(1));
  const displayName = $derived(projectName ?? 'Unsaved Project');
</script>

<CollapsiblePanel title="Project" defaultOpen={false} position="bottom-right">
  <div class="flex flex-col gap-3 p-3">
    <!-- Project name display -->
    <div class="text-sm font-medium text-neutral-200 truncate text-center">
      {displayName}{isDirty ? '*' : ''}
    </div>

    <!-- Settings fields -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs w-16">FPS</label>
        <input
          type="number"
          min="1"
          max="120"
          value={fpsInput}
          onblur={() => commitFps()}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          oninput={(e) => (fpsInput = (e.target as HTMLInputElement).value)}
          class="flex-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        />
      </div>

      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs w-16">Frames</label>
        <input
          type="number"
          min="1"
          value={framesInput}
          onblur={() => commitFrames()}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          oninput={(e) => (framesInput = (e.target as HTMLInputElement).value)}
          class="flex-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        />
        <span class="text-neutral-600 text-xs">({durationSecs}s)</span>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs w-16">Width</label>
        <input
          type="number"
          min="1"
          value={widthInput}
          onblur={() => commitWidth()}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          oninput={(e) => (widthInput = (e.target as HTMLInputElement).value)}
          class="flex-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        />
      </div>

      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs w-16">Height</label>
        <input
          type="number"
          min="1"
          value={heightInput}
          onblur={() => commitHeight()}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          oninput={(e) => (heightInput = (e.target as HTMLInputElement).value)}
          class="flex-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        />
      </div>

      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs w-16">Exponent</label>
        <input
          type="number"
          min="2"
          max="10"
          value={powerInput}
          onblur={() => commitPower()}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          oninput={(e) => (powerInput = (e.target as HTMLInputElement).value)}
          class="flex-1 bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        />
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex flex-col gap-1 pt-2 border-t border-neutral-800">
      <div class="grid grid-cols-2 gap-1">
        <button
          class="px-2 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={onSave}
          disabled={!isDirty}>Save</button
        >
        <button
          class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={onNew}>New</button
        >
      </div>

      <div class="grid grid-cols-2 gap-1">
        <button
          class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={onExport}>Export JSON</button
        >
        <button
          class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={onImport}>Import JSON</button
        >
      </div>

      <div class="grid grid-cols-2 gap-1">
        <button
          class="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={() => (showLoadList = !showLoadList)}>Load</button
        >
        <button
          class="px-2 py-1 rounded text-xs bg-green-700 border border-green-600 text-white hover:bg-green-600 transition-colors"
          onclick={onExportWebM}>Export WebM</button
        >
      </div>
    </div>

    <!-- Load project list -->
    {#if showLoadList}
      <div class="border-t border-neutral-800 pt-2 flex flex-col gap-1">
        {#if savedProjects.all.length === 0}
          <p class="text-xs text-neutral-600">No saved projects.</p>
        {:else}
          {#each savedProjects.all as entry (entry.name)}
            <div class="relative group flex items-center gap-1">
              <button
                class="flex-1 text-left px-1 py-0.5 rounded text-xs bg-neutral-800 text-neutral-300 hover:text-white transition-colors truncate"
                onclick={() => {
                  onLoad(entry.project, entry.name);
                  showLoadList = false;
                }}>{entry.name}</button
              >
              <button
                class="w-3.5 h-3.5 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 text-[9px] opacity-0 group-hover:opacity-100"
                onclick={(e) => {
                  e.stopPropagation();
                  pendingDelete = entry.name;
                  showDeleteModal = true;
                }}>✕</button
              >
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</CollapsiblePanel>

<DeleteModal
  bind:open={showDeleteModal}
  itemName={pendingDelete ?? ''}
  itemType="project"
  onDelete={() => {
    if (pendingDelete) {
      savedProjects.remove(pendingDelete);
      pendingDelete = null;
      showDeleteModal = false;
    }
  }}
  onCancel={() => (showDeleteModal = false)}
/>
