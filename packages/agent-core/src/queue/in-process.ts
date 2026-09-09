import type { JobQueue, JobRecord, JobStatus } from './types';

/**
 * Simple in-memory queue for serverless / single-instance runs.
 * Phase 5 baseline — swap for BullMQ when REDIS_URL is available on a worker host.
 */
export class InProcessQueue<T = unknown> implements JobQueue<T> {
  name = 'in-process';
  private jobs = new Map<string, JobRecord<T>>();

  async enqueue(name: string, data: T): Promise<JobRecord<T>> {
    const now = new Date().toISOString();
    const job: JobRecord<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      data,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async get(id: string): Promise<JobRecord<T> | null> {
    return this.jobs.get(id) ?? null;
  }

  async setStatus(id: string, status: JobStatus, error?: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = status;
    job.error = error;
    job.updatedAt = new Date().toISOString();
  }
}

let shared: InProcessQueue | null = null;

export function getInProcessQueue(): InProcessQueue {
  if (!shared) shared = new InProcessQueue();
  return shared;
}
