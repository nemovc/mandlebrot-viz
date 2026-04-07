import { WorkerPool } from "../workerPool";
import type { JuliaJob, JuliaResult } from "../jobs";
import JuliaWorker from "../julia.worker.ts?worker";

class InspectorPool extends WorkerPool<JuliaJob, JuliaResult> {
  private static _instance: InspectorPool | null = null;
  static get instance(): InspectorPool {
    return (this._instance ??= new InspectorPool());
  }
  static get hasInstance(): boolean {
    return this._instance !== null;
  }

  protected readonly workerCount = 2;
  protected createWorker() {
    return new JuliaWorker();
  }
}

export { InspectorPool };
