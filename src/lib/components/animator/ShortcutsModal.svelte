<script lang="ts">
  let { open = $bindable(false) } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") open = false;
  }

  const groups: {
    label: string;
    rows: { keys: string[]; desc: string; stub?: true }[];
  }[] = [
    {
      label: "Navigation",
      rows: [
        { keys: ["←", "→"], desc: "Move ±1 frame" },
        { keys: ["Shift+←", "Shift+→"], desc: "Move ±1 second" },
        { keys: ["Ctrl+←", "Ctrl+→"], desc: "Jump to prev / next keyframe" },
        { keys: ["Home"], desc: "Jump to start" },
        { keys: ["End"], desc: "Jump to end" },
      ],
    },
    {
      label: "Tracks",
      rows: [{ keys: ["↑", "↓"], desc: "Select prev / next track" }],
    },
    {
      label: "Keyframes",
      rows: [
        { keys: ["Enter"], desc: "Add or edit keyframe" },
        { keys: ["Delete"], desc: "Delete keyframe at current frame" },
      ],
    },
    {
      label: "Playback",
      rows: [
        { keys: ["Space"], desc: "Play / pause preview" },
        { keys: ["R"], desc: "Toggle loop" },
        {
          keys: ["Ctrl+←", "Ctrl+→"],
          desc: "Jump to start / end (in preview)",
        },
        {
          keys: ["Ctrl+Space"],
          desc: "Generate WebM export (or cancel in progress)",
        },
      ],
    },
    {
      label: "Project",
      rows: [
        { keys: ["Ctrl+S"], desc: "Save project", stub: true },
        { keys: ["Ctrl+N"], desc: "New project", stub: true },
        { keys: ["Ctrl+Z"], desc: "Undo" },
        { keys: ["Ctrl+Y"], desc: "Redo" },
      ],
    },
    {
      label: "General",
      rows: [
        { keys: ["Escape"], desc: "Dismiss focused input" },
        { keys: ["?"], desc: "Show / hide this reference" },
      ],
    },
  ];
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- backdrop -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center"
    onclick={() => (open = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- card -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-neutral-900 border border-neutral-700 rounded-lg p-5 w-[400px] max-h-[80vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-white font-medium text-sm">Keyboard Shortcuts</h2>
        <button
          class="text-neutral-400 hover:text-white transition-colors"
          onclick={() => (open = false)}>✕</button
        >
      </div>

      <div class="flex flex-col gap-5">
        {#each groups as group}
          <div>
            <div
              class="text-neutral-600 text-[10px] uppercase tracking-wider mb-2"
            >
              {group.label}
            </div>
            <div class="flex flex-col gap-1.5">
              {#each group.rows as row}
                <div class="flex items-center justify-between text-[11px]">
                  <div class="flex items-center gap-1">
                    {#each row.keys as key, ki}
                      {#if ki > 0}<span class="text-neutral-700">/</span>{/if}
                      <kbd
                        class="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 font-mono text-[10px]"
                        >{key}</kbd
                      >
                    {/each}
                  </div>
                  <span
                    class="{row.stub
                      ? 'text-neutral-600'
                      : 'text-neutral-400'} text-right"
                  >
                    {row.desc}{#if row.stub}<span class="text-neutral-700 ml-1"
                        >(coming soon)</span
                      >{/if}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
