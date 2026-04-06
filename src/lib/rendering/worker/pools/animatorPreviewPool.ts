import { WorkerPool } from "../workerPool";
import type { ComputeJob, ComputeResult } from "../jobs";
import MandelbrotWorker from "../mandelbrot.worker.ts?worker";

class AnimatorPreviewPool extends WorkerPool<ComputeJob, ComputeResult> {
  private static _instance: AnimatorPreviewPool | null = null;
  static get instance(): AnimatorPreviewPool {
    return (this._instance ??= new AnimatorPreviewPool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = navigator.hardwareConcurrency || 4;
  protected createWorker() {
    return new MandelbrotWorker();
  }
}

export { AnimatorPreviewPool };
