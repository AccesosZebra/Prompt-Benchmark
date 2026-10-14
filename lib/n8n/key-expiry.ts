/**
 * When an n8n API key expires.
 *
 * n8n's API keys are JWTs, and one created with an expiry carries it in the
 * `exp` claim. The team gives every key 90 days, so a push that starts failing
 * with 401 is usually that, not a wrong key. Reading the date out of the key
 * itself means nothing extra to store or keep in sync. A key that is not a JWT
 * (an older n8n) or has no `exp` just has no known expiry.
 *
 * No imports and no node APIs: the label is used by client components too.
 */

/** ISO date the key expires at, or null when it does not say. */
export function keyExpiresAt(apiKey: string): string | null {
  const payload = apiKey.trim().split(".")[1];
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")))?.exp;
    return typeof exp === "number" ? new Date(exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

/** Days from `now` to the expiry: negative once it has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/** Within this many days the UI warns that the key needs renewing. */
export const RENEW_WARNING_DAYS = 14;

/** Spanish label for the UI, and whether it deserves a warning. */
export function expiryLabel(iso: string, now: Date = new Date()): { text: string; warn: boolean } {
  const days = daysUntil(iso, now);
  if (days < 0) return { text: "API key caducada: genera otra en su n8n.", warn: true };
  const date = new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  if (days <= RENEW_WARNING_DAYS) {
    return { text: `La API key caduca en ${days === 0 ? "menos de un día" : `${days} día${days === 1 ? "" : "s"}`} (${date}).`, warn: true };
  }
  return { text: `API key vigente hasta el ${date}.`, warn: false };
}
