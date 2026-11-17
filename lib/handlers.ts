import { createHash } from "node:crypto";
import { DbError } from "./db";
import type { OwnerEmail, SendResult } from "./email";
import { cleanLine, formatCents, pluralize } from "./format";
import { formatPickupDate, formatWeekday, todayInTimeZone } from "./pickup";
import { allowRequest, checkSubmission } from "./spam";
import type { Saved, Store } from "./store";
import type { SiteData } from "./types";
import {
  validateClub,
  validateContact,
  validateOrder,
  type ClubRequest,
  type ContactRequest,
  type FieldErrors,
  type LoafLine,
  type OrderRequest,
  type Result,
} from "./validation";

/**
 * The three public form endpoints. Each one:
 *
 *   read JSON → spam checks → rate limit → validate → SAVE → notify → reply
 *
 * Saving comes first. Once a request is in the database the customer is
 * told it was received, whether or not the owner's notification email
 * goes out; the outcome of the email is recorded on the saved request so
 * the dashboard can show it. A request is never described as confirmed —
 * only the owner confirms.
 *
 * Written against plain Request/Response objects with everything it
 * needs passed in, so it can be tested without running the site.
 */

export type ApiReply = {
  ok: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Shown to the customer, e.g. OL-7K3F9Q. Present when the request was saved. */
  reference?: string;
};

export type FormStore = Pick<
  Store,
  "submitOrder" | "submitInquiry" | "submitContact" | "setNotification" | "rateLimit"
>;

export type FormDeps = {
  site: SiteData;
  /** null when no database is connected: requests can then only be emailed. */
  store: FormStore | null;
  send: (email: OwnerEmail) => Promise<SendResult>;
};

type Kind = "order" | "inquiry" | "contact";

const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 600;

function reply(status: number, body: ApiReply): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return null;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A stable, anonymous key for the visitor: a hash, never the address itself. */
function visitorBucket(request: Request, kind: Kind): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return `${kind}:${createHash("sha256").update(`onlyloafs:${ip}`).digest("hex").slice(0, 32)}`;
}

async function withinRateLimit(deps: FormDeps, bucket: string): Promise<boolean> {
  if (deps.store) {
    try {
      // Shared across every server instance.
      return await deps.store.rateLimit(bucket, RATE_LIMIT, RATE_WINDOW_SECONDS);
    } catch {
      console.error("[onlyloafs] Rate-limit check failed; using the in-memory limiter.");
    }
  }
  return allowRequest(bucket);
}

const contactLine = (site: SiteData) =>
  site.business.email ? ` You can also email us at ${site.business.email}.` : "";

/** Messages for the refusals the database itself can raise while saving. */
const REFUSALS: Record<string, string> = {
  product_unavailable:
    "One of those loaves just became unavailable. Refresh the page and try again.",
  enrollment_closed:
    "Club enrollment has just closed. Message us from the Contact page and we'll let you know when it reopens.",
};

