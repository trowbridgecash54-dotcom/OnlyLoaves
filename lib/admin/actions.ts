import { randomUUID } from "node:crypto";
import { getPeriodBounds } from "../allowance";
import { DbError } from "../db";
import {
  defaultBusiness,
  defaultCopy,
  defaultLaunch,
  defaultPickup,
  defaultPickupPrivate,
  defaultPolicies,
  defaultStory,
} from "../defaults";
import { clean, cleanLine, parsePriceToCents } from "../format";
import { MAX_PHOTO_BYTES, sniffImage } from "../images";
import { WEEKDAYS, isIsoDate } from "../pickup";
import type { Store } from "../store";

/**
 * Everything the owner can change from the dashboard. Each action takes
 * the submitted form, checks it, and saves through the owner's Store —
 * which means the database's row-level security has the final say on
 * every one of them.
 *
 * Actions return where to go next and what to tell the owner. Anything
 * she can fix (a missing name, a photo that's too big) is an ActionError
 * with a plain-language message.
 */

export class ActionError extends Error {}

export type ActionResult = { to: string; ok: string };
export type ActionContext = { store: Store; today: string };
type Action = (form: FormData, context: ActionContext) => Promise<ActionResult>;

/* ---------- Reading form fields ---------- */

const text = (form: FormData, name: string, max = 500) => cleanLine(form.get(name), max);
const longText = (form: FormData, name: string, max = 4000) => clean(form.get(name), max);
const checked = (form: FormData, name: string) => form.get(name) === "on";

function required(form: FormData, name: string, label: string, max = 200): string {
  const value = text(form, name, max);
  if (value === "") throw new ActionError(`${label} can't be empty.`);
  return value;
}

function oneOf<T extends string>(form: FormData, name: string, allowed: readonly T[], label: string): T {
  const value = text(form, name, 40);
  if (!allowed.includes(value as T)) throw new ActionError(`Choose a valid ${label}.`);
  return value as T;
}

