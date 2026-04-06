import type {
  AnimationProject,
  EasingType,
  ParameterTrack,
  TrackParameter,
} from "$lib/stores/animationState.svelte";
import type { ViewerState } from "$lib/stores/viewerState.svelte";

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case "ease-in":
      return t * t * t;
    case "ease-out":
      return 1 - Math.pow(1 - t, 3);
    case "ease-in-out":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default:
      return t;
  }
}

export function interpolateTrack(
  track: ParameterTrack,
  frame: number,
  totalFrames: number,
): number {
  const kfs = track.keyframes.slice();
  if (track.endFrame !== null) {
    kfs.push({
      value: track.endFrame,
      frame: totalFrames,
      // Easing is ignored
      easing: "linear",
    });
  }
  if (kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;
  if (frame <= kfs[0].frame) return kfs[0].value;
  if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1].value;

  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i],
      b = kfs[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const rawT = (frame - a.frame) / (b.frame - a.frame);
      const t = applyEasing(rawT, a.easing);
      return a.value + (b.value - a.value) * t;
    }
  }
  return kfs[kfs.length - 1].value;
}

export function interpolateAll(
  project: AnimationProject,
  frame: number,
): ViewerState {
  const vals = {} as Record<TrackParameter, number>;
  for (const track of project.tracks) {
    vals[track.parameter] = interpolateTrack(track, frame, project.totalFrames);
  }
  return {
    cx: vals.cx.toString(),
    cy: vals.cy.toString(),
    zoom: vals.zoom,
    maxIter: Math.round(vals.maxIter),
    power: project.power,
    colors: {
      algorithm: project.algorithm,
      palette: project.palette,
      cyclePeriod: vals.cyclePeriod,
      offset: vals.offset,
      reverse: project.reverse,
      inSetColor: project.inSetColor,
    },
  };
}
