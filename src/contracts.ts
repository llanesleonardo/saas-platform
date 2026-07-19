/** Browser-safe contract types (no Node/Next imports). */

export type PlatformJobStatus = "pending" | "processing" | "done" | "failed";

export interface PlatformUsageSnapshot {
  workspace_id: string;
  period: string;
  metrics: Record<string, number>;
}
