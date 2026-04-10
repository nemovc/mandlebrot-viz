<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';

  let {
    open = $bindable(false),
    exportUrl,
    onSave,
    onReset
  }: {
    open?: boolean;
    exportUrl: string;
    onSave: () => void;
    onReset: () => void;
  } = $props();

  const actions = $derived([
    { label: 'Export Another', callback: onReset },
    { label: 'Save WebM', color: 'blue' as const, callback: onSave, isDefault: true }
  ]);
</script>

<Modal
  bind:open
  title="Export complete"
  closeOnEscape={false}
  closeOnBackdrop={false}
  showX={false}
  {actions}
>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    src={exportUrl}
    controls
    autoplay
    loop
    class="rounded border border-neutral-700 max-h-[70vh] object-contain"
  ></video>
</Modal>
