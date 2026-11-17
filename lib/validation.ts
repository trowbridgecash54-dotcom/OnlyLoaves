import { randomUUID } from "node:crypto";
import { maxQuantityPerLoaf } from "./defaults";
import { clean, cleanLine } from "./format";
import { WEEKDAYS, checkPickupDate } from "./pickup";
import { clubProducts, enrollmentOpen, ordersOpen, requestableProducts } from "./site-build";
import type { Plan, SiteData, Weekday } from "./types";

/**
 * Server-side validation for the three public forms, checked against
 * what the owner currently has in the dashboard: which loaves can be
 * requested, which pickup dates are allowed, and whether ordering and
 * Club enrollment are open at all.
 */

export type FieldErrors = Record<string, string>;

export type Result<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export type LoafLine = { productId: string; quantity: number };

export type OrderRequest = {
  requestId: string;
  name: string;
  email: string;
  phone: string;
  items: LoafLine[];
  pickupDate: string;
  notes: string;
};

export type ClubRequest = {
  requestId: string;
  planId: string;
  name: string;
  email: string;
  phone: string;
  pickupDay: Weekday | "flexible";
  firstPickupDate: string;
  selections: LoafLine[];
  preferredProductIds: string[];
  breadPreferences: string;
  requests: string;
  acceptedTerms: true;
};

export type ContactRequest = {
  requestId: string;
  name: string;
  email: string;
  message: string;
};

export type FormContext = { site: SiteData; today: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const closedMessage =
  "OnlyLoafs isn't taking orders yet. Send us a message from the Contact page and we'll let you know when we open.";

function asRecord(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

/**
 * The form's own id for this submission. Sending the same id twice
 * (a double click, a retry after a timeout) saves one record, not two.
 */
function readRequestId(body: Record<string, unknown>): string {
  const value = typeof body.requestId === "string" ? body.requestId : "";
  return UUID.test(value) ? value.toLowerCase() : randomUUID();
}

function readContact(body: Record<string, unknown>, errors: FieldErrors, phoneRequired: boolean) {
  const name = cleanLine(body.name, 100);
  const email = cleanLine(body.email, 254).toLowerCase();
  const phone = cleanLine(body.phone, 30);

  if (name.length < 2) errors.name = "Enter your full name.";
  if (!EMAIL.test(email)) {
    errors.email = "Enter an email address we can reply to, like name@example.com.";
  }
  const digits = phone.replace(/\D/g, "");
  if (phone === "") {
    if (phoneRequired) errors.phone = "Enter a phone number we can reach you on.";
  } else if (digits.length < 7 || digits.length > 15 || /[^\d\s()+.\-x]/i.test(phone)) {
    errors.phone = "Enter a valid phone number, like 555 123 4567.";
  }
  return { name, email, phone };
}

function readLines(value: unknown): LoafLine[] {
  if (!Array.isArray(value)) return [];
  const totals = new Map<string, number>();
  for (const entry of value.slice(0, 50)) {
    const line = asRecord(entry);
    const productId = cleanLine(line.productId, 80);
    const quantity = Number(line.quantity);
    if (productId === "" || !Number.isInteger(quantity) || quantity <= 0) continue;
    totals.set(productId, (totals.get(productId) ?? 0) + quantity);
  }
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

export function validateOrder(input: unknown, { site, today }: FormContext): Result<OrderRequest> {
  if (!ordersOpen(site)) return { ok: false, errors: { form: closedMessage } };

  const body = asRecord(input);
  const errors: FieldErrors = {};
  const contact = readContact(body, errors, false);
  const items = readLines(body.items);
  const requestable = requestableProducts(site);

  if (items.length === 0) errors.items = "Add at least one loaf to your request.";
  for (const item of items) {
    const product = site.products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      errors.items =
        "One of the loaves in your request is no longer on the menu. Refresh the page and try again.";
    } else if (!requestable.includes(product)) {
      errors.items = `${product.name} isn't available right now. Remove it to send your request.`;
    } else if (item.quantity > maxQuantityPerLoaf) {
      errors.items = `The form takes up to ${maxQuantityPerLoaf} of each loaf. For larger orders, message us from the Contact page.`;
    }
  }

  const pickupDate = cleanLine(body.pickupDate, 10);
  const dateCheck = checkPickupDate(site.pickup, pickupDate, today);
  if (!dateCheck.ok) errors.pickupDate = dateCheck.reason;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      requestId: readRequestId(body),
      ...contact,
      items,
      pickupDate,
      notes: clean(body.notes, 1500),
    },
  };
}

