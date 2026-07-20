const SENSITIVE_KEY =
  /^(password|passwd|secret|token|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|setup[_-]?token|session|cookie|credential)$/i;

const EMAIL_KEY = /^(email|e-mail|actor_email|user_email|to|from)$/i;

/** Bearer-style product API keys: `<prefix><body>` — redact whole token. */
const API_KEY_TOKEN = /\b[a-z]{1,12}_[A-Za-z0-9_-]{8,}\b/g;

export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "[redacted-email]";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const keep = local.slice(0, 1);
  return `${keep}***@${domain}`;
}

function redactStringValue(key: string, value: string): string {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (EMAIL_KEY.test(key) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return maskEmail(value);
  }
  return value.replace(API_KEY_TOKEN, "[redacted]");
}

/**
 * Deep-redact sensitive keys and email-like values from log meta objects.
 */
export function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return redactValue(meta) as Record<string, unknown>;
}

function redactValue(value: unknown, keyHint = ""): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return redactStringValue(keyHint, value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keyHint));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactValue(v, k);
      }
    }
    return out;
  }
  return value;
}
