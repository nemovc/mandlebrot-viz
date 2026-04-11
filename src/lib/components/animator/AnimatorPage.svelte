<script lang="ts">
  import type { Snippet } from 'svelte';

  import { untrack } from 'svelte';
  import AnimatorPreview from './AnimatorPreview.svelte';
  import Timeline from './Timeline.svelte';
  import ShortcutsModal from './ShortcutsModal.svelte';
  import PlaybackModal from './PlaybackModal.svelte';
  import NewProjectModal from './NewProjectModal.svelte';
  import ExportProjectModal from './ExportProjectModal.svelte';
  import ImportProjectModal from './ImportProjectModal.svelte';
  import ExportVideoModal from './ExportVideoModal.svelte';
  import { ChevronLeft } from 'lucide-svelte';
import { keyboardLayer } from '$lib/stores/keyboardShortcuts.svelte';
  import { animationState, TRACK_LABELS, type EasingType } from '$lib/stores/animationState.svelte';
  import { exportWebM, type ExportProgress } from '$lib/utils/animator/videoExporter';
  import { interpolateTrack, interpolateAll } from '$lib/utils/animator/interpolation';
  import { baseAlgorithm } from '$lib/utils/colorPalettes';
  import { frameCache } from '$lib/utils/animator/frameCache.svelte';
  import type { ViewerState } from '$lib/stores/viewerState.svelte';
  import AnimatorExplorer from './AnimatorExplorer.svelte';
  import ControlBar from './ControlBar.svelte';
  import ProjectPanel from './ProjectPanel.svelte';
  import KeyframeBar from './KeyframeBar.svelte';
  import DebugPanel from '$lib/components/viewer/DebugPanel.svelte';
  import ControlPanel from '$lib/components/viewer/ControlPanel.svelte';
  import ColorSchemeEditor from '$lib/components/viewer/ColorSchemeEditor.svelte';
  import { interpolateTrack as interpolateTrackFn } from '$lib/utils/animator/interpolation';
  import { AnimatorPreviewPool } from '$lib/rendering/worker/pools/animatorPreviewPool';
  import { AnimatorCachePool } from '$lib/rendering/worker/pools/animatorCachePool';
  import { AnimatorExportPool } from '$lib/rendering/worker/pools/animatorExportPool';
  import { AnimatorRecolorPool } from '$lib/rendering/worker/pools/animatorRecolorPool';
  import { ViewerS2Pool } from '$lib/rendering/worker/pools/viewerS2Pool';
  import { ViewerS3Pool } from '$lib/rendering/worker/pools/viewerS3Pool';
  import { ViewerRecolorPool } from '$lib/rendering/worker/pools/viewerRecolorPool';

  let showShortcuts = $state(false);
  let showPlayback = $state(false);
  let loopPlayback = $state(true);
  let showNewProjectModal = $state(false);
  let showExportModal = $state(false);
  let showImportModal = $state(false);
  let activeProjectName = $state<string | null>(null);
  let explorerOpen = $state(false);
  let explorerState = $state<ViewerState | null>(null);
  let syncSignal = $state(0);
  let panelsEl = $state<HTMLDivElement | null>(null);
  let panelW = $state(0);
  let panelH = $state(0);

  // ---- Frame cache ----
  let cacheTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleCache(invalidateFirst: boolean, delay = 300) {
    if (cacheTimer) {
      clearTimeout(cacheTimer);
      cacheTimer = null;
    }
    const run = () => {
      if (invalidateFirst) frameCache.invalidate();
      frameCache.startFrom(
        animationState.currentFrame,
        animationState.project,
        showPlayback ? 1 : 2
      );
    };
    if (delay === 0) run();
    else cacheTimer = setTimeout(run, delay);
  }

  // ---- Project management ----
  function triggerNew() {
    if (animationState.isDirty) {
      showNewProjectModal = true;
    } else {
      animationState.reset();
      activeProjectName = null;
    }
  }

  function handleSaveAndNew(name: string) {
    showNewProjectModal = false;
    animationState.reset();
    activeProjectName = null;
  }

  function handleDiscardAndNew() {
    showNewProjectModal = false;
    animationState.reset();
    activeProjectName = null;
  }

  function handleLoadProject(
    p: import('$lib/stores/animationState.svelte').AnimationProject,
    name: string
  ) {
    animationState.load(p);
    activeProjectName = name;
  }

  function handleProjectSaved(name: string) {
    activeProjectName = name;
  }

  function handleImportProject(p: import('$lib/stores/animationState.svelte').AnimationProject) {
    animationState.load(p);
    activeProjectName = null;
    showImportModal = false;
  }

  // Invalidate + rebuild on any project edit (commit bumps revision)
  let revisionInit = false;
  $effect(() => {
    animationState.revision;
    if (!revisionInit) {
      revisionInit = true;
      return;
    }
    untrack(() => scheduleCache(true, 0));
  });

  // Restart cache from new position on seek (debounced)
  $effect(() => {
    animationState.currentFrame;
    scheduleCache(false, 100);
  });

  // Sync project-wide settings to explorer (but not cx/cy/zoom)
  $effect(() => {
    if (!explorerOpen || !explorerState) return;
    const project = animationState.project;
    const frameState = interpolateAll(project, animationState.currentFrame);
    // Only update if values actually differ (avoid infinite loop)
    if (
      explorerState.maxIter !== frameState.maxIter ||
      explorerState.power !== frameState.power ||
      JSON.stringify(explorerState.colors) !== JSON.stringify(frameState.colors)
    ) {
      explorerState = {
        ...explorerState,
        maxIter: frameState.maxIter,
        power: frameState.power,
        colors: frameState.colors
      };
    }
  });

  const cacheReady = $derived(frameCache.isReady);

  // ---- Panel sizing (maintain project AR for both preview and explorer) ----
  $effect(() => {
    const el = panelsEl;
    const open = explorerOpen;
    const projW = animationState.project.width;
    const projH = animationState.project.height;
    if (!el) return;

    function compute() {
      const availW = el!.clientWidth;
      const availH = el!.clientHeight;
      const count = open ? 2 : 1;
      const combinedAR = (projW * count) / projH;
      let w: number, h: number;
      if (availW / availH >= combinedAR) {
        h = availH;
        w = availH * combinedAR;
      } else {
        w = availW;
        h = availW / combinedAR;
      }
      panelW = Math.floor(w / count);
      panelH = Math.floor(h);
    }

    const ro = new ResizeObserver(compute);
    ro.observe(el);
    compute();
    return () => ro.disconnect();
  });

  // ---- Keyboard shortcuts ----
  function handleKey(e: KeyboardEvent) {
    const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;

    if (e.key === 'Escape' && inInput) {
      (e.target as HTMLElement).blur();
      return;
    }

    if (inInput) return;

    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      animationState.undo();
    } else if (
      (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
      (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
    ) {
      e.preventDefault();
      animationState.redo();
    } else if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (selectedTrack === null) {
        animationState.currentFrame = 0;
      } else {
        const kfTrack = animationState.project.tracks[selectedTrack];
        if (kfTrack) {
          const prev = [...kfTrack.keyframes]
            .reverse()
            .find((k) => k.frame < animationState.currentFrame);
          if (prev) {
            animationState.currentFrame = prev.frame;
          }
        }
      }
    } else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (selectedTrack === null) {
        animationState.currentFrame = project.totalFrames;
      } else {
        const kfTrack = animationState.project.tracks[selectedTrack];
        if (kfTrack) {
          const next = kfTrack.keyframes.find((k) => k.frame > animationState.currentFrame);
          if (next) {
            animationState.currentFrame = next.frame;
          } else {
            // No next keyframe - we're on or past the last one, go to end
            animationState.currentFrame = project.totalFrames;
          }
        }
      }
    } else if (e.key === 'ArrowLeft' && e.shiftKey) {
      e.preventDefault();
      animationState.currentFrame = animationState.currentFrame - project.fps;
    } else if (e.key === 'ArrowRight' && e.shiftKey) {
      e.preventDefault();
      animationState.currentFrame = animationState.currentFrame + project.fps;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      animationState.currentFrame = animationState.currentFrame - 1;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      animationState.currentFrame = animationState.currentFrame + 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      animationState.currentFrame = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      animationState.currentFrame = project.totalFrames;
    } else if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (exportPhase === 'exporting') {
        cancelExport();
      } else {
        startExport();
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      if (cacheReady) showPlayback = true;
    } else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      triggerNew();
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      toggleExplorer();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!kfTrack) return;
      if (kfAtFrame) {
        keyframeBar?.focusValueInput();
      } else {
        animationState.addKeyframe(selectedTrack!, kfFrame, kfInterpolated);
        keyframeBar?.focusValueInput();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const count = project.tracks.length;
      if (count === 0) return;
      const start = selectedTrack === null ? count - 1 : selectedTrack - 1;
      for (let i = start; i >= 0; i--) {
        if (!disabledTracks.has(i)) {
          selectedTrack = i;
          break;
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const count = project.tracks.length;
      if (count === 0) return;
      const start = selectedTrack === null ? 0 : selectedTrack + 1;
      for (let i = start; i < count; i++) {
        if (!disabledTracks.has(i)) {
          selectedTrack = i;
          break;
        }
      }
    } else if (e.key === 'Delete') {
      if (kfAtFrame && !kfIsAnchor) {
        if (selectedTrack !== null) animationState.removeKeyframe(selectedTrack, kfFrame);
      }
    } else if (e.key === '?') {
      showShortcuts = !showShortcuts;
    }
  }

  // ---- Settings helpers ----
  const project = $derived(animationState.project);
  const isHistogram = $derived(baseAlgorithm(project.algorithm) === 'histogram');
  const disabledTracks = $derived(
    new Set(
      isHistogram
        ? project.tracks
            .map((t, i) => (t.parameter === 'cyclePeriod' ? i : -1))
            .filter((i) => i >= 0)
        : []
    )
  );

  // Keyframe helpers for keyboard shortcuts
  const kfTrack = $derived(
    selectedTrack !== null ? animationState.project.tracks[selectedTrack] : null
  );
  const kfFrame = $derived(animationState.currentFrame);
  const kfInterpolated = $derived(
    kfTrack ? interpolateTrack(kfTrack, kfFrame, project.totalFrames) : 0
  );
  const kfAtFrame = $derived(kfTrack?.keyframes.find((k) => k.frame === kfFrame) ?? null);
  const kfIsAnchor = $derived(kfFrame === 0 || kfFrame === project.totalFrames);
  let keyframeBar: KeyframeBar | null = null;

  // Track whether there's a keyframe at current frame for cyclePeriod and offset
  const cyclePeriodTrack = $derived(project.tracks.find((t) => t.parameter === 'cyclePeriod'));
  const offsetTrack = $derived(project.tracks.find((t) => t.parameter === 'offset'));
  const hasCyclePeriodKeyframe = $derived(
    cyclePeriodTrack?.keyframes.some((k) => k.frame === kfFrame) ?? false
  );
  const hasOffsetKeyframe = $derived(
    offsetTrack?.keyframes.some((k) => k.frame === kfFrame) ?? false
  );

  function setFps(v: number) {
    if (v > 0 && v <= 120) animationState.updateProject({ fps: v });
  }
  function setTotalFrames(v: number) {
    if (v <= 0 || v > 100_000) return;
    if (v < project.totalFrames) {
      const dropping = project.tracks.reduce(
        (sum, t) =>
          sum + t.keyframes.filter((k) => k.frame >= v && k.frame < project.totalFrames).length,
        0
      );
      if (
        dropping > 0 &&
        !confirm(
          `Shortening will delete ${dropping} keyframe${dropping === 1 ? '' : 's'} outside the new length. Continue?`
        )
      )
        return;
    }
    animationState.updateProject({ totalFrames: v });
  }
  function setWidth(v: number) {
    if (v > 0) animationState.updateProject({ width: v });
  }
  function setHeight(v: number) {
    if (v > 0) animationState.updateProject({ height: v });
  }
  function setPower(v: number) {
    if (v >= 2 && v <= 10) animationState.updateProject({ power: v });
  }

  // ---- ColorSchemeEditor keyframe callbacks ----
  function handleCyclePeriodChange(v: number) {
    const track = project.tracks.find((t) => t.parameter === 'cyclePeriod');
    if (track) {
      animationState.addKeyframe(
        project.tracks.indexOf(track),
        animationState.currentFrame,
        v
      );
    }
  }

  function handleOffsetChange(v: number) {
    const track = project.tracks.find((t) => t.parameter === 'offset');
    if (track) {
      animationState.addKeyframe(
        project.tracks.indexOf(track),
        animationState.currentFrame,
        v
      );
    }
  }

  // Get interpolated values for display in ColorSchemeEditor
  const cyclePeriodValue = $derived(
    interpolateTrackFn(
      project.tracks.find((t) => t.parameter === 'cyclePeriod')!,
      animationState.currentFrame,
      project.totalFrames
    )
  );
  const offsetValue = $derived(
    interpolateTrackFn(
      project.tracks.find((t) => t.parameter === 'offset')!,
      animationState.currentFrame,
      project.totalFrames
    )
  );

  // ---- Video export ----
  type ExportPhase = 'idle' | 'exporting' | 'done';
  let exportPhase = $state<ExportPhase>('idle');
  let exportProgress = $state<ExportProgress | null>(null);
  let exportUrl = $state('');
  let exportAbort: AbortController | null = null;

  async function startExport() {
    if (exportPhase === 'exporting') return;
    exportPhase = 'exporting';
    exportProgress = null;
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = '';

    exportAbort = new AbortController();
    try {
      const blob = await exportWebM(
        JSON.parse(JSON.stringify(project)),
        (p) => (exportProgress = p),
        exportAbort.signal
      );
      exportUrl = URL.createObjectURL(blob);
      exportPhase = 'done';
      exportProgress = null;
    } catch (e: unknown) {
      if ((e as { name: string }).name !== 'AbortError') throw e;
      exportPhase = 'idle';
      exportProgress = null;
    } finally {
      exportAbort = null;
    }
  }

  function cancelExport() {
    exportAbort?.abort();
  }

  function saveVideo() {
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = `mandelbrot-${project.width}x${project.height}-${project.fps}fps.webm`;
    a.click();
  }

  function resetExport() {
    URL.revokeObjectURL(exportUrl);
    exportUrl = '';
    exportPhase = 'idle';
  }

  // Cancel export whenever the project is mutated
  let exportWatchInitialized = false;
  $effect(() => {
    animationState.revision;
    if (!exportWatchInitialized) {
      exportWatchInitialized = true;
      return;
    }
    untrack(() => {
      cancelExport();
      if (exportPhase !== 'idle') resetExport();
    });
  });

  // ---- Timeline state ----
  let selectedTrack = $state<number | null>(null);

  // ---- Explorer helpers ----
  function toggleExplorer() {
    if (!explorerOpen) {
      // Opening: initialize/reinitialize cx/cy/zoom from current frame
      const frameState = interpolateAll(animationState.project, animationState.currentFrame);
      if (explorerState) {
        // Reopen: preserve independent cx/cy/zoom by syncing from current frame
        explorerState = {
          ...explorerState,
          cx: frameState.cx,
          cy: frameState.cy,
          zoom: frameState.zoom
        };
      } else {
        // First time opening - initialize with current frame state
        explorerState = frameState;
      }
    }
    explorerOpen = !explorerOpen;
  }

  function handleExplorerNavigate(re: number, im: number, zoom?: number) {
    if (explorerState) {
      explorerState = {
        ...explorerState,
        cx: re.toString(),
        cy: im.toString(),
        zoom: zoom ?? explorerState.zoom
      };
    }
  }

  function handleExplorerIterChange(v: number) {
    // Disabled in explorer mode - no-op
  }

  function handleExplorerPowerChange(v: number) {
    // Disabled in explorer mode - no-op
  }

  // Step functions for ControlBar buttons (same as arrow keys with modifiers)
  function stepBack(ctrl: boolean, shift: boolean) {
    if (ctrl) {
      // Ctrl+step: jump to previous keyframe or start
      if (selectedTrack === null) {
        animationState.currentFrame = 0;
      } else {
        const kfTrack = animationState.project.tracks[selectedTrack];
        if (kfTrack) {
          const prev = [...kfTrack.keyframes]
            .reverse()
            .find((k) => k.frame < animationState.currentFrame);
          if (prev) {
            animationState.currentFrame = prev.frame;
          }
        }
      }
    } else if (shift) {
      // Shift+step: jump 1 second (fps frames)
      animationState.currentFrame = animationState.currentFrame - project.fps;
    } else {
      // Normal step: 1 frame
      animationState.currentFrame = animationState.currentFrame - 1;
    }
  }

  function stepForward(ctrl: boolean, shift: boolean) {
    if (ctrl) {
      // Ctrl+step: jump to next keyframe or end
      if (selectedTrack === null) {
        animationState.currentFrame = project.totalFrames;
      } else {
        const kfTrack = animationState.project.tracks[selectedTrack];
        if (kfTrack) {
          const next = kfTrack.keyframes.find((k) => k.frame > animationState.currentFrame);
          if (next) {
            animationState.currentFrame = next.frame;
          } else {
            animationState.currentFrame = project.totalFrames;
          }
        }
      }
    } else if (shift) {
      // Shift+step: jump 1 second (fps frames)
      animationState.currentFrame = animationState.currentFrame + project.fps;
    } else {
      // Normal step: 1 frame
      animationState.currentFrame = animationState.currentFrame + 1;
    }
  }
</script>

<svelte:head>
  <title>Mandelbrot Animator</title>
</svelte:head>

<div use:keyboardLayer={handleKey} class="flex flex-col h-full bg-neutral-950 text-white relative">
  <!-- Preview Area -->
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col bg-neutral-950 relative">
    <!-- Panels row -->
    <div bind:this={panelsEl} class="flex-1 flex min-h-0">
      {#if explorerOpen && explorerState}
        <div class="flex-1 flex items-center justify-center h-full border-r border-neutral-800 relative">
          <div style="width: {panelW}px; height: {panelH}px;">
            <AnimatorExplorer
              initialState={explorerState}
              onUpdate={(s) => {
                explorerState = { ...explorerState, ...s };
              }}
              projectWidth={project.width}
              panelWidth={panelW}
              {syncSignal}
            />
          </div>
          <!-- ControlPanel inside explorer -->
          <div class="absolute top-3 left-3 z-[1000]">
            <ControlPanel
              onNavigate={handleExplorerNavigate}
              onIterChange={handleExplorerIterChange}
              onPowerChange={handleExplorerPowerChange}
              ctrlState={explorerState}
              disableMaxIter={true}
              disablePower={true}
            />
          </div>
        </div>
      {/if}
      <div class="{explorerOpen ? 'flex-1' : 'w-full'} flex items-center justify-center h-full">
        <div style="width: {panelW}px; height: {panelH}px;">
          <AnimatorPreview active={!showPlayback} />
        </div>
      </div>
    </div>

    <!-- Overlay panels (positioned over entire preview area) -->
    <!-- Top-right: ColorSchemeEditor -->
    <div class="absolute top-3 right-3 z-[1000]">
      <ColorSchemeEditor
        open={false}
        colors={{
          algorithm: project.algorithm,
          palette: project.palette,
          cyclePeriod: cyclePeriodValue,
          offset: offsetValue,
          reverse: project.reverse,
          inSetColor: project.inSetColor
        }}
        setColors={(c: import('$lib/utils/colorPalettes').ColorConfig) => {
          animationState.updateProject({
            algorithm: c.algorithm,
            palette: c.palette,
            inSetColor: c.inSetColor ?? '#000000',
            reverse: c.reverse ?? false
          });
        }}
        onCyclePeriodChange={handleCyclePeriodChange}
        onOffsetChange={handleOffsetChange}
        cyclePeriodValue={cyclePeriodValue}
        offsetValue={offsetValue}
        hasCyclePeriodKeyframe={hasCyclePeriodKeyframe}
        hasOffsetKeyframe={hasOffsetKeyframe}
      />
    </div>

    <!-- Bottom-left: DebugPanel -->
    <div class="absolute bottom-3 left-3 z-[1000]">
      <DebugPanel
        pools={explorerOpen ? [
          { name: 'PR', pool: AnimatorPreviewPool.instance, textColor: 'text-blue-400', barColor: 'bg-blue-400' },
          { name: 'CA', pool: AnimatorCachePool.instance, textColor: 'text-green-500', barColor: 'bg-green-500' },
          { name: 'RC', pool: AnimatorRecolorPool.instance, textColor: 'text-purple-400', barColor: 'bg-purple-400' },
          { name: 'EX', pool: AnimatorExportPool.instance, textColor: 'text-yellow-400', barColor: 'bg-yellow-400' },
          { name: 'S2', pool: ViewerS2Pool.instance, textColor: 'text-pink-400', barColor: 'bg-pink-400' },
          { name: 'S3', pool: ViewerS3Pool.instance, textColor: 'text-cyan-400', barColor: 'bg-cyan-400' },
          { name: 'VR', pool: ViewerRecolorPool.instance, textColor: 'text-orange-400', barColor: 'bg-orange-400' }
        ] : [
          { name: 'PR', pool: AnimatorPreviewPool.instance, textColor: 'text-blue-400', barColor: 'bg-blue-400' },
          { name: 'CA', pool: AnimatorCachePool.instance, textColor: 'text-green-500', barColor: 'bg-green-500' },
          { name: 'RC', pool: AnimatorRecolorPool.instance, textColor: 'text-purple-400', barColor: 'bg-purple-400' },
          { name: 'EX', pool: AnimatorExportPool.instance, textColor: 'text-yellow-400', barColor: 'bg-yellow-400' }
        ]}
      />
    </div>

    <!-- Bottom-right: ProjectPanel -->
    <div class="absolute bottom-3 right-3 z-[1000]">
      <ProjectPanel
        open={false}
        project={project}
        projectName={activeProjectName}
        isDirty={animationState.isDirty}
        onSave={() => {
          // Open save modal if no name, otherwise save directly
          if (!activeProjectName) {
            showNewProjectModal = true;
          } else {
            // Save to localStorage under current name
            import('$lib/stores/savedProjects.svelte').then(({ savedProjects }) => {
              savedProjects.save(activeProjectName!, project);
            });
          }
        }}
        onNew={triggerNew}
        onLoad={handleLoadProject}
        onExport={() => (showExportModal = true)}
        onImport={() => (showImportModal = true)}
        onExportWebM={startExport}
        onFpsChange={setFps}
        onFramesChange={setTotalFrames}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        onPowerChange={setPower}
      />
    </div>

  </div>

  <!-- Explorer info + sync bar (below preview, above control bar) -->
  {#if explorerOpen && explorerState}
    <div class="h-7 bg-neutral-900 border-t border-neutral-800 text-[11px]">
      <div class="flex items-center h-full gap-2 px-2">
        <div class="flex-1 flex items-center justify-center gap-2 text-neutral-400">
          <span class="text-neutral-500">Re:</span>
          <span class="font-mono text-white">{parseFloat(explorerState.cx).toFixed(6)}</span>
          <span class="text-neutral-700">|</span>
          <span class="text-neutral-500">Im:</span>
          <span class="font-mono text-white">{parseFloat(explorerState.cy).toFixed(6)}</span>
          <span class="text-neutral-700">|</span>
          <span class="text-neutral-500">Z:</span>
          <span class="font-mono text-white">{explorerState.zoom.toFixed(3)}</span>
        </div>
        <button
          class="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 transition-colors shrink-0"
          title="Sync explorer position to current frame"
          onclick={() => {
            const frameState = interpolateAll(animationState.project, animationState.currentFrame);
            explorerState = {
              ...explorerState,
              cx: frameState.cx,
              cy: frameState.cy,
              zoom: frameState.zoom
            };
            syncSignal++;
          }}
        >
          <ChevronLeft size={12} />
          Sync
        </button>
        <div class="flex-1"></div>
      </div>
    </div>
  {/if}

  <!-- Control Bar (play, scrub, undo/redo, shortcuts) -->
  <ControlBar
    onPlay={() => { if (cacheReady) showPlayback = true; }}
    onUndo={() => animationState.undo()}
    onRedo={() => animationState.redo()}
    onStepBack={stepBack}
    onStepForward={stepForward}
    onExplorerToggle={toggleExplorer}
    onShortcuts={() => (showShortcuts = true)}
    {cacheReady}
    {explorerOpen}
  />

  <!-- Timeline (keyframe tracks) -->
  <div class="shrink-0 border-t border-neutral-800">
    <Timeline bind:selectedTrack {explorerOpen} {explorerState} />
  </div>

  <!-- Keyframe Editor Bar -->
  <KeyframeBar bind:this={keyframeBar} {selectedTrack} onSelectTrack={(t) => (selectedTrack = t)} />
</div>

<ShortcutsModal bind:open={showShortcuts} />
<PlaybackModal bind:open={showPlayback} bind:loopPlayback />

{#if showNewProjectModal}
  <NewProjectModal
    currentProject={animationState.project}
    onSaveAndNew={handleSaveAndNew}
    onDiscardAndNew={handleDiscardAndNew}
    onCancel={() => (showNewProjectModal = false)}
  />
{/if}

{#if showExportModal}
  <ExportProjectModal
    project={animationState.project}
    projectName={activeProjectName}
    onClose={() => (showExportModal = false)}
  />
{/if}

{#if showImportModal}
  <ImportProjectModal onImport={handleImportProject} onCancel={() => (showImportModal = false)} />
{/if}

<ExportVideoModal
  open={exportPhase === 'exporting' || (exportPhase === 'done' && !!exportUrl)}
  {exportUrl}
  progress={exportProgress}
  onSave={saveVideo}
  onReset={resetExport}
  onCancel={cancelExport}
/>
