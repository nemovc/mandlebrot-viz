import { WorkerPool } from "../workerPool";
import type { ComputeJob, ComputeResult } from "../jobs";
import MandelbrotWorker from "../mandelbrot.worker.ts?worker";

class ViewerS3Pool extends WorkerPool<ComputeJob, ComputeResult> {
  private static _instance: ViewerS3Pool | null = null;
  static get instance(): ViewerS3Pool {
    return (this._instance ??= new ViewerS3Pool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = navigator.hardwareConcurrency || 4;
  protected createWorker() {
    return new MandelbrotWorker();
  }
}

export { ViewerS3Pool };
