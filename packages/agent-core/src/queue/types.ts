export type JobStatus = 'queued' | 'active' | 'completed' | 'failed';

export type AgentRunJob = {
  sessionId: string;
  requestedAt: string;
};

export type JobRecord<T = unknown> = {
  id: string;
  name: string;
  data: T;
  status: JobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export interface JobQueue<T = unknown> {
  name: string;
  enqueue(name: string, data: T): Promise<JobRecord<T>>;
  get(id: string): Promise<JobRecord<T> | null>;
}
