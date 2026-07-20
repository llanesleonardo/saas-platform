import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

/** True when SECRETS_ENCRYPTION_KEY is set and valid (32-byte base64). */
export function hasEncryptionKey(): boolean {
  return getEncryptionKey() !== null;
}

export function getEncryptionKey(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64");
    if (key.length !== KEY_LEN) return null;
    return key;
  } catch {
    return null;
  }
}

export function isEncryptedSecret(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function mustEncryptAtRest(): boolean {
  const mode = (process.env.DEPLOYMENT_MODE ?? "").trim().toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    process.env.DEPLOYMENT_ASSERT === "strict" ||
    mode === "saas"
  );
}

/**
 * Encrypt a secret string. Fail-closed in saas/production/strict when key missing.
 * Plaintext fallback only for local self-hosted dogfood.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncryptedSecret(plaintext)) return plaintext;
  const key = getEncryptionKey();
  if (!key) {
    if (mustEncryptAtRest()) {
      throw new Error(
        "SECRETS_ENCRYPTION_KEY is required to store secrets (saas/production/strict)",
      );
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/** Decrypt an encrypted value, or return plaintext if not encrypted / no key. */
export function decryptSecret(stored: string): string {
  if (!stored || !isEncryptedSecret(stored)) return stored;
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Encrypted secret present but SECRETS_ENCRYPTION_KEY is missing or invalid");
  }

  const body = stored.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = body.split(":");
  if (!ivB64 || !dataB64 || !tagB64) {
    throw new Error("Malformed encrypted secret");
  }

  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isSensitiveConfigKey(key: string): boolean {
  return /key|token|secret|password/i.test(key);
}

/** Generate a random 32-byte key as base64 (for docs / setup helpers). */
export function generateEncryptionKeyBase64(): string {
  return randomBytes(KEY_LEN).toString("base64");
}
