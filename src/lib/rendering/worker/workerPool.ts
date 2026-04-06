import type { ColorConfig } from "$lib/utils/colorPalettes";
import type { PrecisionMode } from "$lib/utils/precision";
import MandelbrotWorker from "./mandelbrot.worker.ts?worker";
import RecolorWorker from "./recolor.worker.ts?worker";

export interface RenderJob {
  id: string;
  cx: string;
  cy: string;
  scale: string;
  tileSize: number;
  tileW?: number; // override width (defaults to tileSize)
  tileH?: number; // override height (defaults to tileSize)
  maxIter: number;
  power: number;
  precisionMode: PrecisionMode;
  colorConfig: ColorConfig;
  priority: number; // lower = higher priority
  stage: 2 | 3; // which rendering pass this belongs to
  // For color-only redraws: skip WASM and recolorize from provided iters
  recolorOnly?: true;
  iters?: Float32Array;
  cdf?: Float32Array;
  debug?: boolean;
  slow?: boolean;
}

export interface TileResult {
  id: string;
  imageData: ImageData;
  iters?: Float32Array; // absent for recolor-only jobs
}

type JobCallback = (result: TileResult) => void;

interface PendingJob {
  job: RenderJob;
  resolve: JobCallback;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: PendingJob[] = [];
  private callbacks = new Map<string, JobCallback>();
  private cancelled = new Set<string>();
  private workerJobs = new Map<Worker, string>(); // worker → currently-running job id

  // Per-stage progress tracking — each stage resets independently when it goes idle→busy
  private pending: Record<2 | 3, number> = { 2: 0, 3: 0 };
  private batchTotal: Record<2 | 3, number> = { 2: 0, 3: 0 };
  private batchCompleted: Record<2 | 3, number> = { 2: 0, 3: 0 };
  private jobStages = new Map<string, 2 | 3>(); // id → stage, for lookup in onResult/cancel
  onProgress?: (stage: 2 | 3, completed: number, total: number) => void;

  /** Number of stage-3 jobs currently submitted but not yet complete (queued + in-flight). */
  get s3Pending(): number {
    return this.pending[3];
  }

  get debugState() {
    let activeS2 = 0,
      activeS3 = 0;
    for (const [worker, jobId] of this.workerJobs) {
      if (this.jobStages.get(jobId) === 2) activeS2++;
      else activeS3++;
    }
    return {
      poolSize: this.size,
      idle: this.idle.length,
      activeS2,
      activeS3,
      queued: this.queue.length,
    };
  }

  constructor(
    private size: number = navigator.hardwareConcurrency || 4,
    private WorkerConstructor: new () => Worker = MandelbrotWorker,
  ) {
    for (let i = 0; i < size; i++) {
      const w = new this.WorkerConstructor();
      w.onmessage = (e) => this.onResult(w, e.data as TileResult);
      w.onerror = (e) => this.onWorkerError(w, e.message);
      w.onmessageerror = () =>
        this.onWorkerError(w, "message deserialization error");
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  submit(job: RenderJob, callback: JobCallback) {
    const s = job.stage;
    if (this.pending[s] === 0) {
      // Starting a new batch for this stage from idle — reset its counters
      this.batchTotal[s] = 0;
      this.batchCompleted[s] = 0;
    }
    this.pending[s]++;
    this.batchTotal[s]++;
    this.jobStages.set(job.id, s);
    this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);

    // Insert in priority order (stable sort by priority)
    const pending: PendingJob = { job, resolve: callback };
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
    // Remove from queue if not yet dispatched
    this.queue = this.queue.filter((p) => p.job.id !== id);
    if (wasQueued) {
      // Job never ran — count it as done now; dispatched cancels are handled in onResult
      const s = this.jobStages.get(id)!;
      this.jobStages.delete(id);
      this.pending[s]--;
      this.batchCompleted[s]++;
      this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);
    }
  }

  cancelAll() {
    for (const p of this.queue) {
      this.cancelled.add(p.job.id);
      const s = this.jobStages.get(p.job.id)!;
      this.jobStages.delete(p.job.id);
      this.pending[s]--;
      this.batchCompleted[s]++;
      this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);
    }
    this.queue = [];
  }

  private dispatch() {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const { job, resolve } = this.queue.shift()!;

      if (this.cancelled.has(job.id)) {
        this.cancelled.delete(job.id);
        const s = this.jobStages.get(job.id) ?? 3;
        this.jobStages.delete(job.id);
        this.pending[s]--;
        this.batchCompleted[s]++;
        this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);
        this.idle.push(worker);
        continue;
      }

      this.callbacks.set(job.id, resolve);
      this.workerJobs.set(worker, job.id);
      const transfer = job.iters ? [job.iters.buffer] : [];
      worker.postMessage(job, { transfer });
    }
  }

  private onWorkerError(worker: Worker, message: string) {
    console.error("[WorkerPool] worker error:", message);
    const jobId = this.workerJobs.get(worker);
    this.workerJobs.delete(worker);
    if (jobId) {
      this.callbacks.delete(jobId);
      this.cancelled.delete(jobId);
      const s = this.jobStages.get(jobId) ?? 3;
      this.jobStages.delete(jobId);
      this.pending[s]--;
      this.batchCompleted[s]++;
      this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);
    }
    this.idle.push(worker);
    this.dispatch();
  }

  private onResult(worker: Worker, result: TileResult) {
    this.workerJobs.delete(worker);
    this.idle.push(worker);
    const cb = this.callbacks.get(result.id);
    if (cb && !this.cancelled.has(result.id)) {
      cb(result);
    }
    this.callbacks.delete(result.id);
    this.cancelled.delete(result.id);
    const s = this.jobStages.get(result.id) ?? 3;
    this.jobStages.delete(result.id);
    this.pending[s]--;
    this.batchCompleted[s]++;
    this.onProgress?.(s, this.batchCompleted[s], this.batchTotal[s]);
    this.dispatch();
  }

  destroy() {
    for (const w of this.workers) w.terminate();
  }
}

// Singleton instance
let pool: WorkerPool | null = null;
export function getWorkerPool(): WorkerPool {
  if (!pool) pool = new WorkerPool();
  return pool;
}

// Small dedicated pool for recolor-only jobs — keeps them off the WASM pool
let recolorPool: WorkerPool | null = null;
export function getRecolorPool(): WorkerPool {
  if (!recolorPool)
    recolorPool = new WorkerPool(
      Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
      RecolorWorker,
    );
  return recolorPool;
}

// Dedicated WASM pool for the frame cache. Isolated so background cache builds
// don't compete with foreground preview rendering or WebM export.
let frameCachePool: WorkerPool | null = null;
export function getFrameCachePool(): WorkerPool {
  if (!frameCachePool) frameCachePool = new WorkerPool();
  return frameCachePool;
}
