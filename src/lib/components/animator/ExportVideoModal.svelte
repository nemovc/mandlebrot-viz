<script lang="ts">
  import type { ExportProgress } from '$lib/utils/animator/videoExporter';
  import Modal from '$lib/components/ui/Modal.svelte';

  let {
    open = $bindable(false),
    exportUrl,
    progress,
    onSave,
    onReset,
    onCancel
  }: {
    open?: boolean;
    exportUrl?: string;
    progress?: ExportProgress | null;
    onSave: () => void;
    onReset: () => void;
    onCancel: () => void;
  } = $props();

  const isExporting = $derived(progress != null);

  const percent = $derived(
    progress ? Math.round((progress.frame / progress.totalFrames) * 100) : 0
  );

  const phaseText = $derived(
    progress?.phase === 'rendering' ? 'Rendering frames' : 'Encoding video'
  );

  const frameText = $derived(progress ? `${progress.frame + 1} / ${progress.totalFrames}` : '');

  const exportingActions = $derived([{ label: 'Cancel Export', callback: onCancel }]);

  const doneActions = $derived([
    { label: 'Close export', callback: onReset },
    { label: 'Save WebM', color: 'blue' as const, callback: onSave, isDefault: true }
  ]);
</script>

{#if isExporting}
  <!-- Exporting state -->
  <Modal
    bind:open
    title="Exporting WebM"
    closeOnEscape={true}
    closeOnBackdrop={true}
    showX={true}
    actions={exportingActions}
  >
    <div class="flex flex-col gap-4 w-[400px]">
      <div class="text-neutral-400 text-sm">{phaseText}</div>

      <!-- Progress bar -->
      <div class="relative h-2 bg-neutral-800 rounded overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 bg-blue-500 transition-all"
          style="width: {percent}%"
        ></div>
      </div>

      <!-- Stats -->
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-neutral-500">{frameText}</span>
        <span class="text-neutral-400">{percent}%</span>
      </div>
    </div>
  </Modal>
{:else}
  <!-- Export complete state -->
  <Modal
    bind:open
    title="Export complete"
    closeOnEscape={false}
    closeOnBackdrop={false}
    showX={false}
    actions={doneActions}
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
{/if}