export function validateClub(input: unknown, { site, today }: FormContext): Result<ClubRequest> {
  const body = asRecord(input);
  const plan = site.plan;
  if (!plan || !enrollmentOpen(site) || cleanLine(body.planId, 80) !== plan.id) {
    return {
      ok: false,
      errors: {
        form: !ordersOpen(site)
          ? closedMessage
          : "Club enrollment isn't open right now. Message us from the Contact page and we'll let you know when it is.",
      },
    };
  }

  const errors: FieldErrors = {};
  const contact = readContact(body, errors, true);

  const pickupDayRaw = cleanLine(body.pickupDay, 12).toLowerCase();
  const allowedDays: string[] = site.pickup.weekdays.length > 0 ? site.pickup.weekdays : WEEKDAYS;
  let pickupDay: ClubRequest["pickupDay"] = "flexible";
  if (pickupDayRaw === "flexible") {
    pickupDay = "flexible";
  } else if (allowedDays.includes(pickupDayRaw)) {
    pickupDay = pickupDayRaw as Weekday;
  } else {
    errors.pickupDay = "Choose the pickup day you'd prefer.";
  }

  const firstPickupDate = cleanLine(body.firstPickupDate, 10);
  const dateCheck = checkPickupDate(site.pickup, firstPickupDate, today);
  if (!dateCheck.ok) errors.firstPickupDate = dateCheck.reason;

  const { selections, preferredProductIds } = readBreadChoices(body, plan, site, errors);

  if (body.acceptedTerms !== true) {
    errors.acceptedTerms = "Tick the box to confirm you've read how enrollment works.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      requestId: readRequestId(body),
      planId: plan.id,
      ...contact,
      pickupDay,
      firstPickupDate,
      selections,
      preferredProductIds,
      breadPreferences: clean(body.breadPreferences, 1000),
      requests: clean(body.requests, 1500),
      acceptedTerms: true,
    },
  };
}

function readBreadChoices(
  body: Record<string, unknown>,
  plan: Plan,
  site: SiteData,
  errors: FieldErrors,
): { selections: LoafLine[]; preferredProductIds: string[] } {
  const eligible = new Set(clubProducts(site).map((product) => product.id));

  if (plan.selection_mode === "preferences") {
    const preferredProductIds = Array.isArray(body.preferredProductIds)
      ? [...new Set(body.preferredProductIds.map((id) => cleanLine(id, 80)))].filter((id) =>
          eligible.has(id),
        )
      : [];
    return { selections: [], preferredProductIds };
  }

  const selections = readLines(body.selections);
  const total = selections.reduce((sum, line) => sum + line.quantity, 0);
  if (selections.some((line) => !eligible.has(line.productId))) {
    errors.selections =
      "One of your selections isn't part of the Club right now. Refresh the page and choose again.";
  } else if (total > plan.loaves_per_period) {
    errors.selections = `The Club includes ${plan.loaves_per_period} loaves each ${plan.billing_interval}. Remove ${total - plan.loaves_per_period} to continue.`;
  } else if (!plan.allow_mixed_loaves && selections.length > 1) {
    errors.selections = "Choose one kind of bread for all of your loaves.";
  }
  return { selections, preferredProductIds: [] };
}

export function validateContact(input: unknown): Result<ContactRequest> {
  const body = asRecord(input);
  const errors: FieldErrors = {};
  const { name, email } = readContact(body, errors, false);
  delete errors.phone;
  const message = clean(body.message, 3000);
  if (message.length < 10) errors.message = "Write a short message so we know how to help.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { requestId: readRequestId(body), name, email, message } };
}
