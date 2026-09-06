# Distributed Scheduler

A backend engineering project demonstrating the core coordination mechanics behind a distributed job scheduler.

## Status

This repository contains a working TypeScript implementation of scheduler coordination primitives using an in-memory persistence adapter. The current version focuses on leases, ownership, idempotent execution, retries and recovery semantics. Durable database-backed coordination is the next milestone.

## Core Concepts

- jobs have a schedule, next-run timestamp and execution policy
- workers compete for time-bounded leases
- only the lease owner may execute a claimed job
- expired leases can be recovered by another worker
- execution records are idempotent per job/run key
- failed executions can be retried with bounded attempts
- successful runs advance the next scheduled execution

## Architecture

```text
Scheduler Worker
   |
   v
SchedulerService
   |---- JobRepository
   |---- LeaseRepository
   `---- ExecutionRepository
             |
             v
      In-memory adapters

Planned production adapters:
PostgreSQL / Redis / message broker
```

## Implemented

- strict TypeScript domain model
- job registration
- lease acquisition and expiry
- worker ownership checks
- idempotent run keys
- bounded retry policy
- execution history
- recovery of expired work
- deterministic clock injection for testing
- unit tests for coordination behaviour
- Docker packaging
- GitHub Actions CI

## Repository Structure

```text
src/
├── domain/
│   ├── job.ts
│   └── execution.ts
├── ports/
│   └── scheduler-repository.ts
├── infrastructure/
│   └── in-memory-scheduler-repository.ts
├── application/
│   └── scheduler-service.ts
└── demo.ts

tests/
└── scheduler.test.ts
```

## Run

```bash
npm install
npm test
npm run typecheck
npm run build
npm run demo
```

## Reliability Semantics

The implementation uses time-bounded leases instead of permanent ownership. If a worker disappears, another worker may acquire the job after the lease expires. A run key prevents the same scheduled occurrence from being completed twice by cooperating workers using the same backing repository.

This project does not claim exactly-once execution across arbitrary infrastructure failures. In production, side effects should still be idempotent because distributed systems generally provide at-least-once delivery or execution semantics.

## Production Evolution

Planned extensions include PostgreSQL advisory/row locking, Redis leases, transactional outbox, queue-based dispatch, cron parsing, jitter/backoff, dead-letter handling, leader election, metrics, tracing, sharding and multi-region coordination.

## Portfolio Focus

This repository demonstrates distributed-systems reasoning: ownership, leases, race avoidance, recovery, idempotency and failure handling rather than merely implementing a local timer loop.
