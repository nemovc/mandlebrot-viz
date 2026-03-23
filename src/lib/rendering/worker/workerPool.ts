import type { ColorConfig } from '$lib/stores/viewerState.svelte';
import type { PrecisionMode } from '$lib/utils/precision';

export interface RenderJob {
	id: string;
	cx: string;
	cy: string;
	scale: string;
	tileSize: number;
	maxIter: number;
	precisionMode: PrecisionMode;
	colorConfig: ColorConfig;
	priority: number; // lower = higher priority
}

export interface TileResult {
	id: string;
	imageData: ImageData;
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

	constructor(private size: number = navigator.hardwareConcurrency || 4) {
		for (let i = 0; i < size; i++) {
			const w = new Worker(new URL('./mandelbrot.worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (e) => this.onResult(w, e.data as TileResult);
			this.workers.push(w);
			this.idle.push(w);
		}
	}

	submit(job: RenderJob, callback: JobCallback) {
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
		// Remove from queue if not yet dispatched
		this.queue = this.queue.filter((p) => p.job.id !== id);
	}

	cancelAll() {
		for (const p of this.queue) this.cancelled.add(p.job.id);
		this.queue = [];
	}

	private dispatch() {
		while (this.idle.length > 0 && this.queue.length > 0) {
			const worker = this.idle.pop()!;
			const { job, resolve } = this.queue.shift()!;

			if (this.cancelled.has(job.id)) {
				this.cancelled.delete(job.id);
				this.idle.push(worker);
				continue;
			}

			this.callbacks.set(job.id, resolve);
			worker.postMessage(job);
		}
	}

	private onResult(worker: Worker, result: TileResult) {
		this.idle.push(worker);
		const cb = this.callbacks.get(result.id);
		if (cb && !this.cancelled.has(result.id)) {
			cb(result);
		}
		this.callbacks.delete(result.id);
		this.cancelled.delete(result.id);
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
