<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import type { ModalAction } from '$lib/components/ui/Modal.svelte';
  import { savedProjects } from '$lib/stores/savedProjects.svelte';
  import type { AnimationProject } from '$lib/stores/animationState.svelte';

  let {
    onImport,
    onCancel
  }: {
    onImport: (project: AnimationProject) => void;
    onCancel: () => void;
  } = $props();

  let jsonInput = $state('');
  let errorMsg = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  function handleImport() {
    if (!jsonInput.trim()) {
      errorMsg = 'Paste JSON or load a file first';
      return;
    }
    const result = savedProjects.parseImport(jsonInput);
    if (typeof result === 'string') {
      errorMsg = result;
      return;
    }
    onImport(result);
  }

  function handleFileLoad() {
    fileInput.click();
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      jsonInput = (ev.target?.result as string) ?? '';
      errorMsg = null;
    };
    reader.readAsText(file);
    // Reset so the same file can be re-loaded
    (e.target as HTMLInputElement).value = '';
  }

  const actions = $derived<ModalAction[]>([
    { label: 'Cancel', callback: onCancel },
    { label: 'Import', color: 'blue', isDefault: true, callback: handleImport }
  ]);
</script>

<Modal open={true} title="Import Project" onClose={onCancel} {actions}>
  <div class="flex flex-col gap-3 w-[488px] max-w-full">
    <textarea
      class="w-full h-48 bg-neutral-800 text-neutral-300 text-[11px] font-mono rounded border border-neutral-700 px-2 py-1.5 resize-none outline-none focus:border-blue-500"
      placeholder="Paste project JSON here…"
      bind:value={jsonInput}
      oninput={() => (errorMsg = null)}
    ></textarea>

    {#if errorMsg}
      <p class="text-red-400 text-xs">{errorMsg}</p>
    {/if}

    <input
      type="file"
      accept=".json,application/json"
      class="hidden"
      bind:this={fileInput}
      onchange={handleFileChange}
    />

    <button
      class="self-start px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
      onclick={handleFileLoad}>Load from .json file…</button
    >
  </div>
</Modal>
