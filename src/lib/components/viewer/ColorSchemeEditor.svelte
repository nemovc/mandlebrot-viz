<script lang="ts">
  import { fly } from 'svelte/transition';
  import { viewerState } from '$lib/stores/viewerState.svelte';
  import { wheelSlider } from '$lib/actions/wheelSlider';
  import {
    presetsFor,
    ALGORITHMS,
    paletteForAlgorithmChange,
    baseAlgorithm,
    type ColorConfig,
    type ColorStop,
    type Algorithm
  } from '$lib/utils/colorPalettes';
  import { savedPalettes } from '$lib/stores/savedPalettes.svelte';
  import CollapsiblePanel from './CollapsiblePanel.svelte';
  import ToggleButton from './ToggleButton.svelte';
  import PalettePreview from './PalettePreview.svelte';
  import PalettePanel from './PalettePanel.svelte';
  import PaletteEditor from './PaletteEditor.svelte';

  let {
    colors = viewerState.colors,
    setColors = (c) => { viewerState.colors = c; },
    onCyclePeriodChange,
    onOffsetChange,
    cyclePeriodValue,
    offsetValue,
    hasCyclePeriodKeyframe = true,
    hasOffsetKeyframe = true,
    open = $bindable(true)
  }: {
    colors?: ColorConfig;
    setColors?: (c: ColorConfig) => void;
    onCyclePeriodChange?: (v: number) => void;
    onOffsetChange?: (v: number) => void;
    cyclePeriodValue?: number;
    offsetValue?: number;
    hasCyclePeriodKeyframe?: boolean;
    hasOffsetKeyframe?: boolean;
    open?: boolean;
  } = $props();

  let algorithmRef = $state<HTMLSelectElement | null>(null);

  let showPalettePanel = $state(false);
  let showEditor = $state(false);

  // Initialize active name by matching current palette against known palettes
  const initialPaletteJson = JSON.stringify(colors.palette);
  const initialPreset = Object.entries(presetsFor(colors.algorithm)).find(
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
          colors.palette
      )
    )
  );

  const dirty = $derived(JSON.stringify(colors.palette) !== JSON.stringify(baseline));

  const displayName = $derived(
    activePaletteName ? (dirty ? activePaletteName + '*' : activePaletteName) : 'Custom'
  );

  function onPaletteApplied(name: string) {
    activePaletteName = name;
    baseline = JSON.parse(JSON.stringify(colors.palette));
  }

  function onEditorSave(name: string) {
    activePaletteName = name;
    baseline = JSON.parse(JSON.stringify(colors.palette));
  }

  // Use provided values if given (for animator keyframe display), otherwise use colors prop
  const displayCyclePeriod = $derived(cyclePeriodValue ?? colors.cyclePeriod);
  const displayOffset = $derived(offsetValue ?? colors.offset);

  function handleCyclePeriodChange(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value);
    if (onCyclePeriodChange) {
      onCyclePeriodChange(v);
    } else {
      setColors({
        ...colors,
        cyclePeriod: v
      });
    }
  }

  function handleOffsetChange(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (onOffsetChange) {
      onOffsetChange(v);
    } else {
      setColors({
        ...colors,
        offset: v
      });
    }
  }

  function onAlgorithmChange(e: Event) {
    const newAlgorithm = (e.target as HTMLSelectElement).value as Algorithm;
    const swappedPalette = paletteForAlgorithmChange(
      colors.algorithm,
      newAlgorithm,
      activePaletteName
    );
    if (swappedPalette) baseline = JSON.parse(JSON.stringify(swappedPalette));
    setColors({
      ...colors,
      algorithm: newAlgorithm,
      ...(swappedPalette && { palette: swappedPalette })
    });
  }
</script>

<div class="flex flex-row items-start gap-2">
  {#if showEditor}
    <div transition:fly={{ x: 16, duration: 150, opacity: 0 }}>
      <PaletteEditor
        {activePaletteName}
        {baseline}
        colors={colors}
        setColors={setColors}
        onClose={() => (showEditor = false)}
        onSave={onEditorSave}
      />
    </div>
  {/if}

  {#if showPalettePanel}
    <div transition:fly={{ x: 16, duration: 150, opacity: 0 }}>
      <PalettePanel
        {activePaletteName}
        algorithm={colors.algorithm}
        colors={colors}
        setColors={setColors}
        onClose={() => (showPalettePanel = false)}
        onApply={onPaletteApplied}
      />
    </div>
  {/if}

  <CollapsiblePanel
    title="Color Scheme"
    position="top-right"
    bind:open
    focusRef={algorithmRef}
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
          bind:this={algorithmRef}
          class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700"
          value={colors.algorithm}
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
          class="text-neutral-400 text-xs {baseAlgorithm(colors.algorithm) ===
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
            value={displayCyclePeriod}
            oninput={handleCyclePeriodChange}
            use:wheelSlider
            disabled={baseAlgorithm(colors.algorithm) === 'histogram'}
            class="flex-1 min-w-0 accent-blue-500 disabled:opacity-30 {!hasCyclePeriodKeyframe && baseAlgorithm(colors.algorithm) !== 'histogram' ? 'opacity-30' : ''}"
          />
          <input
            type="text"
            disabled={baseAlgorithm(colors.algorithm) === 'histogram'}
            class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right disabled:opacity-30 {!hasCyclePeriodKeyframe && baseAlgorithm(colors.algorithm) !== 'histogram' ? 'opacity-30' : ''}"
            value={displayCyclePeriod}
            onblur={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (!isNaN(v) && v > 0) handleCyclePeriodChange(e);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLElement).blur();
            }}
          />
        </div>
        {#if baseAlgorithm(colors.algorithm) === 'distance_estimation' && displayCyclePeriod > 32}
          <p class="text-yellow-500 text-xs mt-1 whitespace-normal break-words">
            High cycle period loses detail in distance estimation mode.
          </p>
        {/if}
        {#if baseAlgorithm(colors.algorithm) === 'histogram'}
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
            value={displayOffset}
            oninput={handleOffsetChange}
            use:wheelSlider
            class="flex-1 min-w-0 accent-blue-500 {!hasOffsetKeyframe ? 'opacity-30' : ''}"
          />
          <input
            type="text"
            class="w-12 bg-neutral-800 text-white font-mono rounded px-1 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none text-right {!hasOffsetKeyframe ? 'opacity-30' : ''}"
            value={displayOffset.toFixed(2)}
            onblur={(e) => {
              const v = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(v))
                handleOffsetChange({ target: { value: Math.max(0, Math.min(1, v)).toString() } } as unknown as Event);
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
          value={colors.inSetColor ?? '#000000'}
          oninput={(e) => {
            setColors({
              ...colors,
              inSetColor: (e.target as HTMLInputElement).value
            });
          }}
        />
        <button
          class="px-2 py-0.5 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={() => {
            setColors({ ...colors, inSetColor: '#000000' });
          }}
          title="Reset to black">Reset</button
        >
      </div>

      <!-- Row 6: Preview bar + Reverse -->
      <div class="flex items-center gap-2">
        <PalettePreview colors={colors} />
        <ToggleButton
          active={colors.reverse ?? false}
          onclick={() =>
            setColors({
              ...colors,
              reverse: !colors.reverse
            })}
          title="Reverse palette">⇄</ToggleButton
        >
      </div>
    </div>
  </CollapsiblePanel>
</div>
