import { WorkerPool } from "../workerPool";
import type { RecolorJob, RecolorResult } from "../jobs";
import RecolorWorker from "../recolor.worker.ts?worker";

class AnimatorRecolorPool extends WorkerPool<RecolorJob, RecolorResult> {
  private static _instance: AnimatorRecolorPool | null = null;
  static get instance(): AnimatorRecolorPool {
    return (this._instance ??= new AnimatorRecolorPool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = Math.max(
    2,
    Math.floor((navigator.hardwareConcurrency || 4) / 2),
  );
  protected createWorker() {
    return new RecolorWorker();
  }
}

export { AnimatorRecolorPool };
