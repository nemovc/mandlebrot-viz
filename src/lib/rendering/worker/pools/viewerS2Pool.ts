import { WorkerPool } from "../workerPool";
import type { ComputeJob, ComputeResult } from "../jobs";
import MandelbrotWorker from "../mandelbrot.worker.ts?worker";

class ViewerS2Pool extends WorkerPool<ComputeJob, ComputeResult> {
  private static _instance: ViewerS2Pool | null = null;
  static get instance(): ViewerS2Pool {
    return (this._instance ??= new ViewerS2Pool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  // S2 tiles complete very fast — 2 workers is plenty
  protected readonly workerCount = 2;
  protected createWorker() {
    return new MandelbrotWorker();
  }
}

export { ViewerS2Pool };
