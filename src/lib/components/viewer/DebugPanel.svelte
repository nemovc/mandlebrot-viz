<script lang="ts">
  import { onMount } from 'svelte';
  import { viewerState } from '$lib/stores/viewerState.svelte';
  import { debugState } from '$lib/stores/debugState.svelte';
  import { getPrecisionMode } from '$lib/utils/precision';
  import CollapsiblePanel from './CollapsiblePanel.svelte';
  import ToggleButton from './ToggleButton.svelte';
  import PoolDebug from './PoolDebug.svelte';
  import type { WorkerPool } from '$lib/rendering/worker/workerPool';

  export interface PoolConfig {
    name: string;
    pool: WorkerPool<any, any>;
    textColor: string;
    barColor: string;
  }

  let {
    pools,
    title = 'Debug',
    defaultOpen = false,
    position = 'bottom-left'
  }: {
    pools: PoolConfig[];
    title?: string;
    defaultOpen?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  } = $props();

  // Animator pools only appear once they've been instantiated (e.g. after visiting the animator)
  let memUsed = $state<number | null>(null);
  let memTotal = $state<number | null>(null);

  onMount(() => {
    const interval = setInterval(() => {
      const mem = (performance as any).memory;
      if (mem) {
        memUsed = mem.usedJSHeapSize;
        memTotal = mem.jsHeapSizeLimit;
      }
    }, 2000);
    return () => clearInterval(interval);
  });

  function fmtBytes(b: number) {
    return (b / 1024 / 1024).toFixed(0) + ' MB';
  }
</script>

<CollapsiblePanel {title} {defaultOpen} {position}>
  <div class="flex flex-col gap-4 px-3 pb-3">
    <!-- Toggles -->
    <div class="flex flex-col gap-1.5 pt-3">
      <ToggleButton
        active={debugState.debugLogging}
        onclick={() => (debugState.debugLogging = !debugState.debugLogging)}
        checkbox>Debug logging</ToggleButton
      >
      <ToggleButton
        active={debugState.showCrosshair}
        onclick={() => (debugState.showCrosshair = !debugState.showCrosshair)}
        checkbox>Show crosshair</ToggleButton
      >
      <ToggleButton
        active={debugState.showTileSquare}
        onclick={() => (debugState.showTileSquare = !debugState.showTileSquare)}
        checkbox>Show tile square</ToggleButton
      >
      <ToggleButton
        active={debugState.slowMode}
        onclick={() => (debugState.slowMode = !debugState.slowMode)}
        checkbox>Slow mode</ToggleButton
      >
      <ToggleButton
        active={debugState.showTileFlash}
        onclick={() => (debugState.showTileFlash = !debugState.showTileFlash)}
        checkbox>Tile flash</ToggleButton
      >
    </div>

    <!-- Pools -->
    <div class="flex flex-col gap-2">
      {#each pools as poolConfig (poolConfig.name)}
        <PoolDebug
          name={poolConfig.name}
          pool={poolConfig.pool}
          textColor={poolConfig.textColor}
          barColor={poolConfig.barColor}
        />
      {/each}
    </div>

    <!-- System info -->
    <div class="flex flex-col gap-1.5">
      <div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">System</div>
      <div class="font-mono text-xs text-neutral-300 leading-5 flex flex-col gap-0.5">
        <div>
          {window.innerWidth}×{window.innerHeight} px @ {window.devicePixelRatio}x DPR
        </div>
        <div>
          zoom {viewerState.zoom} · {getPrecisionMode(viewerState.zoom)}
        </div>
        <div>{navigator.hardwareConcurrency} concurrency</div>
        {#if memUsed !== null && memTotal !== null}
          <div>heap {fmtBytes(memUsed)} / {fmtBytes(memTotal)}</div>
        {:else}
          <div class="text-neutral-600">heap n/a</div>
        {/if}
      </div>
    </div>
  </div>
</CollapsiblePanel>
