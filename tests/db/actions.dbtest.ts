/**
 * DATABASE TESTS for the dashboard's actions — run with `npm run test:db`.
 * Each action runs exactly as it does in the dashboard, through the
 * owner's Store, against a local PostgreSQL with the real migrations.
 * Fixture data only.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, test } from "node:test";
import { actions, explain, type ActionContext } from "@/lib/admin/actions";
import { Store } from "@/lib/store";
import { folderFiles, psqlDb, sql } from "../support/psql-db";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log("TEST_DATABASE_URL is not set — skipping database tests.");
  process.exit(0);
}

const ownerId = randomUUID();
const photoDir = mkdtempSync(join(tmpdir(), "onlyloafs-photos-"));
const owner = new Store(psqlDb(url, { role: "authenticated", userId: ownerId }), folderFiles(photoDir));
const visitor = new Store(psqlDb(url, { role: "anon" }));
const server = new Store(psqlDb(url, { role: "service_role" }));
const context: ActionContext = { store: owner, today: "2027-01-12" };

function form(fields: Record<string, string | string[] | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.append(key, value);
  }
  return data;
}

async function run(name: string, fields: Record<string, string | string[] | File>) {
  try {
    return { ok: (await actions[name](form(fields), context)).ok, error: "" };
  } catch (error) {
    return { ok: "", error: explain(error) };
  }
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "loaf.jpg", { type: "image/jpeg" });

before(() => {
  sql(url, `
    truncate public.orders, public.subscription_inquiries, public.subscriptions, public.contact_messages,
             public.settings, public.pickup_closures, public.admins cascade;
    delete from storage.objects;
    delete from auth.users;
    insert into auth.users (id, email) values ('${ownerId}', 'owner@example.test');
    insert into public.admins (user_id, email) values ('${ownerId}', 'owner@example.test');
    delete from public.products where slug not in ('classic-sourdough', 'rosemary-garlic', 'cinnamon-sourdough');
    update public.products set archived_at = null, availability = 'available', price_cents = null, image_path = null;
    update public.subscription_plans set price_cents = 5000, loaves_per_period = 3, max_subscribers = null, accepting_requests = true;
  `);
});

test("add a loaf with a photo; edit its price; replace and remove the photo", async () => {
  const added = await run("product-save", {
    name: "Fixture Seeded Loaf", price: "", availability: "available", description: "Fixture.",
    ingredients: "", allergens: "", sort_order: "5", club_eligible: "on", photo: jpeg(), image_alt: "Fixture photo",
  });
  assert.equal(added.error, "");
  const product = (await visitor.products()).find((p) => p.slug === "fixture-seeded-loaf")!;
  assert.equal(product.price_cents, null);
  assert.match(product.image_path!, /^products\/[0-9a-f-]+\.jpg$/);
  assert.ok(existsSync(join(photoDir, product.image_path!)));

  await run("product-save", { id: product.id, name: product.name, price: "12.50", availability: "sold-out", sort_order: "5", photo: jpeg() });
  const edited = (await visitor.products()).find((p) => p.id === product.id)!;
  assert.equal(edited.price_cents, 1250);
  assert.equal(edited.availability, "sold-out");
  assert.notEqual(edited.image_path, product.image_path);
  assert.equal(existsSync(join(photoDir, product.image_path!)), false, "old photo removed");

  await run("product-save", { id: product.id, name: product.name, price: "12.50", availability: "available", sort_order: "5", remove_photo: "on" });
  assert.equal((await visitor.products()).find((p) => p.id === product.id)!.image_path, null);
});

test("photo uploads are checked: wrong type and oversize are refused", async () => {
  const svg = new File(["<svg onload=alert(1)>"], "evil.jpg", { type: "image/jpeg" });
  assert.match((await run("product-save", { name: "Bad Photo", availability: "available", photo: svg })).error, /isn't a JPEG, PNG or WebP/);
  const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" });
  assert.match((await run("product-save", { name: "Huge Photo", availability: "available", photo: huge })).error, /larger than 5 MB/);
  assert.equal((await owner.products()).some((p) => p.name.endsWith("Photo")), false);
});

test("product validation and duplicate names", async () => {
  assert.match((await run("product-save", { name: "", availability: "available" })).error, /can't be empty/);
  assert.match((await run("product-save", { name: "X", price: "ten", availability: "available" })).error, /price as a number/);
  assert.match((await run("product-save", { name: "Classic Sourdough", availability: "available" })).error, /already exists/);
});

test("archive, restore and delete a loaf", async () => {
  const product = (await owner.products()).find((p) => p.slug === "fixture-seeded-loaf")!;
  await run("product-archive", { id: product.id, archived: "1" });
  assert.equal((await visitor.products()).some((p) => p.id === product.id), false);
  await run("product-archive", { id: product.id, archived: "0" });
  assert.equal((await visitor.products()).some((p) => p.id === product.id), true);
  assert.match((await run("product-delete", { id: product.id })).error, /Tick the box/);
  await run("product-delete", { id: product.id, confirm: "on" });
  assert.equal((await owner.products()).some((p) => p.id === product.id), false);
});

test("order status changes persist", async () => {
  const classic = (await visitor.products()).find((p) => p.slug === "classic-sourdough")!;
  const saved = await server.submitOrder({
    idempotency_key: randomUUID(), name: "Fixture Customer", email: "c@example.test", phone: "", pickup_date: "2027-01-16", notes: "",
    items: [{ product_id: classic.id, quantity: 1 }],
  });
  for (const status of ["confirmed", "preparing", "ready", "completed"]) {
    await run("order-update", { id: saved.id, status, owner_notes: "" });
    assert.equal((await owner.orders()).find((o) => o.id === saved.id)!.status, status);
  }
});

test("Club: approval needs the confirmation tick, then tracks loaves without double counting", async () => {
  const [plan] = await visitor.plans();
  const inquiry = await server.submitInquiry({
    idempotency_key: randomUUID(), plan_id: plan.id, name: "Fixture Member", email: "m@example.test", phone: "555 0100",
    pickup_day: "saturday", first_pickup_date: "2027-01-09", requested_loaves: [], bread_preferences: "", requests: "",
  });
  assert.match((await run("inquiry-approve", { id: inquiry.id, started_on: "2027-01-09" })).error, /Tick the box/);
  assert.equal((await owner.subscriptions()).length, 0);

  assert.match((await run("inquiry-approve", { id: inquiry.id, started_on: "2027-01-09", pickup_day: "", confirmed: "on" })).ok, /No payment has been recorded/);
  const [member] = await owner.subscriptions();

  const key = randomUUID();
  assert.equal((await run("loaf-fulfill", { subscription_id: member.id, key, fulfilled_on: "2027-01-12" })).ok, "Loaf recorded.");
  assert.match((await run("loaf-fulfill", { subscription_id: member.id, key, fulfilled_on: "2027-01-12" })).ok, /already recorded/);
  await run("loaf-fulfill", { subscription_id: member.id, key: randomUUID() });
  await run("loaf-fulfill", { subscription_id: member.id, key: randomUUID() });
  assert.match((await run("loaf-fulfill", { subscription_id: member.id, key: randomUUID() })).error, /already been recorded/);
  assert.match((await run("loaf-fulfill", { subscription_id: member.id, key: randomUUID(), as_extra: "on" })).ok, /additional purchase/);

  const [period] = await owner.periods({ subscriptionId: member.id });
  const rows = await owner.fulfillments({ periodIds: [period.id] });
  assert.equal(rows.length, 4);
  assert.equal(rows.filter((row) => row.is_authorized_extra).length, 1);

  await run("loaf-void", { subscription_id: member.id, id: rows.find((r) => !r.is_authorized_extra)!.id });
  assert.equal((await owner.fulfillments({ periodIds: [period.id] })).filter((r) => !r.voided_at).length, 3);

  await run("period-update", { subscription_id: member.id, payment_status: "paid", paid_on: "2027-01-09", payment_note: "Fixture" });
  assert.equal((await owner.periods({ subscriptionId: member.id }))[0].payment_status, "paid");

  await run("subscription-update", { id: member.id, status: "paused", pickup_day: "saturday" });
  assert.match((await run("loaf-fulfill", { subscription_id: member.id, key: randomUUID(), fulfilled_on: "2027-02-06" })).error, /isn't active/);
  assert.equal((await owner.subscription(member.id))!.paused_on, "2027-01-12");
});

test("plan and policies are editable; the subscriber limit is enforced", async () => {
  const [plan] = await owner.plans();
  const saved = await run("plan-save", {
    id: plan.id, name: "OnlyLoafs Club", price: "55", loaves_per_period: "4", max_subscribers: "1", enabled: "on",
    accepting_requests: "on", selection_mode: "choose", tracking_period: "calendar-month", unused_loaf_policy: "undecided", closed_message: "",
  });
  assert.equal(saved.error, "");
  const after = (await visitor.plans())[0];
  assert.deepEqual([after.price_cents, after.loaves_per_period, after.max_subscribers], [5500, 4, 1]);

  const inquiry = await server.submitInquiry({
    idempotency_key: randomUUID(), plan_id: plan.id, name: "Second Fixture", email: "s@example.test", phone: "555 0101",
    pickup_day: "flexible", first_pickup_date: "2027-01-16", requested_loaves: [], bread_preferences: "", requests: "",
  });
  assert.match((await run("inquiry-approve", { id: inquiry.id, started_on: "2027-01-16", confirmed: "on" })).error, /subscriber limit/);

  await run("policies-save", { payment: "Fixture payment policy.", renewal: "", pauseAndCancel: "", missedPickup: "", unusedLoaves: "", refunds: "" });
  assert.equal(((await visitor.settings()).policies as { payment: string }).payment, "Fixture payment policy.");
});

test("pickup settings: public parts are public, the address stays private", async () => {
  await run("pickup-save", {
    timeZone: "America/Los_Angeles", weekdays: ["friday", "saturday"], minNoticeDays: "2", maxAdvanceDays: "30",
    area: "Fixture Neighborhood", instructions: "", private_address: "FIXTURE PRIVATE ADDRESS", private_instructions: "",
  });
  const publicSettings = await visitor.settings();
  assert.deepEqual((publicSettings.pickup as { weekdays: string[] }).weekdays, ["friday", "saturday"]);
  assert.equal(JSON.stringify(publicSettings).includes("FIXTURE PRIVATE ADDRESS"), false);
  assert.match(JSON.stringify(await owner.settings()), /FIXTURE PRIVATE ADDRESS/);
  assert.match((await run("pickup-save", { timeZone: "Mars/Olympus" })).error, /time zone/);

  await run("closure-add", { closed_on: "2027-12-25", note: "" });
  assert.deepEqual((await visitor.closures()).map((c) => c.closed_on), ["2027-12-25"]);
});

test("website settings save and validate", async () => {
  assert.match((await run("business-save", { name: "OnlyLoafs", instagramUrl: "not a link" })).error, /Instagram link/);
  assert.match((await run("business-save", { name: "OnlyLoafs", email: "nope" })).error, /contact email/);
  await run("business-save", { name: "OnlyLoafs", announcement: "Fixture notice", disclosures: "Line one\n\nLine two", ordersOpen: "on" });
  const business = (await visitor.settings()).business as { announcement: string; disclosures: string[]; ordersOpen: boolean };
  assert.deepEqual([business.announcement, business.disclosures, business.ordersOpen], ["Fixture notice", ["Line one", "Line two"], true]);

  await run("story-save", { intro: "Fixture intro.", howItStarted: "", whyBaking: "", process: "", whyUs: "", bakerName: "", photo: jpeg() });
  const story = (await visitor.settings()).story as { intro: string; image: string };
  assert.equal(story.intro, "Fixture intro.");
  assert.match(story.image, /^site\//);
});