function wholeNumber(form: FormData, name: string, label: string, min: number, max: number): number | null {
  const raw = text(form, name, 12);
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ActionError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

function dateField(form: FormData, name: string, label: string): string {
  const value = text(form, name, 10);
  if (!isIsoDate(value)) throw new ActionError(`Choose a valid date for ${label}.`);
  return value;
}

function price(form: FormData, name: string): number | null {
  const cents = parsePriceToCents(text(form, name, 12));
  if (cents === undefined) throw new ActionError("Enter the price as a number, like 12 or 12.50.");
  return cents;
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/**
 * Checks and stores an uploaded photo. The file's real type is read
 * from its contents (not its name or what the browser claims), and it
 * is saved under a random name. Returns the stored path, or null when
 * no file was chosen.
 */
async function savePhoto(form: FormData, field: string, folder: string, store: Store): Promise<string | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ActionError("That photo is larger than 5 MB. Choose a smaller one.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new ActionError("That file isn't a JPEG, PNG or WebP photo.");
  const path = `${folder}/${randomUUID()}.${kind.extension}`;
  await store.uploadPhoto(path, bytes, kind.contentType);
  return path;
}

/** Saves one settings group, keeping any saved value the form didn't include. */
async function saveGroup<T extends object>(
  store: Store,
  key: string,
  defaults: T,
  changes: Partial<T>,
  isPublic: boolean,
): Promise<T> {
  const saved = (await store.settings())[key];
  const current = saved !== null && typeof saved === "object" ? (saved as Partial<T>) : {};
  const next = { ...defaults, ...current, ...changes };
  await store.saveSetting(key, next as Record<string, unknown>, isPublic);
  return next;
}

/* ---------- Bread ---------- */

const AVAILABILITY = ["available", "limited", "sold-out", "coming-soon"] as const;

const productSave: Action = async (form, { store }) => {
  const id = text(form, "id", 40) || null;
  const name = required(form, "name", "The loaf's name", 80);
  const existing = id ? (await store.products()).find((product) => product.id === id) : undefined;
  if (id && !existing) throw new ActionError("That loaf no longer exists.");

  const photo = await savePhoto(form, "photo", "products", store);
  const removePhoto = checked(form, "remove_photo");

  const fields = {
    name,
    description: longText(form, "description", 600),
    price_cents: price(form, "price"),
    ingredients: longText(form, "ingredients", 1000) || null,
    allergens: longText(form, "allergens", 500) || null,
    availability: oneOf(form, "availability", AVAILABILITY, "availability"),
    availability_note: text(form, "availability_note", 120),
    featured: checked(form, "featured"),
    club_eligible: checked(form, "club_eligible"),
    sort_order: wholeNumber(form, "sort_order", "Display order", 0, 9999) ?? 0,
    image_alt: text(form, "image_alt", 200),
    ...(photo ? { image_path: photo } : removePhoto ? { image_path: null } : {}),
  };

  if (existing) {
    await store.saveProduct(existing.id, fields);
    if (photo || removePhoto) await store.removePhoto(existing.image_path);
    return { to: "/admin/products", ok: `${name} saved.` };
  }

  const slug = slugify(name);
  if (slug === "") throw new ActionError("The name needs at least one letter or number.");
  await store.saveProduct(null, { ...fields, slug });
  return { to: "/admin/products", ok: `${name} added.` };
};

const productArchive: Action = async (form, { store }) => {
  const archive = text(form, "archived") === "1";
  await store.archiveProduct(required(form, "id", "The loaf"), archive);
  return {
    to: "/admin/products",
    ok: archive ? "Loaf archived. It's hidden from the website." : "Loaf restored to the website.",
  };
};

const productDelete: Action = async (form, { store }) => {
  const id = required(form, "id", "The loaf");
  const product = (await store.products()).find((candidate) => candidate.id === id);
  if (!checked(form, "confirm")) throw new ActionError("Tick the box to confirm deleting this loaf.");
  await store.deleteProduct(id);
  await store.removePhoto(product?.image_path ?? null);
  return { to: "/admin/products", ok: "Loaf deleted. Past orders keep its name." };
};

/* ---------- Orders and messages ---------- */

const ORDER_STATUS = ["new", "confirmed", "preparing", "ready", "completed", "canceled"] as const;

const orderUpdate: Action = async (form, { store }) => {
  await store.updateOrder(required(form, "id", "The order"), {
    status: oneOf(form, "status", ORDER_STATUS, "status"),
    owner_notes: longText(form, "owner_notes", 2000),
  });
  return { to: "/admin/orders", ok: "Order updated." };
};

const messageUpdate: Action = async (form, { store }) => {
  const status = oneOf(form, "status", ["new", "resolved"] as const, "status");
  await store.updateMessage(required(form, "id", "The message"), {
    status,
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
  });
  return { to: "/admin/messages", ok: status === "resolved" ? "Marked resolved." : "Reopened." };
};

/* ---------- The Club ---------- */

const inquiryUpdate: Action = async (form, { store }) => {
  const status = oneOf(form, "status", ["inquiry", "pending-approval", "rejected"] as const, "status");
  await store.updateInquiry(required(form, "id", "The request"), {
    status,
    owner_notes: longText(form, "owner_notes", 2000),
  });
  return { to: "/admin/club", ok: status === "rejected" ? "Request declined." : "Request updated." };
};

const inquiryApprove: Action = async (form, { store }) => {
  if (!checked(form, "confirmed")) {
    throw new ActionError(
      "Tick the box to confirm you've agreed the terms, payment and pickups with this customer.",
    );
  }
  const subscriptionId = await store.approveInquiry(
    required(form, "id", "The request"),
    dateField(form, "started_on", "the start date"),
    text(form, "pickup_day", 12),
  );
  return {
    to: `/admin/club/${subscriptionId}`,
    ok: "Membership created. No payment has been recorded yet.",
  };
};

const SUBSCRIPTION_STATUS = ["active", "paused", "canceled"] as const;

const subscriptionUpdate: Action = async (form, { store, today }) => {
  const id = required(form, "id", "The membership");
  const status = oneOf(form, "status", SUBSCRIPTION_STATUS, "status");
  const current = await store.subscription(id);
  if (!current) throw new ActionError("That membership no longer exists.");
  await store.updateSubscription(id, {
    status,
    paused_on: status === "paused" ? (current.paused_on ?? today) : null,
    canceled_on: status === "canceled" ? (current.canceled_on ?? today) : null,
    pickup_day: text(form, "pickup_day", 12) || "flexible",
    pickup_notes: longText(form, "pickup_notes", 1000),
    owner_notes: longText(form, "owner_notes", 2000),
  });
  return { to: `/admin/club/${id}`, ok: "Membership updated." };
};

/** Finds (or opens) the allowance period that contains `date` for a membership. */
async function periodFor(store: Store, subscriptionId: string, date: string) {
  const subscription = await store.subscription(subscriptionId);
  if (!subscription) throw new ActionError("That membership no longer exists.");
  const plan = (await store.plans()).find((candidate) => candidate.id === subscription.plan_id);
  const bounds = getPeriodBounds(date, plan?.tracking_period ?? "calendar-month", subscription.started_on);
  return store.ensurePeriod(subscriptionId, bounds.startsOn, bounds.endsOn);
}

const loafFulfill: Action = async (form, { store, today }) => {
  const subscriptionId = required(form, "subscription_id", "The membership");
  const fulfilledOn = text(form, "fulfilled_on", 10) ? dateField(form, "fulfilled_on", "the pickup date") : today;
  const period = await periodFor(store, subscriptionId, fulfilledOn);
  const result = await store.fulfillLoaf({
    periodId: period.id,
    productId: text(form, "product_id", 40) || null,
    fulfilledOn,
    // Made when the page was shown: a double click or a resubmitted form repeats it.
    idempotencyKey: required(form, "key", "The form"),
    asExtra: checked(form, "as_extra"),
  });
  return {
    to: `/admin/club/${subscriptionId}`,
    ok: result.duplicate
      ? "That loaf was already recorded — nothing was added twice."
      : result.is_extra
        ? "Extra loaf recorded as an additional purchase."
        : "Loaf recorded.",
  };
};

const loafVoid: Action = async (form, { store }) => {
  const subscriptionId = required(form, "subscription_id", "The membership");
  await store.voidFulfillment(
    required(form, "id", "The record"),
    text(form, "reason", 200) || "Recorded by mistake",
  );
  return { to: `/admin/club/${subscriptionId}`, ok: "Record voided. The loaf is available again." };
};

const PAYMENT_STATUS = ["unpaid", "paid", "waived", "refunded"] as const;

const periodUpdate: Action = async (form, { store, today }) => {
  const subscriptionId = required(form, "subscription_id", "The membership");
  const period = await periodFor(store, subscriptionId, text(form, "period_date", 10) || today);
  const status = oneOf(form, "payment_status", PAYMENT_STATUS, "payment status");
  await store.updatePeriod(period.id, {
    payment_status: status,
    paid_on: status === "paid" ? (text(form, "paid_on", 10) ? dateField(form, "paid_on", "the payment date") : today) : null,
    payment_note: text(form, "payment_note", 300),
  });
  return { to: `/admin/club/${subscriptionId}`, ok: "Payment status recorded." };
};

const planSave: Action = async (form, { store }) => {
  const cents = price(form, "price");
  if (cents === null) throw new ActionError("The Club needs a price.");
  const loaves = wholeNumber(form, "loaves_per_period", "Loaves included", 1, 31);
  if (loaves === null) throw new ActionError("Enter how many loaves the Club includes.");
  await store.savePlan(required(form, "id", "The plan"), {
    name: required(form, "name", "The plan name", 60),
    price_cents: cents,
    loaves_per_period: loaves,
    max_subscribers: wholeNumber(form, "max_subscribers", "The subscriber limit", 0, 10000),
    enabled: checked(form, "enabled"),
    accepting_requests: checked(form, "accepting_requests"),
    closed_message: longText(form, "closed_message", 400),
    selection_mode: oneOf(form, "selection_mode", ["choose", "preferences"] as const, "selection option"),
    allow_mixed_loaves: checked(form, "allow_mixed_loaves"),
    allow_pause_requests: checked(form, "allow_pause_requests"),
    tracking_period: oneOf(form, "tracking_period", ["calendar-month", "anniversary"] as const, "allowance period"),
    unused_loaf_policy: oneOf(form, "unused_loaf_policy", ["undecided", "expire", "rollover", "credit"] as const, "unused-loaf rule"),
  });
  return {
    to: "/admin/club/plan",
    ok: "Plan saved. Existing members keep the price and loaves they were approved with.",
  };
};

const policiesSave: Action = async (form, { store }) => {
  await saveGroup(store, "policies", defaultPolicies, {
    payment: longText(form, "payment", 1200),
    renewal: longText(form, "renewal", 1200),
    pauseAndCancel: longText(form, "pauseAndCancel", 1200),
    missedPickup: longText(form, "missedPickup", 1200),
    unusedLoaves: longText(form, "unusedLoaves", 1200),
    refunds: longText(form, "refunds", 1200),
  }, true);
  return { to: "/admin/club/plan", ok: "Policies saved. They now appear on the Club page, the enrollment form and the FAQ." };
};

/* ---------- Pickup ---------- */

const pickupSave: Action = async (form, { store }) => {
  const timeZone = required(form, "timeZone", "The time zone", 60);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new ActionError("That time zone isn't recognized. Choose one from the list.");
  }
  await saveGroup(store, "pickup", defaultPickup, {
    timeZone,
    weekdays: WEEKDAYS.filter((day) => form.getAll("weekdays").includes(day)),
    minNoticeDays: wholeNumber(form, "minNoticeDays", "Minimum notice", 0, 60),
    maxAdvanceDays: wholeNumber(form, "maxAdvanceDays", "Booking window", 1, 365),
    area: text(form, "area", 120),
    instructions: longText(form, "instructions", 600),
  }, true);
  // Stored separately and never sent to visitors.
  await saveGroup(store, "pickup_private", defaultPickupPrivate, {
    address: longText(form, "private_address", 300),
    instructions: longText(form, "private_instructions", 1000),
  }, false);
  return { to: "/admin/pickup", ok: "Pickup settings saved." };
};

const closureAdd: Action = async (form, { store }) => {
  await store.addClosure(dateField(form, "closed_on", "the closed date"), text(form, "note", 120));
  return { to: "/admin/pickup", ok: "Date blocked. Customers can't choose it." };
};

const closureRemove: Action = async (form, { store }) => {
  await store.removeClosure(dateField(form, "closed_on", "the date"));
  return { to: "/admin/pickup", ok: "Date reopened." };
};

/* ---------- Website settings ---------- */

const businessSave: Action = async (form, { store }) => {
  const email = text(form, "email", 254).toLowerCase();
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ActionError("That contact email doesn't look right. Leave it blank to hide it.");
  }
  const instagramUrl = text(form, "instagramUrl", 200);
  if (instagramUrl !== "" && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(instagramUrl)) {
    throw new ActionError(
      "Paste your full Instagram link, like https://www.instagram.com/yourname — or leave it blank to hide it.",
    );
  }
  await saveGroup(store, "business", defaultBusiness, {
    name: required(form, "name", "The business name", 60),
    tagline: longText(form, "tagline", 300),
    email,
    instagramUrl,
    announcement: text(form, "announcement", 200),
    disclosures: longText(form, "disclosures", 1200)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    ordersOpen: checked(form, "ordersOpen"),
  }, true);
  return { to: "/admin/settings", ok: "Business details saved." };
};

