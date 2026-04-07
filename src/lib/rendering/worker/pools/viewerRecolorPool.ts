import { WorkerPool } from "../workerPool";
import type { RecolorJob, RecolorResult } from "../jobs";
import RecolorWorker from "../recolor.worker.ts?worker";

class ViewerRecolorPool extends WorkerPool<RecolorJob, RecolorResult> {
  private static _instance: ViewerRecolorPool | null = null;
  static get instance(): ViewerRecolorPool {
    return (this._instance ??= new ViewerRecolorPool());
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

export { ViewerRecolorPool };
