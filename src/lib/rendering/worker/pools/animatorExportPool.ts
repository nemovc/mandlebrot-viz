import { WorkerPool } from "../workerPool";
import type { ComputeJob, ComputeResult } from "../jobs";
import MandelbrotWorker from "../mandelbrot.worker.ts?worker";

class AnimatorExportPool extends WorkerPool<ComputeJob, ComputeResult> {
  private static _instance: AnimatorExportPool | null = null;
  static get instance(): AnimatorExportPool {
    return (this._instance ??= new AnimatorExportPool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = navigator.hardwareConcurrency || 4;
  protected createWorker() {
    return new MandelbrotWorker();
  }
}

export { AnimatorExportPool };
