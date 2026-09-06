import type { Execution } from "../domain/execution.js";
import type { Job, Lease } from "../domain/job.js";

export interface SchedulerRepository {
  saveJob(job: Job): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  listDueJobs(now: number): Promise<Job[]>;
  updateJob(job: Job): Promise<void>;

  getLease(jobId: string): Promise<Lease | null>;
  saveLease(lease: Lease): Promise<void>;
  deleteLease(jobId: string): Promise<void>;

  getExecutionByRunKey(runKey: string): Promise<Execution | null>;
  saveExecution(execution: Execution): Promise<void>;
  listExecutions(jobId: string): Promise<Execution[]>;
}
