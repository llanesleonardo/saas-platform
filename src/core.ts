/**
 * Pure registries + entitlement evaluation.
 * Product catalogs supply PlanSnapshot; platform does not hard-code product features.
 */

import type { PlanSnapshot } from "./contracts";

const scopes = new Set<string>();
const metrics = new Set<string>();
const features = new Set<string>();
const quotas = new Set<string>();

export function registerApiKeyScopes(values: readonly string[]): void {
  for (const v of values) {
    const t = v.trim();
    if (t) scopes.add(t);
  }
}

export function isRegisteredApiKeyScope(value: string): boolean {
  return scopes.has(value);
}

export function registerUsageMetrics(values: readonly string[]): void {
  for (const v of values) {
    const t = v.trim();
    if (t) metrics.add(t);
  }
}

export function isRegisteredUsageMetric(value: string): boolean {
  return metrics.has(value);
}

export function registerFeatures(values: readonly string[]): void {
  for (const v of values) {
    const t = v.trim();
    if (t) features.add(t);
  }
}

export function isRegisteredFeature(value: string): boolean {
  return features.has(value);
}

export function registerQuotas(values: readonly string[]): void {
  for (const v of values) {
    const t = v.trim();
    if (t) quotas.add(t);
  }
}

export function isRegisteredQuota(value: string): boolean {
  return quotas.has(value);
}

export type PlatformJobHandler = (job: {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  workspace_id: string | null;
  attempts: number;
}) => Promise<void>;

const handlers = new Map<string, PlatformJobHandler>();

export function registerJobHandler(type: string, handler: PlatformJobHandler): void {
  const key = type.trim();
  if (!key) throw new Error("Job handler type is required");
  handlers.set(key, handler);
}

export function getJobHandler(type: string): PlatformJobHandler | undefined {
  return handlers.get(type);
}

/** Pure: is feature enabled on this plan snapshot? */
export function evaluateFeature(plan: PlanSnapshot, featureName: string): boolean {
  if (!isRegisteredFeature(featureName) && !(featureName in plan.features)) {
    return false;
  }
  return Boolean(plan.features[featureName]);
}

/**
 * Pure: is usage under quota?
 * @param limit -1 means unlimited
 * @param used current usage count
 */
export function evaluateQuota(limit: number, used: number): boolean {
  if (limit < 0) return true;
  return used < limit;
}

export function getQuotaLimit(plan: PlanSnapshot, quotaName: string): number {
  const v = plan.quotas[quotaName];
  return typeof v === "number" ? v : 0;
}

export function metricFromUsage(
  metricsMap: Record<string, number> | undefined,
  name: string,
  legacy?: { submissions?: number; views?: number },
): number {
  if (metricsMap && typeof metricsMap[name] === "number") return metricsMap[name];
  if (name === "submissions" && typeof legacy?.submissions === "number") {
    return legacy.submissions;
  }
  if (name === "views" && typeof legacy?.views === "number") return legacy.views;
  return 0;
}

/** Entitlement denial codes products may map to AppError details. */
export const ENTITLEMENT_DENIED = "ENTITLEMENT_DENIED";

export function isEntitlementDeniedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; details?: string[] };
  if (e.code === ENTITLEMENT_DENIED) return true;
  if (Array.isArray(e.details)) {
    return e.details.some(
      (d) =>
        d === ENTITLEMENT_DENIED ||
        d.startsWith("PLAN_LIMIT_") ||
        d === "PLAN_LIMIT_FEATURE",
    );
  }
  return false;
}

export class EntitlementError extends Error {
  readonly code = ENTITLEMENT_DENIED;
  readonly details: string[];
  constructor(message: string, details: string[] = [ENTITLEMENT_DENIED]) {
    super(message);
    this.name = "EntitlementError";
    this.details = details;
  }
}
