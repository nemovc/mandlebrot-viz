<script lang="ts">
  import { fly } from 'svelte/transition';
  import { viewerState } from '$lib/stores/viewerState.svelte';
  import { wheelSlider } from '$lib/actions/wheelSlider';
  import {
    presetsFor,
    ALGORITHMS,
    paletteForAlgorithmChange,
    baseAlgorithm
  } from '$lib/utils/colorPalettes';
  import type { ColorStop } from '$lib/utils/colorPalettes';
  import { savedPalettes } from '$lib/stores/savedPalettes.svelte';
  import CollapsiblePanel from './CollapsiblePanel.svelte';
  import ToggleButton from './ToggleButton.svelte';
  import PalettePreview from './PalettePreview.svelte';
  import PalettePanel from './PalettePanel.svelte';
  import PaletteEditor from './PaletteEditor.svelte';

  let showPalettePanel = $state(false);
  let showEditor = $state(false);

  // Initialize active name by matching current palette against known palettes
  const initialPaletteJson = JSON.stringify(viewerState.colors.palette);
  const initialPreset = Object.entries(presetsFor(viewerState.colors.algorithm)).find(
    ([, p]) => JSON.stringify(p.palette) === initialPaletteJson
  );
  const initialSaved = savedPalettes.all.find(
    (p) => JSON.stringify(p.config.palette) === initialPaletteJson
  );

  let activePaletteName = $state<string | null>(initialPreset?.[0] ?? initialSaved?.name ?? null);
  let baseline = $state<ColorStop[]>(
    JSON.parse(
      JSON.stringify(
        (initialPreset ? initialPreset[1].palette : initialSaved?.config.palette) ??
          viewerState.colors.palette
      )
    )
  );

  const dirty = $derived(JSON.stringify(viewerState.colors.palette) !== JSON.stringify(baseline));

  const displayName = $derived(
    activePaletteName ? (dirty ? activePaletteName + '*' : activePaletteName) : 'Custom'
  );

  function onPaletteApplied(name: string) {
    activePaletteName = name;
    baseline = JSON.parse(JSON.stringify(viewerState.colors.palette));
  }

  function onEditorSave(name: string) {
    activePaletteName = name;
    baseline = JSON.parse(JSON.stringify(viewerState.colors.palette));
  }

  function onCyclePeriodChange(e: Event) {
    viewerState.colors = {
      ...viewerState.colors,
      cyclePeriod: parseInt((e.target as HTMLInputElement).value)
    };
  }

  function onOffsetChange(e: Event) {
    viewerState.colors = {
      ...viewerState.colors,
      offset: parseFloat((e.target as HTMLInputElement).value)
    };
  }

  function onAlgorithmChange(e: Event) {
    const newAlgorithm = (e.target as HTMLSelectElement)
      .value as typeof viewerState.colors.algorithm;
    const swappedPalette = paletteForAlgorithmChange(
      viewerState.colors.algorithm,
      newAlgorithm,
      activePaletteName
    );
    if (swappedPalette) baseline = JSON.parse(JSON.stringify(swappedPalette));
    viewerState.colors = {
      ...viewerState.colors,
      algorithm: newAlgorithm,
      ...(swappedPalette && { palette: swappedPalette })
    };
  }
</script>

