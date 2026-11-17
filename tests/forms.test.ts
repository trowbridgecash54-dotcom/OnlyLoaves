/**
 * The three public form endpoints, end to end through the real handler
 * code, with an in-memory stand-in for the database and for email.
 * Nothing here contacts Supabase or Resend.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { DbError } from "@/lib/db";
import { renderEmail, sendOwnerEmail, type OwnerEmail, type SendResult } from "@/lib/email";
import { formatCents, parsePriceToCents } from "@/lib/format";
import { handleClubRequest, handleContactRequest, handleOrderRequest, type FormDeps, type FormStore } from "@/lib/handlers";
import { sniffImage } from "@/lib/images";
import { resetRateLimit } from "@/lib/spam";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite();
const [classic, rosemary] = site.products;
const plan = site.plan!;

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const human = () => ({ company: "", startedAt: Date.now() - 10_000 });
const order = (extra: Record<string, unknown> = {}) => ({
  ...human(), requestId: crypto.randomUUID(), name: "Fixture Customer", email: "customer@example.test", phone: "",
  items: [{ productId: classic.id, quantity: 2 }], pickupDate: "2027-12-04", notes: "", ...extra,
});
const club = (extra: Record<string, unknown> = {}) => ({
  ...human(), requestId: crypto.randomUUID(), planId: plan.id, name: "Fixture Member", email: "member@example.test",
  phone: "555 123 4567", pickupDay: "saturday", firstPickupDate: "2027-12-04",
  selections: [{ productId: classic.id, quantity: 2 }, { productId: rosemary.id, quantity: 1 }],
  breadPreferences: "", requests: "", acceptedTerms: true, ...extra,
});

type Call = { kind: string; payload: unknown };
function fakeStore(options: { saveError?: Error; duplicate?: boolean; rateOk?: boolean } = {}) {
  const calls: Call[] = [];
  const notifications: [string, string, string, string | null][] = [];
  const save = (kind: string, prefix: string) => async (payload: unknown) => {
    calls.push({ kind, payload });
    if (options.saveError) throw options.saveError;
    return { id: `${kind}-id`, reference: prefix ? `${prefix}-ABC234` : "", duplicate: options.duplicate ?? false };
  };
  const store: FormStore = {
    submitOrder: save("order", "OL"),
    submitInquiry: save("inquiry", "CL"),
    submitContact: save("contact", ""),
    setNotification: async (kind, id, status, error = null) => { notifications.push([kind, id, status, error]); },
    rateLimit: async () => options.rateOk ?? true,
  };
  return { store, calls, notifications };
}
function mailbox(result: SendResult = { ok: true }) {
  const sent: OwnerEmail[] = [];
  return { sent, send: async (email: OwnerEmail) => { sent.push(email); return result; } };
}
const deps = (store: FormStore | null, send: FormDeps["send"], s = site): FormDeps => ({ site: s, store, send });

beforeEach(() => resetRateLimit());

test("an order is saved first, gets a reference, then the owner is notified", async () => {
  const db = fakeStore();
  const mail = mailbox();
  const input = order();
  const response = await handleOrderRequest(post(input), deps(db.store, mail.send));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, reference: "OL-ABC234" });
  const saved = db.calls[0].payload as { idempotency_key: string; items: unknown[] };
  assert.equal(saved.idempotency_key, input.requestId);
  assert.deepEqual(saved.items, [{ product_id: classic.id, quantity: 2 }]);
  assert.equal(mail.sent.length, 1);
  const { text } = renderEmail(mail.sent[0]);
  assert.match(text, /OL-ABC234/);
  assert.match(text, /2 × Classic Sourdough \(\$12 each\)/);
  assert.match(text, /not a confirmed order/);
  assert.deepEqual(db.notifications, [["order", "order-id", "sent", null]]);
});

test("if the email fails after saving, the customer still gets 'received' and the failure is recorded", async () => {
  const db = fakeStore();
  const response = await handleOrderRequest(post(order()), deps(db.store, mailbox({ ok: false, reason: "send-failed", detail: "Resend answered HTTP 500" }).send));
  assert.equal(response.status, 200);
  assert.deepEqual(db.notifications, [["order", "order-id", "failed", "Resend answered HTTP 500"]]);
});

test("with email not configured, saved requests are marked so in the dashboard", async () => {
  const db = fakeStore();
  const response = await handleContactRequest(
    post({ ...human(), name: "Fixture", email: "f@example.test", message: "A fixture question." }),
    deps(db.store, (email) => sendOwnerEmail(email, {})),
  );
  assert.equal(response.status, 200);
  assert.equal(db.notifications[0][2], "not-configured");
});

test("a database failure falls back to email, and the email says it's the only copy", async () => {
  const db = fakeStore({ saveError: new DbError("connection refused") });
  const mail = mailbox();
  const quiet = console.error; console.error = () => {};
  try {
    const response = await handleOrderRequest(post(order()), deps(db.store, mail.send));
    assert.equal(response.status, 200);
    assert.match(mail.sent[0].note, /NOT in the dashboard/);
  } finally { console.error = quiet; }
});

test("if neither saving nor email works, the customer is told it wasn't sent", async () => {
  const db = fakeStore({ saveError: new DbError("connection refused") });
  const quiet = console.error; console.error = () => {};
  try {
    const response = await handleOrderRequest(post(order()), deps(db.store, mailbox({ ok: false, reason: "send-failed", detail: "x" }).send));
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /wasn't sent/);
  } finally { console.error = quiet; }
});

test("a repeated submission is acknowledged without a second email", async () => {
  const db = fakeStore({ duplicate: true });
  const mail = mailbox();
  const response = await handleOrderRequest(post(order()), deps(db.store, mail.send));
  assert.equal(response.status, 200);
  assert.equal(mail.sent.length, 0);
});

test("a loaf that sells out while the customer is filling in the form is refused clearly", async () => {
  const db = fakeStore({ saveError: new DbError("product_unavailable") });
  const response = await handleOrderRequest(post(order()), deps(db.store, mailbox().send));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /just became unavailable/);
});

test("validation: missing fields, unknown or sold-out loaves, oversized quantities, bad dates", async () => {
  const soldOut = fixtureSite({ products: [{ availability: "sold-out" }] });
  const cases: [Record<string, unknown>, string, typeof site?][] = [
    [{ name: "A", email: "nope", items: [] }, "items"],
    [{ items: [{ productId: "not-a-loaf", quantity: 1 }] }, "items"],
    [{ items: [{ productId: classic.id, quantity: 500 }] }, "items"],
    [{ pickupDate: "2020-01-01" }, "pickupDate"],
    [{}, "items", soldOut],
  ];
  for (const [extra, field, s] of cases) {
    const response = await handleOrderRequest(post(order(extra)), deps(fakeStore().store, mailbox().send, s ?? site));
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.ok((await response.json()).errors[field], field);
  }
});

test("pickup-date restrictions from the owner's settings are enforced", async () => {
  const saturdays = fixtureSite({ pickup: { weekdays: ["saturday"], minNoticeDays: 2 } });
  const friday = await handleOrderRequest(post(order({ pickupDate: "2027-12-03" })), deps(fakeStore().store, mailbox().send, saturdays));
  assert.equal(friday.status, 400);
  assert.match((await friday.json()).errors.pickupDate, /Saturdays/);
  const saturday = await handleOrderRequest(post(order({ pickupDate: "2027-12-04" })), deps(fakeStore().store, mailbox().send, saturdays));
  assert.equal(saturday.status, 200);
});

test("while ordering is closed, order and Club forms refuse and nothing is saved", async () => {
  const closed = fixtureSite({ ordersOpen: false });
  const db = fakeStore();
  for (const [handler, body] of [[handleOrderRequest, order()], [handleClubRequest, club()]] as const) {
    const response = await handler(post(body), deps(db.store, mailbox().send, closed));
    assert.equal(response.status, 409);
  }
  assert.equal(db.calls.length, 0);
});

test("a Club request is saved as an inquiry and the email says so", async () => {
  const db = fakeStore();
  const mail = mailbox();
  const response = await handleClubRequest(post(club()), deps(db.store, mail.send));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reference, "CL-ABC234");
  const saved = db.calls[0].payload as { requested_loaves: unknown };
  assert.deepEqual(saved.requested_loaves, [{ name: "Classic Sourdough", quantity: 2 }, { name: "Rosemary & Garlic", quantity: 1 }]);
  assert.match(renderEmail(mail.sent[0]).text, /inquiry, not an active subscription/);
  assert.match(renderEmail(mail.sent[0]).text, /\$50 \/ month — 3 loaves/);
});

test("Club: selections can't exceed the allowance; phone and terms are required", async () => {
  const over = await handleClubRequest(post(club({ selections: [{ productId: classic.id, quantity: 4 }] })), deps(fakeStore().store, mailbox().send));
  assert.match((await over.json()).errors.selections, /Remove 1/);
  const missing = await handleClubRequest(post(club({ phone: "", acceptedTerms: false })), deps(fakeStore().store, mailbox().send));
  const errors = (await missing.json()).errors;
  assert.ok(errors.phone && errors.acceptedTerms);
});

test("Club: refused when the plan isn't accepting requests", async () => {
  const full = fixtureSite({ plan: { accepting_requests: false } });
  const response = await handleClubRequest(post(club({ planId: full.plan!.id })), deps(fakeStore().store, mailbox().send, full));
  assert.equal(response.status, 409);
});

test("contact messages are saved; HTML in them is escaped in the email", async () => {
  const db = fakeStore();
  const mail = mailbox();
  const response = await handleContactRequest(
    post({ ...human(), name: "Fixture <b>Name</b>", email: "f@example.test", message: "Do you bake <script>alert(1)</script>?" }),
    deps(db.store, mail.send),
  );
  assert.equal(response.status, 200);
  assert.equal(db.calls[0].kind, "contact");
  assert.doesNotMatch(renderEmail(mail.sent[0]).html, /<script>/);
});

test("spam: honeypot is silently dropped, instant submissions are refused, repeat visitors are limited", async () => {
  const db = fakeStore();
  assert.equal((await handleOrderRequest(post({ ...order(), company: "Bot LLC" }), deps(db.store, mailbox().send))).status, 200);
  assert.equal(db.calls.length, 0);
  assert.equal((await handleOrderRequest(post({ ...order(), startedAt: Date.now() }), deps(db.store, mailbox().send))).status, 400);
  const limited = fakeStore({ rateOk: false });
  assert.equal((await handleOrderRequest(post(order()), deps(limited.store, mailbox().send))).status, 429);
  assert.equal(limited.calls.length, 0);
});

test("without a database, the in-memory rate limit applies", async () => {
  const mail = mailbox();
  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const response = await handleContactRequest(
      post({ ...human(), name: "Fixture", email: "f@example.test", message: "A fixture question." }, { "x-forwarded-for": "203.0.113.9" }),
      deps(null, mail.send),
    );
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test("malformed or non-JSON requests are rejected", async () => {
  assert.equal((await handleOrderRequest(post("{not json"), deps(null, mailbox().send))).status, 400);
  const form = new Request("https://example.test/api", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "x=1" });
  assert.equal((await handleOrderRequest(form, deps(null, mailbox().send))).status, 400);
});

/* ---------- Email delivery (mocked network) ---------- */

