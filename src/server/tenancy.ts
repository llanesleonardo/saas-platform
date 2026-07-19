/**
 * Framework-agnostic tenancy helpers (no Next cookies).
 */

import type { PlatformDatabaseAdapter } from "../db/port";
import type { WorkspaceRole } from "../contracts";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function slugifyWorkspaceName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "workspace";
}

export function roleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export async function requireWorkspaceMembership(
  db: PlatformDatabaseAdapter,
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = "viewer",
): Promise<WorkspaceRole> {
  const membership = await db.getWorkspaceMembership(workspaceId, userId);
  if (!membership || !roleAtLeast(membership.role, minRole)) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }
  return membership.role;
}

/**
 * Pick active workspace: prefer `preferredId` if member, else first membership.
 */
export async function resolveActiveWorkspaceId(
  db: PlatformDatabaseAdapter,
  userId: string,
  preferredId?: string | null,
): Promise<string | null> {
  if (preferredId) {
    const membership = await db.getWorkspaceMembership(preferredId, userId);
    if (membership) return preferredId;
  }
  const workspaces = await db.listWorkspacesForUser(userId);
  return workspaces[0]?.id ?? null;
}
