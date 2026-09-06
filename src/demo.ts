import { SchedulerService } from "./application/scheduler-service.js";
import { InMemorySchedulerRepository } from "./infrastructure/in-memory-scheduler-repository.js";

let now = Date.now();
const repository = new InMemorySchedulerRepository();
const scheduler = new SchedulerService(repository, () => now);

const job = await scheduler.registerJob({
  name: "nightly-report",
  intervalMs: 60_000,
  firstRunAt: now,
  maxAttempts: 3,
});

const lease = await scheduler.tryAcquire(job.id, "worker-a", 30_000);
if (!lease) throw new Error("job was not acquired");

const execution = await scheduler.startExecution(lease);
await scheduler.completeExecution(execution);

now += 60_000;
console.log(await scheduler.listDueJobs());
console.log(await repository.listExecutions(job.id));
