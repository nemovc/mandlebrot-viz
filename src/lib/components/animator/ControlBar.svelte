<script lang="ts">
  import { Play, Repeat, Undo2, Redo2, CircleHelp, StepBack, StepForward, PanelLeft } from 'lucide-svelte';
  import { animationState } from '$lib/stores/animationState.svelte';
  import { frameCache } from '$lib/utils/animator/frameCache.svelte';

  let {
    onPlay,
    onUndo,
    onRedo,
    onStepBack,
    onStepForward,
    onShortcuts,
    onExplorerToggle,
    cacheReady,
    loopPlayback,
    explorerOpen
  }: {
    onPlay: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onStepBack?: (ctrl: boolean, shift: boolean) => void;
    onStepForward?: (ctrl: boolean, shift: boolean) => void;
    onShortcuts: () => void;
    onExplorerToggle?: () => void;
    cacheReady: boolean;
    loopPlayback: boolean;
    explorerOpen: boolean;
  } = $props();

  const project = $derived(animationState.project);
  const currentFrame = $derived(animationState.currentFrame);
  const cachedRanges = $derived(frameCache.ranges);

  // Calculate scrub bar position
  const playheadPercent = $derived(
    project.totalFrames > 0 ? (currentFrame / (project.totalFrames - 1)) * 100 : 0
  );

  let scrubbing = false;
  let scrubBarEl: HTMLDivElement | null = null;

  function updateFrameFromX(clientX: number) {
    if (!scrubBarEl) return;
    const rect = scrubBarEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    animationState.currentFrame = Math.round(ratio * (project.totalFrames - 1));
  }

  function handleScrubStart(e: MouseEvent | TouchEvent) {
    scrubbing = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateFrameFromX(clientX);
  }

  function handleScrubEnd() {
    scrubbing = false;
  }

  // Handle mouse/touch move on window so scrubbing works even when cursor leaves the bar
  $effect(() => {
    function onMouseMove(e: MouseEvent) {
      if (scrubbing) {
        e.preventDefault();
        updateFrameFromX(e.clientX);
      }
    }
    function onMouseUp() {
      scrubbing = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (scrubbing) {
        e.preventDefault();
        updateFrameFromX(e.touches[0].clientX);
      }
    }
    function onTouchEnd() {
      scrubbing = false;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  });
</script>

<div
  class="shrink-0 flex items-center gap-3 px-3 py-1.5 bg-neutral-900 border-t border-neutral-800 text-[11px]"
>
  <!-- Playback controls -->
  <div class="flex items-center gap-1.5">
    <button
      onclick={onPlay}
      disabled={!cacheReady}
      class="px-2.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-neutral-700"
      title={cacheReady ? 'Play preview (Space)' : 'Building preview cache...'}
      ><Play size={12} /></button
    >
    <button
      onclick={(e) => onStepBack?.(e.ctrlKey || e.metaKey, e.shiftKey)}
      disabled={!cacheReady}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded transition-colors disabled:opacity-30 text-neutral-400 hover:enabled:text-white"
      title="Step back"
      ><StepBack size={12} /></button
    >
    <button
      onclick={(e) => onStepForward?.(e.ctrlKey || e.metaKey, e.shiftKey)}
      disabled={!cacheReady}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded transition-colors disabled:opacity-30 text-neutral-400 hover:enabled:text-white"
      title="Step forward"
      ><StepForward size={12} /></button
    >
    <button
      onclick={() => {}}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded transition-colors {loopPlayback
        ? 'text-blue-400 border-blue-700'
        : 'text-neutral-500 hover:text-white'}"
      title="Loop playback (R)"><Repeat size={12} /></button
    >
    <button
      onclick={onExplorerToggle}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded transition-colors {explorerOpen
        ? 'text-blue-400 border-blue-700'
        : 'text-neutral-400 hover:text-white'}"
      title="Toggle explorer"><PanelLeft size={12} /></button
    >
  </div>

  <!-- Scrub bar -->
  <div class="flex-1 flex items-center gap-2">
    <div class="relative flex-1 h-6 cursor-pointer">
      <!-- Visual bar background -->
      <div class="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-neutral-700 rounded"></div>
      <!-- Click target (invisible, full height) -->
      <div
        bind:this={scrubBarEl}
        class="absolute inset-0 rounded"
        onmousedown={handleScrubStart}
        ontouchstart={handleScrubStart}
      ></div>
      <!-- Cached frame ranges (constrained to visual bar height) -->
      <div class="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded overflow-hidden pointer-events-none">
        {#each cachedRanges as range (`${range.start}-${range.end}`)}
          <div
            class="absolute h-full bg-green-500/50"
            style="left: {(range.start / project.totalFrames) * 100}%; width: {((range.end - range.start + 1) / project.totalFrames) * 100}%"
          ></div>
        {/each}
      </div>
      <!-- Playhead -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow z-10"
        style="left: calc({playheadPercent}% - 5px)"
      ></div>
    </div>
    <span class="text-neutral-500 text-[10px] w-16 text-right">
      {currentFrame + 1}/{project.totalFrames}
    </span>
  </div>

  <!-- Undo/Redo -->
  <div class="flex items-center gap-1">
    <button
      onclick={onUndo}
      disabled={!animationState.canUndo}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Undo (Ctrl+Z)"><Undo2 size={12} /></button
    >
    <button
      onclick={onRedo}
      disabled={!animationState.canRedo}
      class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Redo (Ctrl+Y)"><Redo2 size={12} /></button
    >
  </div>

  <!-- Shortcuts -->
  <button
    onclick={onShortcuts}
    class="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
    title="Keyboard shortcuts (?)"><CircleHelp size={12} /></button
    >
</div>
