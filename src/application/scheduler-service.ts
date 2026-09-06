import { randomUUID } from "node:crypto";
import type { Execution } from "../domain/execution.js";
import type { Job, Lease, RegisterJobInput } from "../domain/job.js";
import type { SchedulerRepository } from "../ports/scheduler-repository.js";

export class SchedulerService {
  constructor(
    private readonly repository: SchedulerRepository,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async registerJob(input: RegisterJobInput): Promise<Job> {
    if (!Number.isSafeInteger(input.intervalMs) || input.intervalMs <= 0) {
      throw new Error("intervalMs must be a positive integer");
    }

    const job: Job = {
      id: randomUUID(),
      name: input.name,
      intervalMs: input.intervalMs,
      nextRunAt: input.firstRunAt,
      maxAttempts: input.maxAttempts ?? 3,
      status: "ACTIVE",
    };

    await this.repository.saveJob(job);
    return job;
  }

  async listDueJobs(): Promise<Job[]> {
    return this.repository.listDueJobs(this.now());
  }

  async tryAcquire(jobId: string, workerId: string, leaseMs: number): Promise<Lease | null> {
    const job = await this.repository.getJob(jobId);
    if (!job || job.status !== "ACTIVE" || job.nextRunAt > this.now()) return null;

    const existing = await this.repository.getLease(jobId);
    if (existing && existing.expiresAt > this.now() && existing.workerId !== workerId) {
      return null;
    }

    const runKey = `${job.id}:${job.nextRunAt}`;
    const completed = await this.repository.getExecutionByRunKey(runKey);
    if (completed?.status === "SUCCEEDED") return null;

    const lease: Lease = {
      jobId,
      workerId,
      expiresAt: this.now() + leaseMs,
      runKey,
    };

    await this.repository.saveLease(lease);
    return lease;
  }

  async startExecution(lease: Lease): Promise<Execution> {
    const current = await this.repository.getLease(lease.jobId);
    if (!current || current.workerId !== lease.workerId || current.runKey !== lease.runKey || current.expiresAt <= this.now()) {
      throw new Error("worker does not own a valid lease");
    }

    const existing = await this.repository.getExecutionByRunKey(lease.runKey);
    if (existing?.status === "SUCCEEDED") return existing;

    const job = await this.repository.getJob(lease.jobId);
    if (!job) throw new Error("job not found");

    const attempt = (existing?.attempt ?? 0) + 1;
    if (attempt > job.maxAttempts) throw new Error("maximum attempts exceeded");

    const execution: Execution = {
      id: existing?.id ?? randomUUID(),
      jobId: lease.jobId,
      runKey: lease.runKey,
      workerId: lease.workerId,
      attempt,
      status: "RUNNING",
      startedAt: this.now(),
    };

    await this.repository.saveExecution(execution);
    return execution;
  }

  async completeExecution(execution: Execution): Promise<Execution> {
    const current = await this.repository.getExecutionByRunKey(execution.runKey);
    if (current?.status === "SUCCEEDED") return current;

    const job = await this.repository.getJob(execution.jobId);
    if (!job) throw new Error("job not found");

    const completed: Execution = {
      ...execution,
      status: "SUCCEEDED",
      finishedAt: this.now(),
      error: undefined,
    };

    await this.repository.saveExecution(completed);
    await this.repository.updateJob({ ...job, nextRunAt: job.nextRunAt + job.intervalMs });
    await this.repository.deleteLease(job.id);
    return completed;
  }

  async failExecution(execution: Execution, error: string): Promise<Execution> {
    const failed: Execution = {
      ...execution,
      status: "FAILED",
      finishedAt: this.now(),
      error,
    };

    await this.repository.saveExecution(failed);
    await this.repository.deleteLease(execution.jobId);
    return failed;
  }
}
