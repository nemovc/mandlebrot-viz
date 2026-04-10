<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkerPool } from '$lib/rendering/worker/workerPool';

  let {
    name,
    pool,
    textColor,
    barColor
  }: {
    name: string;
    pool: WorkerPool<any, any>;
    textColor: string;
    barColor: string;
  } = $props();

  const initial = pool.debugState;
  let poolSize = $state(initial.poolSize);
  let idle = $state(initial.idle);
  let active = $state(initial.active);
  let queued = $state(initial.queued);
  // svelte-ignore state_referenced_locally
  let batchCompleted = $state(pool.batchCompleted);
  // svelte-ignore state_referenced_locally
  let batchTotal = $state(pool.batchTotal);

  const pct = $derived(batchTotal > 0 ? Math.round((batchCompleted / batchTotal) * 100) : 100);

  onMount(() => {
    const handler = (completed: number, total: number) => {
      batchCompleted = completed;
      batchTotal = total;
      const d = pool.debugState;
      poolSize = d.poolSize;
      idle = d.idle;
      active = d.active;
      queued = d.queued;
    };
    pool.onProgress.push(handler);
    return () => {
      pool.onProgress.splice(pool.onProgress.indexOf(handler), 1);
    };
  });
</script>

<div class="flex flex-col gap-1">
  <div class="font-mono text-xs text-neutral-300 leading-4">
    <span class={textColor}>{name}</span>
    <span class="ml-2"><span class="text-neutral-600">s</span>{poolSize}</span>
    <span class="ml-2"><span class="text-neutral-600">i</span>{idle}</span>
    <span class="ml-2"><span class="text-neutral-600">a</span>{active}</span>
    <span class="ml-2"><span class="text-neutral-600">q</span>{queued}</span>
  </div>
  <div class="flex items-center gap-2">
    <div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
      <div class="h-full {barColor} transition-all duration-150" style="width:{pct}%"></div>
    </div>
    <span class="text-xs text-neutral-500 w-10 text-right">{batchCompleted}/{batchTotal}</span>
  </div>
</div>
