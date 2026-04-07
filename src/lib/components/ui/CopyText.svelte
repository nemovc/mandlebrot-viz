<script lang="ts">
  import { type Snippet } from "svelte";
  import { Copy, Check } from "lucide-svelte";

  interface Props {
    value: string | (() => string);
    title?: string;
    size?: number;
    class?: string;
    children?: Snippet<[boolean]>;
  }

  let { 
    value, 
    title = "Copy to clipboard", 
    size = 13, 
    class: className = "",
    children
  }: Props = $props();

  let copied = $state(false);

  function handleCopy() {
    const textToCopy = typeof value === "function" ? value() : value;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }
</script>

<button
  type="button"
  class={children ? className : `inline-flex items-center text-neutral-500 hover:text-white transition-colors shrink-0 ${className}`}
  onclick={handleCopy}
  {title}
>
  {#if children}
    {@render children(copied)}
  {:else if copied}
    <Check {size} />
  {:else}
    <Copy {size} />
  {/if}
</button>
