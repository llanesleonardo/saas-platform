/**
 * Trusted client IP extraction for rate limiting.
 *
 * By default ignore spoofable X-Forwarded-For; use x-real-ip when set by a
 * known reverse proxy, else "unknown".
 *
 * Set TRUSTED_PROXY=1 to take the first (leftmost) XFF hop as the client IP —
 * only enable when a trusted proxy strips/forges the header.
 */
export function getTrustedClientIp(request: Request): string {
  const trusted =
    process.env.TRUSTED_PROXY === "1" ||
    (process.env.TRUSTED_PROXY ?? "").toLowerCase() === "true";

  if (trusted) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
