<script lang="ts">
  import Modal from './Modal.svelte';
  import type { ModalAction } from './Modal.svelte';

  let {
    open = $bindable(false),
    title = 'Delete',
    itemName,
    itemType = 'item',
    onDelete,
    onCancel
  }: {
    open?: boolean;
    title?: string;
    itemName?: string;
    itemType?: string;
    onDelete: () => void;
    onCancel?: () => void;
  } = $props();

  const actions: ModalAction[] = [
    { label: 'Cancel', callback: () => { open = false; onCancel?.(); } },
    { label: 'Delete', color: 'red', callback: onDelete }
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onDelete();
    }
  }
</script>

<Modal bind:open {title} onClose={onCancel} {actions} onKeyDown={handleKeydown}>
  <p class="text-sm text-neutral-300">
    Are you sure you want to delete
    {#if itemName}
      <span class="text-white font-medium">"{itemName}"</span>?
    {:else}
      this {itemType}?
    {/if}
    This action cannot be undone.
  </p>
</Modal>
