/**
 * Browser-safe platform contracts. No Node/Next. No product (form/CRM) types.
 */

export type DatabaseProvider = "supabase" | "postgres" | "mysql" | "sqlite" | "memory";

export type UserRole = "admin" | "editor";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  idp_subject?: string | null;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  user_agent?: string | null;
  ip?: string | null;
  last_seen_at?: string | null;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  role?: UserRole;
  idp_subject?: string | null;
}

export interface CreateSessionInput {
  user_id: string;
  expires_at: string;
  user_agent?: string | null;
  ip?: string | null;
}

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
}

export interface WorkspaceMemberRecord {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceMemberWithEmail extends WorkspaceMemberRecord {
  email: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
}

export interface WorkspaceInviteRecord {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  owner_user_id: string;
}

export interface CreateWorkspaceInviteInput {
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expires_at: string;
}

export interface AcceptWorkspaceInviteInput {
  token: string;
  user_id: string;
  user_email: string;
  max_seats: number;
}

export interface UpdateWorkspaceBillingInput {
  plan?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}

export type ApiKeyScope = string;

export interface ApiKeyRecord {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreateApiKeyInput {
  workspace_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
}

export type JobOutboxStatus = "pending" | "processing" | "done" | "failed";

export interface JobOutboxRecord {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobOutboxStatus;
  attempts: number;
  available_at: string;
  last_error: string | null;
  created_at: string;
  workspace_id: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
}

export interface EnqueueJobInput {
  type: string;
  payload: Record<string, unknown>;
  available_at?: string;
  workspace_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
}

export interface AuditEventRecord {
  id: string;
  action: string;
  actor_email: string | null;
  resource_type: string | null;
  resource_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateAuditEventInput {
  action: string;
  actor_email?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ReferralCodeRecord {
  id: string;
  workspace_id: string;
  code: string;
  created_at: string;
  deactivated_at: string | null;
}

export interface ReferralRedemptionRecord {
  id: string;
  code: string;
  referrer_workspace_id: string;
  referee_workspace_id: string;
  referee_user_id: string | null;
  stripe_checkout_session_id: string | null;
  reward_granted: boolean;
  created_at: string;
}

export interface CreateReferralCodeInput {
  workspace_id: string;
  code: string;
}

export interface CreateReferralRedemptionInput {
  code: string;
  referrer_workspace_id: string;
  referee_workspace_id: string;
  referee_user_id?: string | null;
  stripe_checkout_session_id?: string | null;
}

/**
 * Usage counters. Prefer `metrics` for new code.
 * Optional legacy numeric fields exist for DBs that still store named columns.
 */
export interface UsageCounterRecord {
  workspace_id: string;
  period: string;
  /** Named metric counts (preferred). */
  metrics?: Record<string, number>;
  /** @deprecated Prefer metrics["submissions"] — adapter/SQL compat */
  submissions?: number;
  /** @deprecated Prefer metrics["views"] — adapter/SQL compat */
  views?: number;
}

/** Plan snapshot supplied by the product catalog (not owned by the platform). */
export interface PlanSnapshot {
  id: string;
  /** Feature name → enabled */
  features: Record<string, boolean>;
  /** Quota name → limit (-1 = unlimited) */
  quotas: Record<string, number>;
}

export interface PlatformUsageSnapshot {
  workspace_id: string;
  period: string;
  metrics: Record<string, number>;
}
