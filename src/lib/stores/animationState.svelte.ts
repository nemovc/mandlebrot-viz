import { PRESETS, type ColorStop, type Algorithm } from '$lib/utils/colorPalettes';

export type TrackParameter = 'zoom' | 'cx' | 'cy' | 'maxIter' | 'cyclePeriod' | 'offset';
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export const TRACK_PARAMS: TrackParameter[] = [
  'zoom',
  'cx',
  'cy',
  'maxIter',
  'cyclePeriod',
  'offset'
];

export const TRACK_LABELS: Record<TrackParameter, string> = {
  zoom: 'Zoom',
  cx: 'Centre Re',
  cy: 'Centre Im',
  maxIter: 'Max Iter',
  cyclePeriod: 'Cycle Period',
  offset: 'Offset'
};

export interface Keyframe {
  frame: number; // integer
  value: number;
  easing: EasingType;
}

export interface ParameterTrack {
  parameter: TrackParameter;
  keyframes: Keyframe[]; // always sorted by frame ascending
  endFrame: number | null;
}

export interface AnimationProject {
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  power: number;
  algorithm: Algorithm;
  palette: ColorStop[];
  inSetColor: string;
  reverse: boolean;
  tracks: ParameterTrack[]; // always length 6, in TRACK_PARAMS order
}
const defaultParam: Record<TrackParameter, number> = {
  zoom: 3,
  cx: 0,
  cy: 0,
  maxIter: 256,
  cyclePeriod: 64,
  offset: 0
};

function defaultProject(): AnimationProject {
  return {
    totalFrames: 300,
    fps: 30,
    width: 1920,
    height: 1080,
    power: 2,
    algorithm: 'escape_time_smooth' as Algorithm,
    palette: PRESETS['Classic Blue-Gold'].cyclic.palette,
    inSetColor: '#000000',
    reverse: false,
    tracks: TRACK_PARAMS.map((p) => ({
      parameter: p,
      keyframes: [
        {
          frame: 0,
          value: defaultParam[p],
          easing: 'linear'
        }
      ],
      endFrame: null
    }))
  };
}

function snap(p: AnimationProject): AnimationProject {
  return JSON.parse(JSON.stringify(p));
}

const STORAGE_KEY = 'mandelbrot-animator-project';

