import type { Execution } from "../domain/execution.js";
import type { Job, Lease } from "../domain/job.js";
import type { SchedulerRepository } from "../ports/scheduler-repository.js";

export class InMemorySchedulerRepository implements SchedulerRepository {
  private readonly jobs = new Map<string, Job>();
  private readonly leases = new Map<string, Lease>();
  private readonly executions = new Map<string, Execution>();

  async saveJob(job: Job): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job ? structuredClone(job) : null;
  }

  async listDueJobs(now: number): Promise<Job[]> {
    return [...this.jobs.values()]
      .filter((job) => job.status === "ACTIVE" && job.nextRunAt <= now)
      .sort((a, b) => a.nextRunAt - b.nextRunAt)
      .map((job) => structuredClone(job));
  }

  async updateJob(job: Job): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  async getLease(jobId: string): Promise<Lease | null> {
    const lease = this.leases.get(jobId);
    return lease ? structuredClone(lease) : null;
  }

  async saveLease(lease: Lease): Promise<void> {
    this.leases.set(lease.jobId, structuredClone(lease));
  }

  async deleteLease(jobId: string): Promise<void> {
    this.leases.delete(jobId);
  }

  async getExecutionByRunKey(runKey: string): Promise<Execution | null> {
    const execution = this.executions.get(runKey);
    return execution ? structuredClone(execution) : null;
  }

  async saveExecution(execution: Execution): Promise<void> {
    this.executions.set(execution.runKey, structuredClone(execution));
  }

  async listExecutions(jobId: string): Promise<Execution[]> {
    return [...this.executions.values()]
      .filter((execution) => execution.jobId === jobId)
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((execution) => structuredClone(execution));
  }
}
