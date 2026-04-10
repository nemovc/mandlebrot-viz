<script lang="ts">
  import type { Snippet } from 'svelte';

  import { slide } from 'svelte/transition';

  let {
    title,
    defaultOpen = true,
    position = 'bottom-left',
    oncollapse,
    children
  }: {
    title: string;
    defaultOpen?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    oncollapse?: () => void;
    children?: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  let open = $state(defaultOpen);

  function toggle() {
    open = !open;
    if (!open) oncollapse?.();
  }

  const isTop = $derived(position.startsWith('top'));
  const chevron = $derived(isTop ? (open ? '▼' : '▲') : open ? '▲' : '▼');

  const collapsedMargin = $derived(
    !open
      ? [
          isTop ? '-mt-[1em]' : '-mb-[1em]',
          position.endsWith('left') ? '-ml-[1em]' : '-mr-[1em]'
        ].join(' ')
      : ''
  );
</script>

<div
  class="{open
    ? 'w-56'
    : 'w-fit'} rounded-lg border overflow-hidden transition-all duration-200 {open
    ? 'bg-neutral-900 border-neutral-800'
    : `bg-neutral-900/40 border-neutral-800/40 backdrop-blur-sm ${collapsedMargin}`}"
>
  <button
    class="w-full flex items-center justify-between px-3 py-2 font-medium uppercase tracking-wider transition-all {open
      ? 'text-xs text-neutral-400 hover:text-white'
      : 'text-[10px] text-neutral-500 hover:text-neutral-300'}"
    onclick={toggle}
  >
    {title}
    <span class="ml-3 text-neutral-600">{chevron}</span>
  </button>

  {#if open}
    <div transition:slide={{ duration: 180 }} class="border-t border-neutral-800">
      {@render children?.()}
    </div>
  {/if}
</div>
