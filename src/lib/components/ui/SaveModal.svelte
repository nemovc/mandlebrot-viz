<script lang="ts">
  import Modal from './Modal.svelte';
  import type { ModalAction } from './Modal.svelte';

  let {
    open = $bindable(false),
    title = 'Save',
    initialName = '',
    allowedNames = /^[\w\- ]+$/,
    autoTrim = true,
    maxLength,
    reservedNames = [],
    checkIfOverwrites,
    onComplete,
    onCancel
  }: {
    open?: boolean;
    title?: string;
    initialName?: string;
    allowedNames?: RegExp;
    autoTrim?: boolean;
    maxLength?: number;
    reservedNames?: string[];
    checkIfOverwrites: (name: string) => boolean;
    onComplete: (name: string) => void;
    onCancel?: () => void;
  } = $props();

  let nameInput = $state('');
  let errorMsg = $state<string | null>(null);
  let confirmOverwrite = $state(false);
  let inputEl = $state<HTMLInputElement | undefined>();

  $effect(() => {
    if (open && inputEl) inputEl.focus();
  });

  $effect(() => {
    if (open) {
      nameInput = initialName;
      errorMsg = null;
      confirmOverwrite = false;
    }
  });

  const processed = $derived(autoTrim ? nameInput.trim() : nameInput);

  function validate(name: string): string | null {
    if (!name) return 'Name cannot be empty';
    if (maxLength !== undefined && name.length > maxLength)
      return `Name cannot exceed ${maxLength} characters`;
    if (!allowedNames.test(name)) return 'Name contains invalid characters';
    if (reservedNames.includes(name)) return 'This name is reserved';
    return null;
  }

  function commit() {
    open = false;
    onComplete(processed);
  }

  function handleSave() {
    const err = validate(processed);
    if (err) {
      errorMsg = err;
      return;
    }
    if (checkIfOverwrites(processed) && !confirmOverwrite) {
      confirmOverwrite = true;
      return;
    }
    commit();
  }

  function handleCancel() {
    open = false;
    onCancel?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (confirmOverwrite) commit();
      else handleSave();
    } else if (e.key === 'Escape' && confirmOverwrite) {
      e.preventDefault();
      confirmOverwrite = false;
    }
  }

  function handleInput(e: Event) {
    nameInput = (e.target as HTMLInputElement).value;
    errorMsg = null;
    confirmOverwrite = false;
  }

  const actions = $derived<ModalAction[]>(
    confirmOverwrite
      ? [
          { label: 'Back', callback: () => (confirmOverwrite = false) },
          { label: 'Overwrite', color: 'blue', callback: commit }
        ]
      : [
          { label: 'Cancel', callback: handleCancel },
          { label: 'Save', color: 'blue', callback: handleSave }
        ]
  );
</script>

<Modal bind:open {title} onClose={onCancel} {actions} onKeyDown={handleKeydown}>
  {#if confirmOverwrite}
    <p class="text-xs text-neutral-300">
      <span class="text-white font-medium">"{processed}"</span> already exists. Overwrite?
    </p>
  {:else}
    <div class="flex flex-col gap-1.5">
      <input
        bind:this={inputEl}
        type="text"
        class="w-full bg-neutral-800 text-white rounded px-2 py-1 text-xs border border-neutral-700 focus:border-blue-500 outline-none"
        placeholder="Name"
        maxlength={maxLength}
        value={nameInput}
        oninput={handleInput}
      />
      {#if errorMsg}
        <p class="text-red-400 text-xs">{errorMsg}</p>
      {/if}
    </div>
  {/if}
</Modal>
