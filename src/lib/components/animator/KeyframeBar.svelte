<script lang="ts">
  import { ChevronRight } from 'lucide-svelte';
  import { animationState, TRACK_LABELS, TRACK_PARAMS, type EasingType } from '$lib/stores/animationState.svelte';
  import { interpolateTrack } from '$lib/utils/animator/interpolation';
  import { baseAlgorithm } from '$lib/utils/colorPalettes';

  let {
    selectedTrack,
    onSelectTrack,
    triggerFocus = 0
  }: {
    selectedTrack: number | null;
    onSelectTrack: (t: number | null) => void;
    triggerFocus?: number;
  } = $props();

  let kfValueInput = $state<HTMLInputElement | null>(null);

  function focusValueInput() {
    kfValueInput?.focus();
  }

  export { focusValueInput };

  const project = $derived(animationState.project);
  const currentFrame = $derived(animationState.currentFrame);
  const totalFrames = $derived(project.totalFrames);
  const isHistogram = $derived(baseAlgorithm(project.algorithm) === 'histogram');

  const kfTrack = $derived(
    selectedTrack !== null ? animationState.project.tracks[selectedTrack] : null
  );
  const kfFrame = $derived(currentFrame);
  const kfInterpolated = $derived(
    kfTrack ? interpolateTrack(kfTrack, kfFrame, totalFrames) : 0
  );
  const kfAtFrame = $derived(kfTrack?.keyframes.find((k) => k.frame === kfFrame) ?? null);
  const kfPrev = $derived(kfTrack?.keyframes.findLast((k) => k.frame < kfFrame) ?? null);
  const kfNext = $derived(kfTrack?.keyframes.find((k) => k.frame > kfFrame) ?? null);
  const kfLabel = $derived(kfTrack ? TRACK_LABELS[kfTrack.parameter] : '');
  const kfIsAnchor = $derived(kfFrame === 0 || kfFrame === totalFrames);

  // eslint-disable-next-line svelte/prefer-writable-derived
  let kfEditValue = $state('');

  $effect(() => {
    kfEditValue = kfAtFrame ? kfAtFrame.value.toString() : kfInterpolated.toFixed(6);
  });

  function kfAdd() {
    if (selectedTrack === null) return;
    animationState.addKeyframe(selectedTrack, kfFrame, kfInterpolated);
    setTimeout(() => kfValueInput?.focus(), 0);
  }

  function kfDelete() {
    if (selectedTrack === null || kfIsAnchor) return;
    animationState.removeKeyframe(selectedTrack, kfFrame);
  }

  function kfCommit() {
    if (selectedTrack === null) return;
    const v = parseFloat(kfEditValue);
    if (isNaN(v)) return;
    if (kfAtFrame) {
      animationState.updateKeyframeValue(selectedTrack, kfFrame, v);
    } else {
      animationState.addKeyframe(selectedTrack, kfFrame, v);
    }
  }

  function kfKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') {
      kfEditValue = kfAtFrame?.value.toString() ?? kfInterpolated.toFixed(6);
      (e.target as HTMLInputElement).blur();
    }
  }
</script>

<div
  class="shrink-0 flex items-center gap-3 px-3 py-2 bg-neutral-950 border-t border-neutral-800 text-[11px] h-[38px] overflow-hidden"
>
  {#if kfTrack}
    <span class="text-neutral-500 w-20 shrink-0 text-right">{kfLabel}</span>
    <span class="text-neutral-600">frame {kfFrame + 1}</span>
    {#if kfAtFrame}
      <span class="text-blue-400">◆</span>
      {#if kfPrev}
        <select
          value={kfPrev.easing}
          onchange={(e) => {
            if (selectedTrack !== null)
              animationState.setKeyframeEasing(
                selectedTrack,
                kfPrev.frame,
                (e.target as HTMLSelectElement).value as EasingType
              );
          }}
          class="bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
          title="Easing into this keyframe"
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
        </select>
        <ChevronRight size={14} class="text-neutral-500 shrink-0" />
      {:else}
        <span class="text-neutral-700 font-mono">start</span>
        <ChevronRight size={14} class="text-neutral-500 shrink-0" />
      {/if}
      <input
        type="number"
        step="any"
        bind:value={kfEditValue}
        bind:this={kfValueInput}
        onblur={kfCommit}
        onkeydown={kfKeydown}
        class="w-36 bg-neutral-800 text-white border border-neutral-600 rounded px-2 py-0.5 font-mono text-[11px] focus:outline-none focus:border-blue-500"
      />
      {#if kfFrame !== totalFrames}
        <ChevronRight size={14} class="text-neutral-500 shrink-0" />
        <select
          value={kfAtFrame.easing}
          onchange={(e) => {
            if (selectedTrack !== null)
              animationState.setKeyframeEasing(
                selectedTrack,
                kfFrame,
                (e.target as HTMLSelectElement).value as EasingType
              );
          }}
          class="bg-neutral-800 text-white border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500"
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
        </select>
      {:else}
        <ChevronRight size={14} class="text-neutral-700 shrink-0" />
        <span class="text-neutral-700 font-mono">end</span>
      {/if}
      {#if !kfIsAnchor}
        <button
          onclick={kfDelete}
          class="text-neutral-500 hover:text-red-400 transition-colors px-1"
          title="Delete keyframe">✕</button
        >
      {/if}
    {:else}
      {#if kfPrev}
        <span class="text-neutral-700 font-mono">{kfPrev.value.toFixed(4)}</span>
        <ChevronRight size={14} class="text-neutral-700 shrink-0" />
        <span class="text-neutral-600">{kfPrev.easing}</span>
        <ChevronRight size={14} class="text-neutral-700 shrink-0" />
      {/if}
      <span class="text-neutral-400 font-mono">{kfInterpolated.toFixed(6)}</span>
      {#if kfNext}
        <ChevronRight size={14} class="text-neutral-700 shrink-0" />
        <span class="text-neutral-700 font-mono">{kfNext.value.toFixed(4)}</span>
      {/if}
      <button
        onclick={kfAdd}
        class="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 transition-colors"
      >
        <span class="text-blue-400">+</span> Add keyframe
      </button>
    {/if}
  {:else}
    <span class="text-neutral-700">Select a track to edit keyframes</span>
  {/if}

  <div class="flex-1"></div>
</div>