<div class="flex flex-row items-start gap-2">
  {#if showEditor}
    <div transition:fly={{ x: 16, duration: 150, opacity: 0 }}>
      <PaletteEditor
        {activePaletteName}
        {baseline}
        colors={viewerState.colors}
        setColors={(c) => {
          viewerState.colors = c;
        }}
        onClose={() => (showEditor = false)}
        onSave={onEditorSave}
      />
    </div>
  {/if}

  {#if showPalettePanel}
    <div transition:fly={{ x: 16, duration: 150, opacity: 0 }}>
      <PalettePanel
        {activePaletteName}
        algorithm={viewerState.colors.algorithm}
        colors={viewerState.colors}
        setColors={(c) => (viewerState.colors = c)}
        onClose={() => (showPalettePanel = false)}
        onApply={onPaletteApplied}
      />
    </div>
  {/if}

  <CollapsiblePanel
    title="Color Scheme"
    position="top-right"
    oncollapse={() => {
      showPalettePanel = false;
      showEditor = false;
    }}
  >
    <div class="flex flex-col gap-3 p-3">
      <!-- Row 1: Palettes + Edit buttons -->
      <div class="grid grid-cols-2 gap-2">
        <ToggleButton
          active={showPalettePanel}
          onclick={() => {
            showPalettePanel = !showPalettePanel;
            if (showPalettePanel) showEditor = false;
          }}
          class="w-full"
          chevron="left"
        >
          Palettes
        </ToggleButton>
        <ToggleButton
          active={showEditor}
          onclick={() => {
            showEditor = !showEditor;
            if (showEditor) showPalettePanel = false;
          }}
          title="Edit palette stops"
          class="w-full"
          chevron="left">Edit</ToggleButton
        >
      </div>

      <!-- Row 2: Palette name -->
      <span class="text-sm font-medium text-neutral-200 truncate text-center">{displayName}</span>

      <!-- Row 2: Algorithm -->
      <div>
        <div class="text-neutral-400 text-xs mb-1">Algorithm</div>
        <select
          class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
          value={viewerState.colors.algorithm}
          onchange={onAlgorithmChange}
        >
          {#each ALGORITHMS as a (a.value)}
            <option value={a.value}>{a.label}</option>
          {/each}
        </select>
      </div>

      <!-- Row 3: Cycle Period -->
      <div>
        <label
          class="text-neutral-400 text-xs {baseAlgorithm(viewerState.colors.algorithm) ===
          'histogram'
            ? 'opacity-30'
            : ''}"
          for="cyclePeriod">Cycle Period</label
        >
        <div class="flex items-center gap-2 mt-1">
          <input
            id="cyclePeriod"
            type="range"
            min="4"
            max="256"
            step="1"
            value={viewerState.colors.cyclePeriod}
            oninput={onCyclePeriodChange}
            use:wheelSlider
            disabled={baseAlgorithm(viewerState.colors.algorithm) === 'histogram'}
            class="flex-1 min-w-0 accent-blue-500 disabled:opacity-30"
          />
          <input
            type="text"
            disabled={baseAlgorithm(viewerState.colors.algorithm) === 'histogram'}
            class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right disabled:opacity-30"
            value={viewerState.colors.cyclePeriod}
            onblur={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (!isNaN(v) && v > 0) onCyclePeriodChange(e);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLElement).blur();
            }}
          />
        </div>
        {#if baseAlgorithm(viewerState.colors.algorithm) === 'distance_estimation' && viewerState.colors.cyclePeriod > 32}
          <p class="text-yellow-500 text-xs mt-1 whitespace-normal break-words">
            High cycle period loses detail in distance estimation mode.
          </p>
        {/if}
        {#if baseAlgorithm(viewerState.colors.algorithm) === 'histogram'}
          <p class="text-yellow-500 text-xs mt-1 whitespace-normal break-words">
            Cycle period is unused in histogram equalized mode.
          </p>
        {/if}
      </div>

      <!-- Row 4: Offset -->
      <div>
        <label class="text-neutral-400 text-xs" for="colorOffset">Offset</label>
        <div class="flex items-center gap-2 mt-1">
          <input
            id="colorOffset"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={viewerState.colors.offset}
            oninput={onOffsetChange}
            use:wheelSlider
            class="flex-1 min-w-0 accent-blue-500"
          />
          <input
            type="text"
            class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right"
            value={viewerState.colors.offset.toFixed(2)}
            onblur={(e) => {
              const v = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(v))
                viewerState.colors = {
                  ...viewerState.colors,
                  offset: Math.max(0, Math.min(1, v))
                };
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLElement).blur();
            }}
          />
        </div>
      </div>

      <!-- Row 5: In-set color -->
      <div class="flex items-center gap-2">
        <label class="text-neutral-400 text-xs shrink-0" for="inSetColor">In-set color</label>
        <input
          id="inSetColor"
          type="color"
          class="w-8 h-6 rounded border border-neutral-700 cursor-pointer p-0 bg-transparent"
          value={viewerState.colors.inSetColor ?? '#000000'}
          oninput={(e) => {
            viewerState.colors = {
              ...viewerState.colors,
              inSetColor: (e.target as HTMLInputElement).value
            };
          }}
        />
        <button
          class="px-2 py-0.5 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={() => {
            viewerState.colors = { ...viewerState.colors, inSetColor: '#000000' };
          }}
          title="Reset to black">Reset</button
        >
      </div>

      <!-- Row 6: Preview bar + Reverse -->
      <div class="flex items-center gap-2">
        <PalettePreview colors={viewerState.colors} />
        <ToggleButton
          active={viewerState.colors.reverse ?? false}
          onclick={() =>
            (viewerState.colors = {
              ...viewerState.colors,
              reverse: !viewerState.colors.reverse
            })}
          title="Reverse palette">⇄</ToggleButton
        >
      </div>
    </div>
  </CollapsiblePanel>
</div>
