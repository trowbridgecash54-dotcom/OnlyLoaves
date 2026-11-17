import { escapeHtml } from "./format";

/**
 * Owner notifications, sent through Resend's HTTPS API.
 * Runs on the server only — the API key never reaches the browser.
 *
 * Email is a notification, not the record. Requests are saved to the
 * database first; if an email can't be sent the request is still safe
 * and the dashboard shows that the notification failed.
 *
 * Environment variables (see .env.example):
 *   RESEND_API_KEY      your Resend key
 *   ORDERS_TO_EMAIL     the inbox that receives notifications
 *   ORDERS_FROM_EMAIL   optional "from" line; defaults to Resend's test
 *                       sender, which only delivers to the address the
 *                       Resend account was created with
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "OnlyLoafs Website <onboarding@resend.dev>";
const ATTEMPTS = 2;
const TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 400;

export type OwnerEmail = {
  subject: string;
  /** The customer's address, so the owner can just hit Reply. */
  replyTo: string;
  heading: string;
  /** Label / value pairs shown in order. Empty values are skipped. */
  rows: [label: string, value: string][];
  /** A closing reminder for the owner. */
  note: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "send-failed"; detail: string };

type Env = Record<string, string | undefined>;

export function isEmailConfigured(env: Env = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.ORDERS_TO_EMAIL?.trim());
}

export function renderEmail(email: OwnerEmail): { text: string; html: string } {
  const rows = email.rows.filter(([, value]) => value.trim() !== "");

  const text = [
    email.heading,
    "",
    ...rows.map(([label, value]) => `${label}:\n${value}\n`),
    "—",
    email.note,
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 16px 10px 0;vertical-align:top;color:#5c6149;font-size:13px;white-space:nowrap;border-top:1px solid #e9d8b9">${escapeHtml(label)}</td>` +
        `<td style="padding:10px 0;vertical-align:top;border-top:1px solid #e9d8b9">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");

  const html =
    `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#302820;max-width:560px">` +
    `<h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px">${escapeHtml(email.heading)}</h1>` +
    `<table style="border-collapse:collapse;width:100%">${htmlRows}</table>` +
    `<p style="margin:24px 0 0;padding:12px 16px;background:#f7f3ea;font-size:13px">${escapeHtml(email.note)}</p>` +
    `</div>`;

  return { text, html };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one notification. Tries twice when the failure looks temporary
 * (network error, timeout, HTTP 429 or 5xx); a rejected request (4xx,
 * such as a bad key or an unverified sender) is not retried.
 *
 * Logs the HTTP status only — never customer details.
 */
export async function sendOwnerEmail(
  email: OwnerEmail,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
  retryDelayMs = RETRY_DELAY_MS,
): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.ORDERS_TO_EMAIL?.trim();
  if (!apiKey || !to) {
    return { ok: false, reason: "not-configured", detail: "Email notifications are not set up." };
  }

  const { text, html } = renderEmail(email);
  const body = JSON.stringify({
    from: env.ORDERS_FROM_EMAIL?.trim() || DEFAULT_FROM,
    to: [to],
    reply_to: email.replyTo,
    subject: email.subject,
    text,
    html,
  });

  let detail = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return { ok: true };
      detail = `Resend answered HTTP ${response.status}`;
      const temporary = response.status === 429 || response.status >= 500;
      if (!temporary) break;
    } catch (error) {
      detail =
        error instanceof Error && error.name === "TimeoutError"
          ? "Resend did not answer in time"
          : "Could not reach Resend";
    }
    if (attempt < ATTEMPTS) await wait(retryDelayMs);
  }

  console.error(`[onlyloafs] Notification email failed: ${detail}.`);
  return { ok: false, reason: "send-failed", detail };
}