const email: OwnerEmail = { subject: "Test", replyTo: "customer@example.test", heading: "Test", rows: [["Name", "Fixture"]], note: "Note" };
const env = { RESEND_API_KEY: "re_test", ORDERS_TO_EMAIL: "owner@example.test" };
const quietly = async <T>(fn: () => Promise<T>) => { const q = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = q; } };

test("email: sends the right request to Resend", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  assert.deepEqual(await sendOwnerEmail(email, env, fakeFetch, 0), { ok: true });
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, ["owner@example.test"]);
  assert.equal(body.reply_to, "customer@example.test");
  assert.equal(body.from, "OnlyLoafs Website <onboarding@resend.dev>");
});

test("email: not configured → no network call", async () => {
  let called = false;
  const fakeFetch = (async () => { called = true; return new Response(); }) as unknown as typeof fetch;
  assert.equal((await sendOwnerEmail(email, {}, fakeFetch)).ok, false);
  assert.equal(called, false);
});

test("email: temporary failures are retried once; rejections are not", async () => {
  let attempts = 0;
  const flaky = (async () => { attempts += 1; return new Response("{}", { status: attempts === 1 ? 503 : 200 }); }) as unknown as typeof fetch;
  assert.deepEqual(await quietly(() => sendOwnerEmail(email, env, flaky, 0)), { ok: true });
  assert.equal(attempts, 2);

  attempts = 0;
  const rejecting = (async () => { attempts += 1; return new Response("{}", { status: 422 }); }) as unknown as typeof fetch;
  const result = await quietly(() => sendOwnerEmail(email, env, rejecting, 0));
  assert.deepEqual(result, { ok: false, reason: "send-failed", detail: "Resend answered HTTP 422" });
  assert.equal(attempts, 1);

  const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  assert.deepEqual(await quietly(() => sendOwnerEmail(email, env, offline, 0)), { ok: false, reason: "send-failed", detail: "Could not reach Resend" });
});

/* ---------- Small helpers the dashboard relies on ---------- */

test("prices are parsed and shown from cents", () => {
  assert.equal(parsePriceToCents("12"), 1200);
  assert.equal(parsePriceToCents("$12.50"), 1250);
  assert.equal(parsePriceToCents(""), null);
  assert.equal(parsePriceToCents("twelve"), undefined);
  assert.equal(parsePriceToCents("12.505"), undefined);
  assert.equal(formatCents(5000), "$50");
  assert.equal(formatCents(1250), "$12.50");
});

test("uploaded photos are identified by their contents, not their name", () => {
  assert.deepEqual(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), { contentType: "image/jpeg", extension: "jpg" });
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension, "png");
  assert.equal(sniffImage(new TextEncoder().encode("RIFF....WEBPVP8 "))?.extension, "webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("GIF89a")), null);
});
