/**
 * Generic outbox worker loop. Product registers handlers via core.registerJobHandler.
 */

import type { JobOutboxRecord } from "../contracts";
import type { PlatformDatabaseAdapter } from "../db/port";
import { getJobHandler, isEntitlementDeniedError } from "../core";

const MAX_ATTEMPTS = 8;

function backoffIso(attempts: number): string {
  const delayMs = Math.min(60_000, 500 * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delayMs).toISOString();
}

export type WorkerLogger = {
  info?: (msg: string, meta?: Record<string, unknown>) => void;
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
  error?: (msg: string, meta?: Record<string, unknown>) => void;
};

export async function processJob(
  db: PlatformDatabaseAdapter,
  job: JobOutboxRecord,
  logger?: WorkerLogger,
): Promise<void> {
  try {
    const handler = getJobHandler(job.type);
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    await handler({
      id: job.id,
      type: job.type,
      payload: job.payload,
      workspace_id: job.workspace_id,
      attempts: job.attempts,
    });
    await db.completeJob(job.id);
    logger?.info?.("Job completed", { id: job.id, type: job.type });
  } catch (err) {
    if (isEntitlementDeniedError(err)) {
      const message = err instanceof Error ? err.message : String(err);
      logger?.warn?.("Job skipped: entitlement denied", {
        id: job.id,
        type: job.type,
        error: message,
      });
      await db.completeJob(job.id);
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.("Job failed", { id: job.id, type: job.type, error: message });
    if (job.attempts >= MAX_ATTEMPTS) {
      await db.failJob(job.id, message, null);
      logger?.warn?.("Job permanently failed", { id: job.id, attempts: job.attempts });
    } else {
      await db.failJob(job.id, message, backoffIso(job.attempts));
    }
  }
}

export async function drainOutbox(
  db: PlatformDatabaseAdapter,
  limit = 10,
  logger?: WorkerLogger,
): Promise<number> {
  const jobs = await db.claimPendingJobs(limit);
  for (const job of jobs) {
    await processJob(db, job, logger);
  }
  return jobs.length;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

export async function runWorkerLoop(
  db: PlatformDatabaseAdapter,
  options?: {
    pollMs?: number;
    batchSize?: number;
    signal?: AbortSignal;
    logger?: WorkerLogger;
  },
): Promise<void> {
  const pollMs = options?.pollMs ?? 2000;
  const batchSize = options?.batchSize ?? 10;
  const logger = options?.logger;
  logger?.info?.("Outbox worker started", { pollMs, batchSize });

  while (!options?.signal?.aborted) {
    try {
      const n = await drainOutbox(db, batchSize, logger);
      if (n === 0) {
        await sleep(pollMs, options?.signal);
      }
    } catch (err) {
      logger?.error?.("Worker loop error", {
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(pollMs, options?.signal);
    }
  }

  logger?.info?.("Outbox worker stopped");
}
