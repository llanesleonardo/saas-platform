/**
 * In-memory PlatformDatabaseAdapter for smoke tests and non-SQL consumers.
 */

import { randomUUID } from "node:crypto";
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
import type { PlatformDatabaseAdapter } from "./port";

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return randomUUID();
}

export function createMemoryPlatformAdapter(options?: {
  maxOwnedWorkspacesPerUser?: number;
}): PlatformDatabaseAdapter {
  const maxOwned = options?.maxOwnedWorkspacesPerUser ?? 1;
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const workspaces = new Map<string, WorkspaceRecord>();
  const members = new Map<string, WorkspaceMemberRecord>(); // key workspaceId:userId
  const invites = new Map<string, WorkspaceInviteRecord>();
  const jobs = new Map<string, JobOutboxRecord>();
  const usage = new Map<string, UsageCounterRecord>(); // workspaceId:period
  const apiKeys = new Map<string, ApiKeyRecord>();
  const referrals = new Map<string, ReferralCodeRecord>();
  const redemptions: ReferralRedemptionRecord[] = [];
  const audits: { id: string }[] = [];

  const memberKey = (ws: string, user: string) => `${ws}:${user}`;

  const adapter: PlatformDatabaseAdapter = {
    provider: "memory",

    async ping() {
      return true;
    },

    async countUsers() {
      return users.size;
    },

    async createUser(input: CreateUserInput) {
      const row: UserRecord = {
        id: id(),
        email: input.email.toLowerCase(),
        password_hash: input.password_hash,
        role: input.role ?? "admin",
        idp_subject: input.idp_subject ?? null,
        created_at: nowIso(),
      };
      users.set(row.id, row);
      return { id: row.id };
    },

    async getUserByEmail(email: string) {
      const e = email.toLowerCase();
      for (const u of users.values()) if (u.email === e) return u;
      return null;
    },

    async getUserById(userId: string) {
      return users.get(userId) ?? null;
    },

    async getUserByIdpSubject(subject: string) {
      for (const u of users.values()) if (u.idp_subject === subject) return u;
      return null;
    },

    async resolveOrCreateIdpUser(email: string, subject: string) {
      const existing = await adapter.getUserByIdpSubject(subject);
      if (existing) return existing;
      const byEmail = await adapter.getUserByEmail(email);
      if (byEmail) {
        const updated = { ...byEmail, idp_subject: subject };
        users.set(byEmail.id, updated);
        return updated;
      }
      const created = await adapter.createUser({
        email,
        password_hash: "",
        idp_subject: subject,
      });
      return (await adapter.getUserById(created.id))!;
    },

    async updateUserPassword(userId: string, passwordHash: string) {
      const u = users.get(userId);
      if (!u) return;
      users.set(userId, { ...u, password_hash: passwordHash });
    },

    async createSession(input: CreateSessionInput) {
      const row: SessionRecord = {
        id: id(),
        user_id: input.user_id,
        expires_at: input.expires_at,
        created_at: nowIso(),
        user_agent: input.user_agent ?? null,
        ip: input.ip ?? null,
        last_seen_at: nowIso(),
      };
      sessions.set(row.id, row);
      return { id: row.id };
    },

    async getSessionById(sessionId: string) {
      return sessions.get(sessionId) ?? null;
    },

    async deleteSession(sessionId: string) {
      sessions.delete(sessionId);
    },

    async deleteSessionsForUser(userId: string) {
      for (const [sid, s] of sessions) if (s.user_id === userId) sessions.delete(sid);
    },

    async listSessionsForUser(userId: string) {
      return [...sessions.values()].filter((s) => s.user_id === userId);
    },

    async touchSession(sessionId: string) {
      const s = sessions.get(sessionId);
      if (s) sessions.set(sessionId, { ...s, last_seen_at: nowIso() });
    },

    async deleteUser(userId: string) {
      users.delete(userId);
      await adapter.deleteSessionsForUser(userId);
    },

    async createAuditEvent(_input: CreateAuditEventInput) {
      const aid = id();
      audits.push({ id: aid });
      return { id: aid };
    },

    async enqueueJob(input: EnqueueJobInput) {
      const row: JobOutboxRecord = {
        id: id(),
        type: input.type,
        payload: input.payload,
        status: "pending",
        attempts: 0,
        available_at: input.available_at ?? nowIso(),
        last_error: null,
        created_at: nowIso(),
        workspace_id: input.workspace_id ?? null,
        resource_type: input.resource_type ?? null,
        resource_id: input.resource_id ?? null,
      };
      jobs.set(row.id, row);
      return { id: row.id };
    },

    async claimPendingJobs(limit: number) {
      const now = nowIso();
      const pending = [...jobs.values()]
        .filter((j) => j.status === "pending" && j.available_at <= now)
        .slice(0, limit);
      const claimed: JobOutboxRecord[] = [];
      for (const j of pending) {
        const next = { ...j, status: "processing" as const, attempts: j.attempts + 1 };
        jobs.set(j.id, next);
        claimed.push(next);
      }
      return claimed;
    },

    async completeJob(jobId: string) {
      const j = jobs.get(jobId);
      if (j) jobs.set(jobId, { ...j, status: "done", last_error: null });
    },

    async failJob(jobId: string, error: string, retryAtIso: string | null) {
      const j = jobs.get(jobId);
      if (!j) return;
      if (retryAtIso) {
        jobs.set(jobId, {
          ...j,
          status: "pending",
          last_error: error,
          available_at: retryAtIso,
        });
      } else {
        jobs.set(jobId, { ...j, status: "failed", last_error: error });
      }
    },

    async listJobs(options) {
      let rows = [...jobs.values()];
      if (options?.status) rows = rows.filter((j) => j.status === options.status);
      if (options?.workspaceId)
        rows = rows.filter((j) => j.workspace_id === options.workspaceId);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return rows.slice(0, options?.limit ?? 50);
    },

    async getJobById(jobId: string, workspaceId?: string | null) {
      const j = jobs.get(jobId);
      if (!j) return null;
      if (workspaceId && j.workspace_id !== workspaceId) return null;
      return j;
    },

    async retryJob(jobId: string, workspaceId?: string | null) {
      const j = await adapter.getJobById(jobId, workspaceId);
      if (!j) return false;
      jobs.set(jobId, {
        ...j,
        status: "pending",
        available_at: nowIso(),
        last_error: null,
      });
      return true;
    },

    async createWorkspace(input: CreateWorkspaceInput) {
      const row: WorkspaceRecord = {
        id: id(),
        name: input.name,
        slug: input.slug,
        plan: "free",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: null,
        created_at: nowIso(),
      };
      workspaces.set(row.id, row);
      await adapter.addWorkspaceMember(row.id, input.owner_user_id, "owner");
      return { id: row.id };
    },

    async createOwnedWorkspaceIfAllowed(input: CreateWorkspaceInput) {
      const owned = [...members.values()].filter(
        (m) => m.user_id === input.owner_user_id && m.role === "owner",
      ).length;
      if (owned >= maxOwned) {
        throw new Error("OWNED_WORKSPACE_CAP");
      }
      return adapter.createWorkspace(input);
    },

    async acceptWorkspaceInvite(input: AcceptWorkspaceInviteInput) {
      const invite = await adapter.getWorkspaceInviteByToken(input.token);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      const seats = await adapter.countWorkspaceMembers(invite.workspace_id);
      if (seats >= input.max_seats) throw new Error("SEAT_LIMIT");
      await adapter.addWorkspaceMember(invite.workspace_id, input.user_id, invite.role);
      invites.delete(invite.id);
      return { workspaceId: invite.workspace_id };
    },

    async getWorkspaceById(workspaceId: string) {
      return workspaces.get(workspaceId) ?? null;
    },

    async getWorkspaceBySlug(slug: string) {
      for (const w of workspaces.values()) if (w.slug === slug) return w;
      return null;
    },

    async listWorkspacesForUser(userId: string) {
      const ids = [...members.values()]
        .filter((m) => m.user_id === userId)
        .map((m) => m.workspace_id);
      return ids.map((i) => workspaces.get(i)!).filter(Boolean);
    },

    async updateWorkspaceBilling(workspaceId: string, input: UpdateWorkspaceBillingInput) {
      const w = workspaces.get(workspaceId);
      if (!w) return;
      workspaces.set(workspaceId, {
        ...w,
        plan: input.plan ?? w.plan,
        stripe_customer_id:
          input.stripe_customer_id !== undefined
            ? input.stripe_customer_id
            : w.stripe_customer_id,
        stripe_subscription_id:
          input.stripe_subscription_id !== undefined
            ? input.stripe_subscription_id
            : w.stripe_subscription_id,
        subscription_status:
          input.subscription_status !== undefined
            ? input.subscription_status
            : w.subscription_status,
      });
    },

    async getWorkspaceMembership(workspaceId: string, userId: string) {
      return members.get(memberKey(workspaceId, userId)) ?? null;
    },

    async addWorkspaceMember(workspaceId: string, userId: string, role: WorkspaceRole) {
      members.set(memberKey(workspaceId, userId), {
        workspace_id: workspaceId,
        user_id: userId,
        role,
        created_at: nowIso(),
      });
    },

    async countWorkspaceMembers(workspaceId: string) {
      return [...members.values()].filter((m) => m.workspace_id === workspaceId).length;
    },

    async createWorkspaceInvite(input: CreateWorkspaceInviteInput) {
      const row: WorkspaceInviteRecord = {
        id: id(),
        workspace_id: input.workspace_id,
        email: input.email.toLowerCase(),
        role: input.role,
        token: input.token,
        expires_at: input.expires_at,
        created_at: nowIso(),
      };
      invites.set(row.id, row);
      return { id: row.id };
    },

    async getWorkspaceInviteByToken(token: string) {
      for (const i of invites.values()) if (i.token === token) return i;
      return null;
    },

    async deleteWorkspaceInvite(inviteId: string, workspaceId?: string | null) {
      const i = invites.get(inviteId);
      if (!i) return false;
      if (workspaceId && i.workspace_id !== workspaceId) return false;
      invites.delete(inviteId);
      return true;
    },

    async listWorkspaceInvites(workspaceId: string) {
      return [...invites.values()].filter((i) => i.workspace_id === workspaceId);
    },

    async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
      const w = workspaces.get(workspaceId);
      if (!w) return;
      workspaces.set(workspaceId, {
        ...w,
        name: input.name ?? w.name,
        slug: input.slug ?? w.slug,
      });
    },

    async listWorkspaceMembers(workspaceId: string) {
      const rows: WorkspaceMemberWithEmail[] = [];
      for (const m of members.values()) {
        if (m.workspace_id !== workspaceId) continue;
        const u = users.get(m.user_id);
        rows.push({ ...m, email: u?.email ?? "" });
      }
      return rows;
    },

    async updateWorkspaceMemberRole(
      workspaceId: string,
      userId: string,
      role: WorkspaceRole,
    ) {
      const m = members.get(memberKey(workspaceId, userId));
      if (m) members.set(memberKey(workspaceId, userId), { ...m, role });
    },

    async removeWorkspaceMember(workspaceId: string, userId: string) {
      members.delete(memberKey(workspaceId, userId));
    },

    async countWorkspaceOwners(workspaceId: string) {
      return [...members.values()].filter(
        (m) => m.workspace_id === workspaceId && m.role === "owner",
      ).length;
    },

    async deleteWorkspace(workspaceId: string) {
      workspaces.delete(workspaceId);
      for (const [k, m] of members) if (m.workspace_id === workspaceId) members.delete(k);
      for (const [k, i] of invites) if (i.workspace_id === workspaceId) invites.delete(k);
    },

    async incrementUsage(workspaceId: string, period: string, field: string, by = 1) {
      const key = `${workspaceId}:${period}`;
      const cur =
        usage.get(key) ??
        ({
          workspace_id: workspaceId,
          period,
          metrics: {},
        } satisfies UsageCounterRecord);
      const prev = cur.metrics ?? {};
      const metrics = { ...prev, [field]: (prev[field] ?? 0) + by };
      usage.set(key, { ...cur, metrics });
    },

    async getUsage(workspaceId: string, period: string) {
      return usage.get(`${workspaceId}:${period}`) ?? null;
    },

    async createApiKey(input: CreateApiKeyInput) {
      const row: ApiKeyRecord = {
        id: id(),
        workspace_id: input.workspace_id,
        name: input.name,
        prefix: input.prefix,
        key_hash: input.key_hash,
        scopes: input.scopes,
        created_at: nowIso(),
        last_used_at: null,
        revoked_at: null,
      };
      apiKeys.set(row.id, row);
      return { id: row.id };
    },

    async listApiKeysForWorkspace(workspaceId: string) {
      return [...apiKeys.values()].filter((k) => k.workspace_id === workspaceId);
    },

    async listApiKeysByPrefix(prefix: string) {
      return [...apiKeys.values()].filter((k) => k.prefix === prefix);
    },

    async getApiKeyById(keyId: string) {
      return apiKeys.get(keyId) ?? null;
    },

    async revokeApiKey(keyId: string) {
      const k = apiKeys.get(keyId);
      if (k) apiKeys.set(keyId, { ...k, revoked_at: nowIso() });
    },

    async touchApiKeyLastUsed(keyId: string) {
      const k = apiKeys.get(keyId);
      if (k) apiKeys.set(keyId, { ...k, last_used_at: nowIso() });
    },

    async getReferralCodeByWorkspace(workspaceId: string) {
      for (const r of referrals.values()) if (r.workspace_id === workspaceId) return r;
      return null;
    },

    async getReferralCodeByCode(code: string) {
      for (const r of referrals.values()) if (r.code === code) return r;
      return null;
    },

    async createReferralCode(input: CreateReferralCodeInput) {
      const row: ReferralCodeRecord = {
        id: id(),
        workspace_id: input.workspace_id,
        code: input.code,
        created_at: nowIso(),
        deactivated_at: null,
      };
      referrals.set(row.id, row);
      return { id: row.id };
    },

    async createReferralRedemption(input: CreateReferralRedemptionInput) {
      const row: ReferralRedemptionRecord = {
        id: id(),
        code: input.code,
        referrer_workspace_id: input.referrer_workspace_id,
        referee_workspace_id: input.referee_workspace_id,
        referee_user_id: input.referee_user_id ?? null,
        stripe_checkout_session_id: input.stripe_checkout_session_id ?? null,
        reward_granted: false,
        created_at: nowIso(),
      };
      redemptions.push(row);
      return { id: row.id };
    },

    async listReferralRedemptionsForReferrer(workspaceId: string) {
      return redemptions.filter((r) => r.referrer_workspace_id === workspaceId);
    },

    async countReferralRedemptionsForReferee(workspaceId: string) {
      return redemptions.filter((r) => r.referee_workspace_id === workspaceId).length;
    },

    async markReferralRewardGranted(redemptionId: string) {
      const i = redemptions.findIndex((r) => r.id === redemptionId);
      if (i >= 0) redemptions[i] = { ...redemptions[i], reward_granted: true };
    },
  };

  return adapter;
}
