export type ExecutionStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface Execution {
  id: string;
  jobId: string;
  runKey: string;
  workerId: string;
  attempt: number;
  status: ExecutionStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}
