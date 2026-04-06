import type { BaseJob, BaseResult } from "./jobs";

interface PendingJob<TJob, TResult> {
  job: TJob;
  resolve: (result: TResult) => void;
  transferables: Transferable[];
}

export abstract class WorkerPool<
  TJob extends BaseJob,
  TResult extends BaseResult,
> {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: PendingJob<TJob, TResult>[] = [];
  private callbacks = new Map<string, (r: TResult) => void>();
  private cancelled = new Set<string>();
  private workerJobs = new Map<Worker, string>();

  private _pending = 0;
  private _batchTotal = 0;
  private _batchCompleted = 0;
  readonly onProgress: Array<(completed: number, total: number) => void> = [];

  protected abstract readonly workerCount: number;
  protected abstract createWorker(): Worker;

  get pending() {
    return this._pending;
  }
  get batchTotal() {
    return this._batchTotal;
  }
  get batchCompleted() {
    return this._batchCompleted;
  }

  private dispatchOnProgress() {
    for (const fn of this.onProgress) fn(this._batchCompleted, this._batchTotal);
  }

  get debugState() {
    this.ensureInit();
    return {
      poolSize: this.workers.length,
      idle: this.idle.length,
      active: this.workerJobs.size,
      queued: this.queue.length,
    };
  }

  /** Workers are created on first use to avoid instantiating during module load. */
  private ensureInit() {
    if (this.workers.length > 0) return;
    for (let i = 0; i < this.workerCount; i++) {
      const w = this.createWorker();
      w.onmessage = (e) => this.onResult(w, e.data as TResult);
      w.onerror = (e) => this.onWorkerError(w, e.message);
      w.onmessageerror = () =>
        this.onWorkerError(w, "message deserialization error");
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  submit(
    job: TJob,
    callback: (r: TResult) => void,
    transferables: Transferable[] = [],
  ) {
    this.ensureInit();
    if (this._pending === 0) {
      this._batchTotal = 0;
      this._batchCompleted = 0;
    }
    this._pending++;
    this._batchTotal++;
    this.dispatchOnProgress();

    const pending: PendingJob<TJob, TResult> = {
      job,
      resolve: callback,
      transferables,
    };
    const idx = this.queue.findIndex((p) => p.job.priority > job.priority);
    if (idx === -1) {
      this.queue.push(pending);
    } else {
      this.queue.splice(idx, 0, pending);
    }
    this.dispatch();
  }

  cancel(id: string) {
    this.cancelled.add(id);
    const wasQueued = this.queue.some((p) => p.job.id === id);
    this.queue = this.queue.filter((p) => p.job.id !== id);
    if (wasQueued) {
      this._pending--;
      this._batchCompleted++;
      this.dispatchOnProgress();
    }
  }

  cancelAll() {
    for (const p of this.queue) {
      this.cancelled.add(p.job.id);
      this._pending--;
      this._batchCompleted++;
      this.dispatchOnProgress();
    }
    this.queue = [];
  }

  private dispatch() {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const { job, resolve, transferables } = this.queue.shift()!;

      if (this.cancelled.has(job.id)) {
        this.cancelled.delete(job.id);
        this._pending--;
        this._batchCompleted++;
        this.dispatchOnProgress();
        this.idle.push(worker);
        continue;
      }

      this.callbacks.set(job.id, resolve);
      this.workerJobs.set(worker, job.id);
      worker.postMessage(job, { transfer: transferables });
    }
  }

  private onWorkerError(worker: Worker, message: string) {
    console.error("[WorkerPool] worker error:", message);
    const jobId = this.workerJobs.get(worker);
    this.workerJobs.delete(worker);
    if (jobId) {
      this.callbacks.delete(jobId);
      this.cancelled.delete(jobId);
      this._pending--;
      this._batchCompleted++;
      this.dispatchOnProgress();
    }
    this.idle.push(worker);
    this.dispatch();
  }

  private onResult(worker: Worker, result: TResult) {
    this.workerJobs.delete(worker);
    this.idle.push(worker);
    const cb = this.callbacks.get(result.id);
    if (cb && !this.cancelled.has(result.id)) {
      cb(result);
    }
    this.callbacks.delete(result.id);
    this.cancelled.delete(result.id);
    this._pending--;
    this._batchCompleted++;
    this.dispatchOnProgress();
    this.dispatch();
  }

  destroy() {
    for (const w of this.workers) w.terminate();
  }
}
