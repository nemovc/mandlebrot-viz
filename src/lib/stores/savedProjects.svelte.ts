import type { AnimationProject } from '$lib/stores/animationState.svelte';
import { TRACK_PARAMS } from '$lib/stores/animationState.svelte';

const STORAGE_KEY = 'mandelbrot-animator-projects';

export interface SavedProject {
  name: string;
  project: AnimationProject;
}

function createSavedProjects() {
  let projects = $state<SavedProject[]>(
    typeof localStorage !== 'undefined'
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
          } catch {
            return [];
          }
        })()
      : []
  );

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  return {
    get all() {
      return projects;
    },

    validateName(name: string): string | null {
      if (!name.trim()) return 'Name cannot be empty';
      if (name.trim().length > 48) return 'Name cannot exceed 48 characters';
      if (!/^[a-zA-Z0-9 ]+$/.test(name.trim()))
        return 'Name can only contain letters, numbers, and spaces';
      return null;
    },

    exists(name: string): boolean {
      return projects.some((p) => p.name === name.trim());
    },

    save(name: string, project: AnimationProject) {
      const n = name.trim();
      const entry: SavedProject = { name: n, project: JSON.parse(JSON.stringify(project)) };
      const idx = projects.findIndex((p) => p.name === n);
      if (idx >= 0) {
        projects[idx] = entry;
      } else {
        projects = [...projects, entry];
      }
      persist();
    },

    remove(name: string) {
      projects = projects.filter((p) => p.name !== name);
      persist();
    },

    /** Returns null if valid, or an error string if the JSON is unparseable or schema-incompatible */
    parseImport(raw: string): AnimationProject | string {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return 'Invalid JSON';
      }
      const p = parsed as AnimationProject;
      if (!p || typeof p !== 'object') return 'Not a valid project file';
      if (!Array.isArray(p.tracks) || p.tracks.length !== TRACK_PARAMS.length)
        return 'Incompatible project format (wrong number of tracks)';
      // Migration shim
      for (const track of p.tracks)
        for (const kf of track.keyframes) (kf as { easing?: string }).easing ??= 'linear';
      return p;
    }
  };
}

export const savedProjects = createSavedProjects();
