<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import type { ModalAction } from '$lib/components/ui/Modal.svelte';
  import type { AnimationProject } from '$lib/stores/animationState.svelte';

  let {
    project,
    projectName,
    onClose
  }: {
    project: AnimationProject;
    projectName: string | null;
    onClose: () => void;
  } = $props();

  const json = $derived(JSON.stringify(project, null, 2));
  let copied = $state(false);

  function handleClick() {
    navigator.clipboard.writeText(json).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    });
  }

  function handleDownload() {
    const filename = (projectName ?? 'untitled').replace(/[^a-zA-Z0-9 ]/g, '_') + '.json';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = $derived<ModalAction[]>([
    { label: 'Close', callback: onClose },
    { label: 'Download .json', color: 'blue', isDefault: true, callback: handleDownload }
  ]);
</script>

<Modal open={true} title="Export Project" {onClose} {actions}>
  <div class="flex flex-col gap-3 w-[488px] max-w-full">
    <p class="text-xs text-neutral-500">Click the text field to copy JSON to clipboard.</p>

    <textarea
      class="w-full h-48 bg-neutral-800 text-neutral-300 text-[11px] font-mono rounded border border-neutral-700 px-2 py-1.5 resize-none outline-none focus:border-blue-500 cursor-pointer select-all"
      readonly
      value={json}
      onclick={handleClick}
      title="Click to copy"
    ></textarea>

    {#if copied}
      <p class="text-green-400 text-xs">Copied to clipboard!</p>
    {/if}
  </div>
</Modal>
