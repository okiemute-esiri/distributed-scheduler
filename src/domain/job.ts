export type JobStatus = "ACTIVE" | "PAUSED";

export interface Job {
  id: string;
  name: string;
  intervalMs: number;
  nextRunAt: number;
  maxAttempts: number;
  status: JobStatus;
}

export interface RegisterJobInput {
  name: string;
  intervalMs: number;
  firstRunAt: number;
  maxAttempts?: number;
}

export interface Lease {
  jobId: string;
  workerId: string;
  expiresAt: number;
  runKey: string;
}
