/**
 * Pure registries for scopes, metrics, features, and job handlers.
 * Copied into the package in phase 67; app still has local copies until then.
 */

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
