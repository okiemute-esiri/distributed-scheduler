import { describe, expect, it } from "vitest";
import { SchedulerService } from "../src/application/scheduler-service.js";
import { InMemorySchedulerRepository } from "../src/infrastructure/in-memory-scheduler-repository.js";

function harness(start = 1_000) {
  let now = start;
  const repository = new InMemorySchedulerRepository();
  const scheduler = new SchedulerService(repository, () => now);
  return {
    repository,
    scheduler,
    setNow(value: number) {
      now = value;
    },
  };
}

describe("distributed scheduler coordination", () => {
  it("allows only one worker to own an unexpired lease", async () => {
    const { scheduler } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });

    const first = await scheduler.tryAcquire(job.id, "worker-a", 500);
    const second = await scheduler.tryAcquire(job.id, "worker-b", 500);

    expect(first?.workerId).toBe("worker-a");
    expect(second).toBeNull();
  });

  it("grants at most one lease when workers contend concurrently", async () => {
    const { scheduler } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });

    const leases = await Promise.all([
      scheduler.tryAcquire(job.id, "worker-a", 500),
      scheduler.tryAcquire(job.id, "worker-b", 500),
      scheduler.tryAcquire(job.id, "worker-c", 500),
    ]);

    expect(leases.filter((lease) => lease !== null)).toHaveLength(1);
  });

  it("rejects invalid lease durations", async () => {
    const { scheduler } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });

    await expect(scheduler.tryAcquire(job.id, "worker-a", 0)).rejects.toThrow("leaseMs must be a positive integer");
  });

  it("recovers a job after a lease expires", async () => {
    const { scheduler, setNow } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });

    await scheduler.tryAcquire(job.id, "worker-a", 100);
    setNow(1101);

    const recovered = await scheduler.tryAcquire(job.id, "worker-b", 100);
    expect(recovered?.workerId).toBe("worker-b");
  });

  it("advances the schedule after successful execution", async () => {
    const { scheduler, repository } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });
    const lease = await scheduler.tryAcquire(job.id, "worker-a", 500);
    expect(lease).not.toBeNull();

    const running = await scheduler.startExecution(lease!);
    const completed = await scheduler.completeExecution(running);
    const persisted = await repository.getJob(job.id);

    expect(completed.status).toBe("SUCCEEDED");
    expect(persisted?.nextRunAt).toBe(2000);
  });

  it("retries a failed scheduled occurrence with an incremented attempt", async () => {
    const { scheduler } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000, maxAttempts: 3 });

    const lease1 = await scheduler.tryAcquire(job.id, "worker-a", 500);
    const run1 = await scheduler.startExecution(lease1!);
    await scheduler.failExecution(run1, "temporary failure");

    const lease2 = await scheduler.tryAcquire(job.id, "worker-b", 500);
    const run2 = await scheduler.startExecution(lease2!);

    expect(run1.attempt).toBe(1);
    expect(run2.attempt).toBe(2);
    expect(run2.runKey).toBe(run1.runKey);
  });

  it("does not reacquire an already completed occurrence", async () => {
    const { scheduler } = harness();
    const job = await scheduler.registerJob({ name: "job", intervalMs: 1000, firstRunAt: 1000 });

    const lease = await scheduler.tryAcquire(job.id, "worker-a", 500);
    const run = await scheduler.startExecution(lease!);
    await scheduler.completeExecution(run);

    const duplicate = await scheduler.tryAcquire(job.id, "worker-b", 500);
    expect(duplicate).toBeNull();
  });
});
