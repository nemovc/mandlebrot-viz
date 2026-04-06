<script lang="ts">
  import { savedPalettes } from "$lib/stores/savedPalettes.svelte";
  import type { ColorConfig } from "$lib/utils/colorPalettes";

  let {
    config,
    initialName = "",
    onSave,
    onCancel,
  }: {
    config: ColorConfig;
    initialName?: string;
    onSave: (name: string) => void;
    onCancel: () => void;
  } = $props();

  let nameInput = $state(initialName);
  let errorMsg = $state<string | null>(null);
  let confirmOverwrite = $state(false);

  function handleSubmit() {
    const validationError = savedPalettes.validateName(nameInput);
    if (validationError) {
      errorMsg = validationError;
      return;
    }
    if (savedPalettes.exists(nameInput) && !confirmOverwrite) {
      confirmOverwrite = true;
      return;
    }
    savedPalettes.save(nameInput, config);
    onSave(nameInput.trim());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleInputChange(e: Event) {
    nameInput = (e.target as HTMLInputElement).value;
    errorMsg = null;
    confirmOverwrite = false;
  }
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
  role="dialog"
  aria-modal="true"
  aria-label="Save palette"
>
  <div
    class="w-72 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl p-4 flex flex-col gap-3"
  >
    <div class="text-sm font-medium text-white">Save Palette</div>

    {#if confirmOverwrite}
      <p class="text-xs text-neutral-300">
        A palette named <span class="text-white font-medium"
          >"{nameInput.trim()}"</span
        > already exists. Overwrite?
      </p>
      <div class="flex gap-2 justify-end">
        <button
          class="px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={() => (confirmOverwrite = false)}
        >
          Back
        </button>
        <button
          class="px-3 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
          onclick={handleSubmit}
        >
          Overwrite
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-1">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
          placeholder="Palette name"
          maxlength="24"
          value={nameInput}
          oninput={handleInputChange}
          onkeydown={handleKeydown}
          autofocus
        />
        {#if errorMsg}
          <p class="text-red-400 text-xs">{errorMsg}</p>
        {/if}
      </div>
      <div class="flex gap-2 justify-end">
        <button
          class="px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          onclick={onCancel}
        >
          Cancel
        </button>
        <button
          class="px-3 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors"
          onclick={handleSubmit}
        >
          Save
        </button>
      </div>
    {/if}
  </div>
</div>