async function handle<T extends { requestId: string }>(
  request: Request,
  kind: Kind,
  deps: FormDeps,
  validate: (body: Record<string, unknown>) => Result<T>,
  save: (store: FormStore, data: T) => Promise<Saved>,
  compose: (data: T, reference: string) => OwnerEmail,
): Promise<Response> {
  const body = await readBody(request);
  if (!body) {
    return reply(400, {
      ok: false,
      message: "We couldn't read that request. Refresh the page and try again.",
    });
  }

  const verdict = checkSubmission(body);
  if (verdict === "honeypot") return reply(200, { ok: true }); // Tell the bot it worked; keep nothing.
  if (verdict === "too-fast") {
    return reply(400, {
      ok: false,
      message: "That was quick. Wait a few seconds and send it again.",
    });
  }

  if (!(await withinRateLimit(deps, visitorBucket(request, kind)))) {
    return reply(429, {
      ok: false,
      message: `We've received several requests from you in a short time. Try again in a few minutes.${contactLine(deps.site)}`,
    });
  }

  const result = validate(body);
  if (!result.ok) {
    return reply(result.errors.form ? 409 : 400, {
      ok: false,
      message: result.errors.form ?? "Check the highlighted fields and try again.",
      errors: result.errors,
    });
  }
  const data = result.data;
  const notSent = `Your request wasn't sent — something went wrong on our side. Try again in a minute.${contactLine(deps.site)}`;

  // 1. Save. The saved request is the record.
  let saved: Saved | null = null;
  if (deps.store) {
    try {
      saved = await save(deps.store, data);
    } catch (error) {
      const refusal = error instanceof DbError ? REFUSALS[error.message] : undefined;
      if (refusal) return reply(409, { ok: false, message: refusal });
      console.error(`[onlyloafs] Could not save a ${kind} request to the database.`);
    }
  }

  // A repeat of a request we already have: don't notify twice.
  if (saved?.duplicate) return reply(200, { ok: true, reference: saved.reference || undefined });

  // 2. Notify the owner.
  const email = compose(data, saved?.reference ?? "");
  if (!saved) {
    email.note = `IMPORTANT: this request is NOT in the dashboard${deps.store ? " because saving it failed" : " (no database is connected)"}. This email is the only copy. ${email.note}`;
  }
  const sent = await deps.send(email);

  if (saved && deps.store) {
    try {
      await deps.store.setNotification(
        kind,
        saved.id,
        sent.ok ? "sent" : sent.reason === "not-configured" ? "not-configured" : "failed",
        sent.ok ? null : sent.detail,
      );
    } catch {
      console.error("[onlyloafs] Could not record the notification result.");
    }
    return reply(200, { ok: true, reference: saved.reference || undefined });
  }

  // Not saved: the email was the only way this could reach the owner.
  return sent.ok ? reply(200, { ok: true }) : reply(503, { ok: false, message: notSent });
}

/* ---------- Emails ---------- */

const productOf = (site: SiteData, id: string) => site.products.find((product) => product.id === id);

function describeLines(site: SiteData, lines: LoafLine[], showPrices: boolean): string {
  return lines
    .map((line) => {
      const product = productOf(site, line.productId);
      const price =
        showPrices && product && product.price_cents !== null
          ? ` (${formatCents(product.price_cents)} each)`
          : "";
      return `${line.quantity} × ${product?.name ?? line.productId}${price}`;
    })
    .join("\n");
}

function estimateTotal(site: SiteData, lines: LoafLine[]): string {
  let total = 0;
  for (const line of lines) {
    const price = productOf(site, line.productId)?.price_cents;
    if (price === null || price === undefined) {
      return "Not calculated — at least one loaf has no price set.";
    }
    total += price * line.quantity;
  }
  return `${formatCents(total)} (from website prices — confirm with the customer)`;
}

export function composeOrderEmail(site: SiteData, order: OrderRequest, reference: string): OwnerEmail {
  const count = order.items.reduce((sum, line) => sum + line.quantity, 0);
  return {
    subject: `Order request${reference ? ` ${reference}` : ""}: ${count} ${pluralize(count, "loaf", "loaves")} — ${cleanLine(order.name, 60)}`,
    replyTo: order.email,
    heading: "New one-time order request",
    rows: [
      ["Reference", reference],
      ["Name", order.name],
      ["Email", order.email],
      ["Phone", order.phone],
      ["Loaves", describeLines(site, order.items, true)],
      ["Estimated total", estimateTotal(site, order.items)],
      ["Preferred pickup", formatPickupDate(order.pickupDate)],
      ["Notes", order.notes],
    ],
    note: "This is a request, not a confirmed order. Reply to this email to confirm availability, the total, payment and pickup details with the customer, then update the order in your dashboard.",
  };
}

