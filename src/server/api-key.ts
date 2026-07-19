/**
 * API key scope helpers (product registers scopes; branding via PlatformConfig).
 */

import { getPlatformConfig } from "../config";
import { isRegisteredApiKeyScope } from "../core";
import type { ApiKeyScope } from "../contracts";

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return isRegisteredApiKeyScope(value);
}

export function normalizeScopes(raw: unknown): ApiKeyScope[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is ApiKeyScope => typeof s === "string" && isApiKeyScope(s));
}

export function requireExplicitScopes(raw: unknown): ApiKeyScope[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("SCOPES_REQUIRED");
  }
  const unknown = raw.filter((s) => typeof s !== "string" || !isApiKeyScope(s));
  if (unknown.length > 0) {
    throw new Error(`SCOPES_INVALID:${unknown.map(String).join(",")}`);
  }
  return raw as ApiKeyScope[];
}

/** Build plaintext API key using configured prefix (not hard-coded to a product). */
export function formatApiKeySecret(secretBody: string): string {
  const { apiKeyPrefix } = getPlatformConfig();
  return `${apiKeyPrefix}${secretBody}`;
}

export function apiKeyPrefixFromPlaintext(plaintext: string, length = 10): string {
  return plaintext.slice(0, length);
}
