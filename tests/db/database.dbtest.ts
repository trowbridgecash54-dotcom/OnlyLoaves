/**
 * DATABASE TESTS — run with `npm run test:db`.
 *
 * These run the real migrations on a local PostgreSQL and drive them
 * through the same Store the website uses, as each kind of caller:
 * a visitor (anon), the website's server (service_role), a signed-in
 * owner, and a signed-in user who is NOT an owner.
 *
 * All names and addresses below are made-up fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { DbError } from "@/lib/db";
import { Store } from "@/lib/store";
import { psqlDb, sql } from "../support/psql-db";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log("TEST_DATABASE_URL is not set — skipping database tests. See README, “Database tests”.");
  process.exit(0);
}

const ownerId = randomUUID();
const strangerId = randomUUID();
const visitor = new Store(psqlDb(url, { role: "anon" }));
const server = new Store(psqlDb(url, { role: "service_role" }));
const owner = new Store(psqlDb(url, { role: "authenticated", userId: ownerId }));
const stranger = new Store(psqlDb(url, { role: "authenticated", userId: strangerId }));

const rejects = (promise: Promise<unknown>, message: RegExp) =>
  assert.rejects(promise, (error: unknown) => error instanceof DbError && message.test(error.message));

let classic = "";
let planId = "";

const order = (overrides: Record<string, unknown> = {}) => ({
  idempotency_key: randomUUID(),
  name: "Fixture Customer",
  email: "customer@example.test",
  phone: "",
  pickup_date: "2027-01-09",
  notes: "",
  items: [{ product_id: classic, quantity: 2 }],
  ...overrides,
});

const inquiry = (overrides: Record<string, unknown> = {}) => ({
  idempotency_key: randomUUID(),
  plan_id: planId,
  name: "Fixture Member",
  email: "member@example.test",
  phone: "555 0100",
  pickup_day: "saturday",
  first_pickup_date: "2027-01-09",
  requested_loaves: [{ name: "Classic Sourdough", quantity: 3 }],
  bread_preferences: "",
  requests: "",
  ...overrides,
});

before(() => {
  sql(url, `
    truncate public.orders, public.subscription_inquiries, public.subscriptions, public.contact_messages,
             public.rate_limit_hits, public.settings, public.pickup_closures, public.admins cascade;
    delete from auth.users;
    insert into auth.users (id, email) values ('${ownerId}', 'owner@example.test'), ('${strangerId}', 'stranger@example.test');
    insert into public.admins (user_id, email) values ('${ownerId}', 'owner@example.test');
    update public.subscription_plans set price_cents = 5000, loaves_per_period = 3, max_subscribers = null, accepting_requests = true, enabled = true;
    delete from public.products where slug not in ('classic-sourdough', 'rosemary-garlic', 'cinnamon-sourdough');
    update public.products set archived_at = null, availability = 'available';
  `);
});

test("visitors can read the catalog and plan, and nothing private", async () => {
  const products = await visitor.products();
  assert.equal(products.length, 3);
  classic = products.find((product) => product.slug === "classic-sourdough")!.id;
  const [plan] = await visitor.plans();
  planId = plan.id;
  assert.equal(plan.price_cents, 5000);
  assert.equal(plan.loaves_per_period, 3);

  await server.submitOrder(order());
  await rejects(visitor.orders(), /permission denied/);
  await rejects(visitor.inquiries(), /permission denied/);
  await rejects(visitor.messages(), /permission denied/);
  await rejects(visitor.subscriptions(), /permission denied/);
  assert.equal(await visitor.isAdmin(), false);
});

test("visitors cannot save forms directly or run owner functions", async () => {
  await rejects(visitor.submitOrder(order()), /permission denied/);
  await rejects(visitor.submitContact({ idempotency_key: randomUUID(), name: "x", email: "x@example.test", message: "hello there" }), /permission denied/);
  await rejects(visitor.approveInquiry(randomUUID(), "2027-01-01", ""), /permission denied/);
  await rejects(visitor.saveProduct(null, { slug: "sneaky", name: "Sneaky" }), /permission denied/);
  await rejects(visitor.saveSetting("business", { ordersOpen: true }, true), /permission denied/);
});

test("a signed-in user who is not an owner gets no private data and can change nothing", async () => {
  assert.equal(await stranger.isAdmin(), false);
  assert.deepEqual(await stranger.orders(), []);
  assert.deepEqual(await stranger.inquiries(), []);
  assert.deepEqual(await stranger.messages(), []);
  await rejects(stranger.saveProduct(null, { slug: "sneaky", name: "Sneaky" }), /row-level security/);
  await rejects(stranger.saveSetting("business", { ordersOpen: true }, true), /row-level security/);
  // Updates and deletes match no rows for a non-owner.
  await assert.rejects(stranger.updateOrder((await owner.orders())[0].id, { status: "confirmed" }), /order_not_found/);
  await stranger.deleteProduct(classic);
  assert.equal((await visitor.products()).length, 3);
  await rejects(stranger.approveInquiry(randomUUID(), "2027-01-01", ""), /not_authorized/);
});

test("nobody can make themselves an owner through the API", async () => {
  const strangerDb = psqlDb(url, { role: "authenticated", userId: strangerId });
  await rejects(strangerDb.insert("admins", { user_id: strangerId, email: "stranger@example.test" }), /permission denied/);
  assert.equal(await stranger.isAdmin(), false);
  assert.equal(await owner.isAdmin(), true);
});

test("private settings stay private; public settings are readable", async () => {
  await owner.saveSetting("business", { announcement: "Fixture notice" }, true);
  await owner.saveSetting("pickup_private", { address: "FIXTURE PRIVATE ADDRESS" }, false);
  const seenByVisitor = await visitor.settings();
  assert.deepEqual(seenByVisitor.business, { announcement: "Fixture notice" });
  assert.equal("pickup_private" in seenByVisitor, false);
  assert.equal("pickup_private" in (await stranger.settings()), false);
  assert.equal("pickup_private" in (await owner.settings()), true);
});

test("product management: add, edit, archive, delete", async () => {
  const added = await owner.saveProduct(null, { slug: "fixture-loaf", name: "Fixture Loaf", price_cents: 1250, sort_order: 5 });
  assert.equal((await visitor.products())[0].slug, "fixture-loaf");
  await owner.saveProduct(added.id, { price_cents: null, availability: "sold-out", ingredients: "Fixture ingredients" });
  const edited = (await visitor.products()).find((product) => product.id === added.id)!;
  assert.equal(edited.price_cents, null);
  assert.equal(edited.availability, "sold-out");

  await owner.archiveProduct(added.id, true);
  assert.equal((await visitor.products()).some((product) => product.id === added.id), false);
  assert.equal((await owner.products()).some((product) => product.id === added.id), true);

  await owner.deleteProduct(added.id);
  assert.equal((await owner.products()).some((product) => product.id === added.id), false);
  await rejects(owner.saveProduct(null, { slug: "Bad Slug", name: "x" }), /check constraint/);
});

test("orders: saved with a reference and price snapshot; duplicates collapse", async () => {
  const input = order({ items: [{ product_id: classic, quantity: 2 }] });
  const first = await server.submitOrder(input);
  assert.match(first.reference, /^OL-[A-Z2-9]{6}$/);
  assert.equal(first.duplicate, false);

  const again = await server.submitOrder(input);
  assert.equal(again.duplicate, true);
  assert.equal(again.reference, first.reference);

  const saved = (await owner.orders()).find((row) => row.id === first.id)!;
  assert.equal(saved.status, "new");
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].product_name, "Classic Sourdough");
  assert.equal(saved.items[0].quantity, 2);
  assert.equal(saved.notification_status, "pending");
});

test("orders: unavailable or archived loaves are refused and nothing is half-saved", async () => {
  const before = (await owner.orders()).length;
  await owner.saveProduct(classic, { availability: "sold-out" });
  await rejects(server.submitOrder(order()), /product_unavailable/);
  await owner.saveProduct(classic, { availability: "available" });
  await rejects(server.submitOrder(order({ items: [{ product_id: randomUUID(), quantity: 1 }] })), /product_unavailable/);
  await rejects(server.submitOrder(order({ items: [] })), /no_items/);
  assert.equal((await owner.orders()).length, before);
});

test("orders: the owner changes status; notification results are recorded", async () => {
  const saved = await server.submitOrder(order());
  await server.setNotification("order", saved.id, "failed", "HTTP 500");
  await owner.updateOrder(saved.id, { status: "ready", owner_notes: "Fixture note" });
  const row = (await owner.orders()).find((candidate) => candidate.id === saved.id)!;
  assert.equal(row.status, "ready");
  assert.equal(row.notification_status, "failed");
  assert.equal(row.notification_error, "HTTP 500");
  await rejects(owner.updateOrder(saved.id, { status: "shipped" }), /check constraint/);
});

test("contact messages are stored, de-duplicated and resolvable", async () => {
  const input = { idempotency_key: randomUUID(), name: "Fixture Customer", email: "customer@example.test", message: "A fixture question." };
  const first = await server.submitContact(input);
  const again = await server.submitContact(input);
  assert.equal(again.duplicate, true);
  assert.equal(again.id, first.id);
  await owner.updateMessage(first.id, { status: "resolved", resolved_at: new Date().toISOString() });
  const row = (await owner.messages()).find((message) => message.id === first.id)!;
  assert.equal(row.status, "resolved");
});

test("rate limiting counts per visitor bucket", async () => {
  const bucket = `fixture:${randomUUID()}`;
  const results = [];
  for (let attempt = 0; attempt < 4; attempt += 1) results.push(await server.rateLimit(bucket, 3, 600));
  assert.deepEqual(results, [true, true, true, false]);
  assert.equal(await server.rateLimit(`fixture:${randomUUID()}`, 3, 600), true);
});

test("an enrollment request is only an inquiry: no subscription, no allowance", async () => {
  const saved = await server.submitInquiry(inquiry());
  assert.match(saved.reference, /^CL-[A-Z2-9]{6}$/);
  assert.equal((await server.submitInquiry(inquiry({ idempotency_key: randomUUID() }))).duplicate, false);
  assert.deepEqual(await owner.subscriptions(), []);
  const row = (await owner.inquiries()).find((candidate) => candidate.id === saved.id)!;
  assert.equal(row.status, "inquiry");
  assert.equal(row.subscription_id, null);
});

test("enrollment is refused while the plan is closed", async () => {
  await owner.savePlan(planId, { accepting_requests: false });
  await rejects(server.submitInquiry(inquiry()), /enrollment_closed/);
  await owner.savePlan(planId, { accepting_requests: true });
});

test("approval creates the subscription once, copies the plan terms, and respects the limit", async () => {
  const [first, second] = await owner.inquiries();
  const subscriptionId = await owner.approveInquiry(first.id, "2027-01-05", "");
  const subscription = (await owner.subscription(subscriptionId))!;
  assert.equal(subscription.status, "active");
  assert.equal(subscription.price_cents, 5000);
  assert.equal(subscription.loaves_per_period, 3);
  assert.equal(subscription.pickup_day, "saturday");
  assert.equal((await owner.inquiries()).find((row) => row.id === first.id)!.status, "approved");
  // No allowance period and no payment exist just because of approval.
  assert.deepEqual(await owner.periods({ subscriptionId }), []);

  await rejects(owner.approveInquiry(first.id, "2027-01-05", ""), /inquiry_already_decided/);

  await owner.savePlan(planId, { max_subscribers: 1 });
  await rejects(owner.approveInquiry(second.id, "2027-01-05", ""), /subscriber_limit_reached/);
  await owner.savePlan(planId, { max_subscribers: null });

  // Later plan changes don't alter what an existing member was promised.
  await owner.savePlan(planId, { price_cents: 6500, loaves_per_period: 4 });
  assert.equal((await owner.subscription(subscriptionId))!.price_cents, 5000);
  await owner.savePlan(planId, { price_cents: 5000, loaves_per_period: 3 });
});

test("allowance: 3 → 2 → 1 → 0, then blocked; duplicates don't count; extras are explicit", async () => {
  const [subscription] = await owner.subscriptions();
  const period = await owner.ensurePeriod(subscription.id, "2027-01-01", "2027-01-31");
  assert.equal(period.allowance, 3);
  assert.equal((await owner.ensurePeriod(subscription.id, "2027-01-01", "2027-01-31")).id, period.id);

  const used = async () =>
    (await owner.fulfillments({ periodIds: [period.id] })).filter((row) => row.voided_at === null).length;
  const loaf = (key: string, asExtra = false) =>
    owner.fulfillLoaf({ periodId: period.id, productId: classic, fulfilledOn: "2027-01-09", idempotencyKey: key, asExtra });

  const key = randomUUID();
  assert.equal((await loaf(key)).duplicate, false);
  assert.equal(await used(), 1);
  // The same click arriving twice is recorded once.
  assert.equal((await loaf(key)).duplicate, true);
  assert.equal(await used(), 1);

  await loaf(randomUUID());
  await loaf(randomUUID());
  assert.equal(await used(), 3);

  await rejects(loaf(randomUUID()), /allowance_exhausted/);
  assert.equal(await used(), 3);

  const extra = await loaf(randomUUID(), true);
  assert.equal(extra.is_extra, true);
  assert.equal(await used(), 4);
  await rejects(loaf(randomUUID()), /allowance_exhausted/);

  await rejects(
    owner.fulfillLoaf({ periodId: period.id, productId: classic, fulfilledOn: "2027-02-02", idempotencyKey: randomUUID(), asExtra: false }),
    /date_outside_period/,
  );
  const recorded = (await owner.fulfillments({ periodIds: [period.id] }))[0];
  assert.equal(recorded.product_name, "Classic Sourdough");
});

test("fulfillment records are permanent: void gives the loaf back, delete is refused", async () => {
  const [subscription] = await owner.subscriptions();
  const [period] = await owner.periods({ subscriptionId: subscription.id });
  const rows = await owner.fulfillments({ periodIds: [period.id] });
  const normal = rows.find((row) => !row.is_authorized_extra)!;
  await owner.voidFulfillment(normal.id, "Fixture mistake");
  const after = await owner.fulfillments({ periodIds: [period.id] });
  assert.equal(after.length, rows.length);
  assert.equal(after.filter((row) => row.voided_at === null).length, rows.length - 1);

  const ownerDb = psqlDb(url, { role: "authenticated", userId: ownerId });
  await rejects(ownerDb.remove("fulfillments", { id: normal.id }), /fulfillments_are_permanent/);
  await rejects(ownerDb.update("fulfillments", { id: normal.id }, { fulfilled_on: "2027-01-10" }), /fulfillments_are_permanent/);
});

test("a direct insert can't bypass the allowance either", async () => {
  const [subscription] = await owner.subscriptions();
  const period = await owner.ensurePeriod(subscription.id, "2027-03-01", "2027-03-31");
  const ownerDb = psqlDb(url, { role: "authenticated", userId: ownerId });
  const row = () => ({ subscription_id: subscription.id, period_id: period.id, fulfilled_on: "2027-03-02", idempotency_key: randomUUID() });
  await ownerDb.insert("fulfillments", row());
  await ownerDb.insert("fulfillments", row());
  await ownerDb.insert("fulfillments", row());
  await rejects(ownerDb.insert("fulfillments", row()), /allowance_exhausted/);
});

test("paused, canceled and not-yet-started memberships get no allowance", async () => {
  const [subscription] = await owner.subscriptions();
  const [period] = await owner.periods({ subscriptionId: subscription.id });

  await owner.updateSubscription(subscription.id, { status: "paused", paused_on: "2027-01-20" });
  await rejects(owner.ensurePeriod(subscription.id, "2027-02-01", "2027-02-28"), /subscription_not_active/);
  await rejects(
    owner.fulfillLoaf({ periodId: period.id, productId: null, fulfilledOn: "2027-03-03", idempotencyKey: randomUUID(), asExtra: true }),
    /subscription_not_active/,
  );

  await owner.updateSubscription(subscription.id, { status: "canceled", canceled_on: "2027-01-25" });
  await rejects(owner.ensurePeriod(subscription.id, "2027-02-01", "2027-02-28"), /subscription_not_active/);

  await owner.updateSubscription(subscription.id, { status: "active", paused_on: null, canceled_on: null });
  // Started January 5: December has no allowance.
  await rejects(owner.ensurePeriod(subscription.id, "2026-12-01", "2026-12-31"), /subscription_not_active/);
  // A new month starts fresh at the plan allowance; nothing is carried over.
  assert.equal((await owner.ensurePeriod(subscription.id, "2027-02-01", "2027-02-28")).allowance, 3);
});

test("payment status is recorded by hand on the period", async () => {
  const [subscription] = await owner.subscriptions();
  const period = await owner.ensurePeriod(subscription.id, "2027-02-01", "2027-02-28");
  assert.equal(period.payment_status, "unpaid");
  await owner.updatePeriod(period.id, { payment_status: "paid", paid_on: "2027-02-01", payment_note: "Fixture: cash" });
  const saved = (await owner.periods({ subscriptionId: subscription.id })).find((row) => row.id === period.id)!;
  assert.equal(saved.payment_status, "paid");
});

test("pickup closures are public to read and owner-only to change", async () => {
  await owner.addClosure("2027-12-25", "Fixture holiday");
  assert.deepEqual((await visitor.closures()).map((row) => row.closed_on), ["2027-12-25"]);
  await rejects(visitor.addClosure("2027-12-26", ""), /permission denied/);
  await owner.removeClosure("2027-12-25");
  assert.deepEqual(await visitor.closures(), []);
});

test("photo storage rules: owners only", async () => {
  const insert = (userId: string) =>
    psqlDb(url, { role: "authenticated", userId }).rpc("is_admin").then(() =>
      sql(url, `begin; set local role authenticated; set local "request.jwt.claims" = '{"sub":"${userId}"}';
        insert into storage.objects (bucket_id, name) values ('photos', 'products/${randomUUID()}.jpg'); commit;`),
    );
  await insert(ownerId);
  await assert.rejects(insert(strangerId), /row-level security/);
  assert.equal(sql(url, "select file_size_limit || ' ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'photos'"), "5242880 image/jpeg,image/png,image/webp");
});
