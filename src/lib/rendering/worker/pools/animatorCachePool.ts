import { WorkerPool } from "../workerPool";
import type { ComputeJob, ComputeResult } from "../jobs";
import MandelbrotWorker from "../mandelbrot.worker.ts?worker";

class AnimatorCachePool extends WorkerPool<ComputeJob, ComputeResult> {
  private static _instance: AnimatorCachePool | null = null;
  static get instance(): AnimatorCachePool {
    return (this._instance ??= new AnimatorCachePool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = navigator.hardwareConcurrency || 4;
  protected createWorker() {
    return new MandelbrotWorker();
  }
}

export { AnimatorCachePool };