function createAnimationState() {
  let project = $state<AnimationProject>(defaultProject());
  let currentFrame = $state(0);
  let revision = $state(0);
  const undoStack: AnimationProject[] = [];
  const redoStack: AnimationProject[] = [];

  // Restore working copy from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AnimationProject;
      if (saved?.tracks?.length === TRACK_PARAMS.length) {
        for (const track of saved.tracks)
          for (const kf of track.keyframes) (kf as { easing?: string }).easing ??= 'linear';
        project = saved;
      }
    }
  } catch {
    /* corrupted — use defaultProject() */
  }

  function persistProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      /* storage full */
    }
  }

  function commit(fn: () => void) {
    undoStack.push(snap(project));
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    fn();
    revision++;
    persistProject();
  }

  function clampFrame(f: number) {
    return Math.max(0, Math.min(Math.round(f), project.totalFrames - 1));
  }

  return {
    get project() {
      return project;
    },
    get currentFrame() {
      return currentFrame;
    },
    set currentFrame(v: number) {
      currentFrame = clampFrame(v);
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },

    get isDirty() {
      return undoStack.length > 0 || redoStack.length > 0;
    },

    get revision() {
      return revision;
    },

    undo() {
      if (!undoStack.length) return;
      redoStack.push(snap(project));
      project = undoStack.pop()!;
      currentFrame = clampFrame(currentFrame);
      revision++;
      persistProject();
    },

    redo() {
      if (!redoStack.length) return;
      undoStack.push(snap(project));
      project = redoStack.pop()!;
      currentFrame = clampFrame(currentFrame);
      revision++;
      persistProject();
    },

    reset() {
      undoStack.length = 0;
      redoStack.length = 0;
      project = defaultProject();
      console.log(defaultProject());
      currentFrame = 0;
      redoStack.length = 0;
      revision++;
      localStorage.removeItem(STORAGE_KEY);
    },

    load(incoming: AnimationProject) {
      if (!incoming?.tracks || incoming.tracks.length !== TRACK_PARAMS.length) return;
      for (const track of incoming.tracks)
        for (const kf of track.keyframes) (kf as { easing?: string }).easing ??= 'linear';
      undoStack.length = 0;
      redoStack.length = 0;
      project = JSON.parse(JSON.stringify(incoming));
      currentFrame = 0;
      revision++;
      persistProject();
    },

    addKeyframe(trackIdx: number, frame: number, value: number) {
      commit(() => {
        const track = project.tracks[trackIdx];
        track.keyframes = [
          ...track.keyframes.filter((k) => k.frame !== frame),
          { frame, value, easing: 'linear' as const }
        ].sort((a, b) => a.frame - b.frame);
      });
    },

    removeKeyframe(trackIdx: number, frame: number) {
      commit(() => {
        project.tracks[trackIdx].keyframes = project.tracks[trackIdx].keyframes.filter(
          (k) => k.frame !== frame
        );
      });
    },

    updateKeyframeValue(trackIdx: number, frame: number, value: number) {
      commit(() => {
        const kf = project.tracks[trackIdx].keyframes.find((k) => k.frame === frame);
        if (kf) kf.value = value;
      });
    },

    addEndKeyframe(trackIdx: number) {
      commit(() => {
        const track = project.tracks[trackIdx];
        track.endFrame = track.keyframes.at(-1)!.value;
        console.log(track.endFrame);
      });
    },

    updateEndKeyframe(trackIdx: number, value: number) {
      commit(() => {
        const track = project.tracks[trackIdx];
        track.endFrame = value;
      });
    },

    removeEndKeyframe(trackIdx: number) {
      commit(() => {
        const track = project.tracks[trackIdx];
        track.endFrame = null;
      });
    },

    moveKeyframe(trackIdx: number, fromFrame: number, toFrame: number) {
      commit(() => {
        const track = project.tracks[trackIdx];
        const kf = track.keyframes.find((k) => k.frame === fromFrame);
        if (!kf) return;
        track.keyframes = [
          ...track.keyframes.filter((k) => k.frame !== fromFrame && k.frame !== toFrame),
          { ...kf, frame: toFrame }
        ].sort((a, b) => a.frame - b.frame);
      });
    },

    setKeyframeEasing(trackIdx: number, frame: number, easing: EasingType) {
      commit(() => {
        const kf = project.tracks[trackIdx].keyframes.find((k) => k.frame === frame);
        if (kf) kf.easing = easing;
      });
    },

    updateProject(patch: Partial<Omit<AnimationProject, 'tracks'>>) {
      commit(() => {
        if (patch.totalFrames !== undefined && patch.totalFrames !== project.totalFrames) {
          const oldEnd = project.totalFrames;
          const newEnd = patch.totalFrames;
          for (const track of project.tracks) {
            const endKf = track.keyframes.find((k) => k.frame === oldEnd);
            // Remove the old end anchor and any now-out-of-bounds keyframes
            track.keyframes = track.keyframes.filter((k) => k.frame !== oldEnd && k.frame < newEnd);
            // Re-place the end anchor at the new end (unless something already sits there)
            if (endKf && !track.keyframes.find((k) => k.frame === newEnd)) {
              track.keyframes.push({ ...endKf, frame: newEnd });
              track.keyframes.sort((a, b) => a.frame - b.frame);
            }
          }
        }
        Object.assign(project, patch);
        if (patch.totalFrames !== undefined) {
          currentFrame = clampFrame(currentFrame);
        }
      });
    }
  };
}

export const animationState = createAnimationState();
