/**
 * Lightweight spam protection for the request forms. No third-party
 * service and no cookies:
 *
 *  1. Honeypot — a field hidden from people. Bots that fill every field
 *     give themselves away, and their submission is quietly dropped.
 *  2. Time check — the form records when it was opened. Submissions that
 *     arrive faster than a person could type are asked to try again.
 *  3. Rate limit — a cap on requests per visitor in a short window.
 *
 * The rate limit lives in server memory. On Vercel each server instance
 * keeps its own count, so treat it as a speed bump rather than a wall.
 * If spam becomes a real problem, add Cloudflare Turnstile or a shared
 * store such as Upstash Redis (see README, "If spam gets through").
 */

export const HONEYPOT_FIELD = "company";
export const STARTED_AT_FIELD = "startedAt";

const MIN_FILL_TIME_MS = 2500;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_TRACKED_VISITORS = 5000;

export type SpamVerdict = "ok" | "honeypot" | "too-fast";

export function checkSubmission(
  body: Record<string, unknown>,
  now = Date.now(),
): SpamVerdict {
  const trap = body[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") return "honeypot";

  const startedAt = Number(body[STARTED_AT_FIELD]);
  if (!Number.isFinite(startedAt) || now - startedAt < MIN_FILL_TIME_MS) {
    return "too-fast";
  }
  return "ok";
}

const hits = new Map<string, number[]>();

/** Returns true when the visitor is within the limit. */
export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_VISITORS) {
    for (const [visitor, times] of hits) {
      if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(visitor);
    }
  }
  return true;
}

/** Test helper. */
export function resetRateLimit() {
  hits.clear();
}