export function composeClubEmail(site: SiteData, inquiry: ClubRequest, reference: string): OwnerEmail {
  const plan = site.plan;
  const planLine = plan
    ? `${plan.name} — ${formatCents(plan.price_cents, plan.currency)} / ${plan.billing_interval} — ${plan.loaves_per_period} ${pluralize(plan.loaves_per_period, "loaf", "loaves")}`
    : inquiry.planId;
  const chosen = inquiry.selections.reduce((sum, line) => sum + line.quantity, 0);
  const selectionText =
    inquiry.selections.length > 0
      ? `${describeLines(site, inquiry.selections, false)}${
          plan && chosen < plan.loaves_per_period
            ? `\n(${plan.loaves_per_period - chosen} left to your choice)`
            : ""
        }`
      : "";

  return {
    subject: `Club enrollment request${reference ? ` ${reference}` : ""} — ${cleanLine(inquiry.name, 60)}`,
    replyTo: inquiry.email,
    heading: "New OnlyLoafs Club enrollment request",
    rows: [
      ["Reference", reference],
      ["Plan as shown on the site", planLine],
      ["Name", inquiry.name],
      ["Email", inquiry.email],
      ["Phone", inquiry.phone],
      [
        "Preferred pickup day",
        inquiry.pickupDay === "flexible" ? "Flexible" : formatWeekday(inquiry.pickupDay),
      ],
      ["Preferred first pickup", formatPickupDate(inquiry.firstPickupDate)],
      ["Loaves requested", selectionText],
      [
        "Breads they like",
        inquiry.preferredProductIds.map((id) => productOf(site, id)?.name ?? id).join(", "),
      ],
      ["Bread preferences", inquiry.breadPreferences],
      ["Additional requests", inquiry.requests],
      ["Terms acknowledged", "Yes"],
    ],
    note: "This is an inquiry, not an active subscription. Nothing has been charged or promised. Review it in your dashboard under Club, and approve it only after you've confirmed the terms, payment arrangements and pickup schedule with the customer.",
  };
}

export function composeContactEmail(message: ContactRequest): OwnerEmail {
  return {
    subject: `Website message — ${cleanLine(message.name, 60)}`,
    replyTo: message.email,
    heading: "New message from the website",
    rows: [
      ["Name", message.name],
      ["Email", message.email],
      ["Message", message.message],
    ],
    note: "Reply to this email to answer the customer directly, then mark the message resolved in your dashboard.",
  };
}

/* ---------- Endpoints ---------- */

const today = (site: SiteData) => todayInTimeZone(site.pickup.timeZone);

export function handleOrderRequest(request: Request, deps: FormDeps) {
  const { site } = deps;
  return handle<OrderRequest>(
    request,
    "order",
    deps,
    (body) => validateOrder(body, { site, today: today(site) }),
    (store, order) =>
      store.submitOrder({
        idempotency_key: order.requestId,
        name: order.name,
        email: order.email,
        phone: order.phone,
        pickup_date: order.pickupDate,
        notes: order.notes,
        items: order.items.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
      }),
    (order, reference) => composeOrderEmail(site, order, reference),
  );
}

export function handleClubRequest(request: Request, deps: FormDeps) {
  const { site } = deps;
  const named = (lines: LoafLine[]) =>
    lines.map((line) => ({
      name: productOf(site, line.productId)?.name ?? line.productId,
      quantity: line.quantity,
    }));
  return handle<ClubRequest>(
    request,
    "inquiry",
    deps,
    (body) => validateClub(body, { site, today: today(site) }),
    (store, inquiry) =>
      store.submitInquiry({
        idempotency_key: inquiry.requestId,
        plan_id: inquiry.planId,
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        pickup_day: inquiry.pickupDay,
        first_pickup_date: inquiry.firstPickupDate,
        requested_loaves: [
          ...named(inquiry.selections),
          ...inquiry.preferredProductIds.map((id) => ({
            name: productOf(site, id)?.name ?? id,
            quantity: null,
          })),
        ],
        bread_preferences: inquiry.breadPreferences,
        requests: inquiry.requests,
      }),
    (inquiry, reference) => composeClubEmail(site, inquiry, reference),
  );
}

export function handleContactRequest(request: Request, deps: FormDeps) {
  return handle<ContactRequest>(
    request,
    "contact",
    deps,
    validateContact,
    (store, message) =>
      store.submitContact({
        idempotency_key: message.requestId,
        name: message.name,
        email: message.email,
        message: message.message,
      }),
    (message) => composeContactEmail(message),
  );
}
