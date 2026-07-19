/**
 * Platform-owned database port. No form/CRM resource methods.
 */

import type {
  AcceptWorkspaceInviteInput,
  ApiKeyRecord,
  CreateApiKeyInput,
  CreateAuditEventInput,
  CreateReferralCodeInput,
  CreateReferralRedemptionInput,
  CreateSessionInput,
  CreateUserInput,
  CreateWorkspaceInput,
  CreateWorkspaceInviteInput,
  DatabaseProvider,
  EnqueueJobInput,
  JobOutboxRecord,
  ReferralCodeRecord,
  ReferralRedemptionRecord,
  SessionRecord,
  UpdateWorkspaceBillingInput,
  UpdateWorkspaceInput,
  UsageCounterRecord,
  UserRecord,
  WorkspaceInviteRecord,
  WorkspaceMemberRecord,
  WorkspaceMemberWithEmail,
  WorkspaceRecord,
  WorkspaceRole,
} from "../contracts";

export interface PlatformDatabaseAdapter {
  readonly provider: DatabaseProvider;
  countUsers(): Promise<number>;
  createUser(input: CreateUserInput): Promise<{ id: string }>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByIdpSubject(subject: string): Promise<UserRecord | null>;
  resolveOrCreateIdpUser(email: string, subject: string): Promise<UserRecord>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  createSession(input: CreateSessionInput): Promise<{ id: string }>;
  getSessionById(id: string): Promise<SessionRecord | null>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  listSessionsForUser(userId: string): Promise<SessionRecord[]>;
  touchSession(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  createAuditEvent(input: CreateAuditEventInput): Promise<{ id: string }>;
  enqueueJob(input: EnqueueJobInput): Promise<{ id: string }>;
  claimPendingJobs(limit: number): Promise<JobOutboxRecord[]>;
  completeJob(id: string): Promise<void>;
  failJob(id: string, error: string, retryAtIso: string | null): Promise<void>;
  listJobs(options?: {
    limit?: number;
    status?: string | null;
    workspaceId?: string | null;
  }): Promise<JobOutboxRecord[]>;
  getJobById(id: string, workspaceId?: string | null): Promise<JobOutboxRecord | null>;
  retryJob(id: string, workspaceId?: string | null): Promise<boolean>;
  ping(): Promise<boolean>;
  createWorkspace(input: CreateWorkspaceInput): Promise<{ id: string }>;
  createOwnedWorkspaceIfAllowed(input: CreateWorkspaceInput): Promise<{ id: string }>;
  acceptWorkspaceInvite(input: AcceptWorkspaceInviteInput): Promise<{ workspaceId: string }>;
  getWorkspaceById(id: string): Promise<WorkspaceRecord | null>;
  getWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]>;
  updateWorkspaceBilling(id: string, input: UpdateWorkspaceBillingInput): Promise<void>;
  getWorkspaceMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberRecord | null>;
  addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void>;
  countWorkspaceMembers(workspaceId: string): Promise<number>;
  createWorkspaceInvite(input: CreateWorkspaceInviteInput): Promise<{ id: string }>;
  getWorkspaceInviteByToken(token: string): Promise<WorkspaceInviteRecord | null>;
  deleteWorkspaceInvite(id: string, workspaceId?: string | null): Promise<boolean>;
  listWorkspaceInvites(workspaceId: string): Promise<WorkspaceInviteRecord[]>;
  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<void>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberWithEmail[]>;
  updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<void>;
  countWorkspaceOwners(workspaceId: string): Promise<number>;
  deleteWorkspace(id: string): Promise<void>;
  incrementUsage(
    workspaceId: string,
    period: string,
    field: string,
    by?: number,
  ): Promise<void>;
  getUsage(workspaceId: string, period: string): Promise<UsageCounterRecord | null>;
  createApiKey(input: CreateApiKeyInput): Promise<{ id: string }>;
  listApiKeysForWorkspace(workspaceId: string): Promise<ApiKeyRecord[]>;
  listApiKeysByPrefix(prefix: string): Promise<ApiKeyRecord[]>;
  getApiKeyById(id: string): Promise<ApiKeyRecord | null>;
  revokeApiKey(id: string): Promise<void>;
  touchApiKeyLastUsed(id: string): Promise<void>;
  getReferralCodeByWorkspace(workspaceId: string): Promise<ReferralCodeRecord | null>;
  getReferralCodeByCode(code: string): Promise<ReferralCodeRecord | null>;
  createReferralCode(input: CreateReferralCodeInput): Promise<{ id: string }>;
  createReferralRedemption(
    input: CreateReferralRedemptionInput,
  ): Promise<{ id: string }>;
  listReferralRedemptionsForReferrer(
    workspaceId: string,
  ): Promise<ReferralRedemptionRecord[]>;
  countReferralRedemptionsForReferee(workspaceId: string): Promise<number>;
  markReferralRewardGranted(id: string): Promise<void>;
}