const copySave: Action = async (form, { store }) => {
  const heroImage = await savePhoto(form, "hero_photo", "site", store);
  const clubImage = await savePhoto(form, "club_photo", "site", store);
  const fields = [
    "heroLine1", "heroLine2", "heroSupporting", "featuredHeading", "clubHeading", "clubSupporting",
    "clubAside", "clubPageHeadline", "clubPageSupporting", "clubPageAside",
  ] as const;
  const changes: Partial<typeof defaultCopy> = {};
  for (const field of fields) changes[field] = longText(form, field, 300);
  if (heroImage) changes.heroImage = heroImage;
  if (clubImage) changes.clubImage = clubImage;
  await saveGroup(store, "copy", defaultCopy, changes, true);
  return { to: "/admin/settings", ok: "Wording saved." };
};

const storySave: Action = async (form, { store }) => {
  const image = await savePhoto(form, "photo", "site", store);
  await saveGroup(store, "story", defaultStory, {
    intro: longText(form, "intro"),
    howItStarted: longText(form, "howItStarted"),
    whyBaking: longText(form, "whyBaking"),
    process: longText(form, "process"),
    whyUs: longText(form, "whyUs"),
    bakerName: text(form, "bakerName", 80),
    ...(image ? { image } : {}),
  }, true);
  return { to: "/admin/settings", ok: "Our Story saved." };
};

const launchSave: Action = async (form, { store }) => {
  await saveGroup(store, "launch", defaultLaunch, {
    permitConfirmed: checked(form, "permitConfirmed"),
    labelsConfirmed: checked(form, "labelsConfirmed"),
    notes: longText(form, "notes", 2000),
  }, false);
  return { to: "/admin/checklist", ok: "Saved." };
};

export const actions: Record<string, Action> = {
  "product-save": productSave,
  "product-archive": productArchive,
  "product-delete": productDelete,
  "order-update": orderUpdate,
  "message-update": messageUpdate,
  "inquiry-update": inquiryUpdate,
  "inquiry-approve": inquiryApprove,
  "subscription-update": subscriptionUpdate,
  "loaf-fulfill": loafFulfill,
  "loaf-void": loafVoid,
  "period-update": periodUpdate,
  "plan-save": planSave,
  "policies-save": policiesSave,
  "pickup-save": pickupSave,
  "closure-add": closureAdd,
  "closure-remove": closureRemove,
  "business-save": businessSave,
  "copy-save": copySave,
  "story-save": storySave,
  "launch-save": launchSave,
};

/* ---------- Turning database refusals into plain language ---------- */

const REFUSALS: Record<string, string> = {
  allowance_exhausted:
    "All of this period's loaves have already been recorded. If this is an additional purchase, tick “Record as an extra loaf”.",
  subscription_not_active:
    "This membership isn't active for that date, so nothing can be recorded against it.",
  date_outside_period: "That date isn't inside the allowance period.",
  subscriber_limit_reached:
    "You've reached your subscriber limit. Raise it under Club → Plan and terms, or leave this request pending.",
  inquiry_already_decided: "This request has already been approved or declined.",
  inquiry_not_found: "That request no longer exists.",
  fulfillments_are_permanent: "Loaf records can't be edited or deleted. Void the record instead.",
  not_authorized: "Your account isn't authorized to do that.",
};

export function explain(error: unknown): string {
  if (error instanceof ActionError) return error.message;
  if (error instanceof DbError) {
    if (REFUSALS[error.message]) return REFUSALS[error.message];
    if (error.code === "23505") return "Something with that name already exists. Choose a different name.";
    if (error.code === "42501") return REFUSALS.not_authorized;
  }
  console.error("[onlyloafs] An owner action failed unexpectedly.");
  return "That didn't save — something went wrong on our side. Try again in a moment.";
}
