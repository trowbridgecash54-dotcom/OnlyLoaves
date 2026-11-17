/**
 * The dashboard's front door: who may submit dashboard forms, and what
 * happens when they aren't allowed. Uses stand-ins for sign-in; the
 * database's own enforcement is tested in tests/db.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runAdminAction, type AdminCheck, type AdminHttpDeps } from "@/lib/admin/http";
import { resetRateLimit } from "@/lib/spam";
import type { Store } from "@/lib/store";

function form(fields: Record<string, string>, origin = "https://shop.example.test") {
  const body = new URLSearchParams(fields);
  return new Request("https://shop.example.test/admin/do/x", {
    method: "POST",
    headers: { origin, host: "shop.example.test", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function deps(check: AdminCheck, extra: Partial<AdminHttpDeps> = {}) {
  const log: string[] = [];
  const value: AdminHttpDeps = {
    check: async () => check,
    signIn: async () => { log.push("signIn"); return true; },
    signOut: async () => { log.push("signOut"); },
    afterChange: () => log.push("revalidate"),
    timeZone: async () => "America/Los_Angeles",
    ...extra,
  };
  return { value, log };
}

const location = (response: Response) => decodeURIComponent((response.headers.get("location") ?? "").replace(/\+/g, " "));

/** A Store stand-in that records order updates. */
function ownerStore() {
  const updates: unknown[] = [];
  const store = { updateOrder: async (id: string, patch: unknown) => { updates.push({ id, patch }); } } as unknown as Store;
  return { store, updates };
}

test("requests from another website are refused before anything else", async () => {
  const { store } = ownerStore();
  const { value, log } = deps({ status: "ok", store, email: "owner@example.test" });
  const response = await runAdminAction(form({ id: "1", status: "confirmed" }, "https://evil.example"), "order-update", value);
  assert.equal(response.status, 403);
  assert.deepEqual(log, []);
});

test("signed-out visitors are sent to sign in and nothing changes", async () => {
  const { value, log } = deps({ status: "signed-out" });
  const response = await runAdminAction(form({ id: "1", status: "confirmed" }), "order-update", value);
  assert.equal(response.status, 303);
  assert.match(location(response), /^\/admin\/login\?error=Sign in to continue/);
  assert.deepEqual(log, []);
});

test("a signed-in account that isn't an owner is refused", async () => {
  const { value } = deps({ status: "not-admin" });
  const response = await runAdminAction(form({ id: "1", status: "confirmed" }), "order-update", value);
  assert.match(location(response), /isn't authorized/);
});

test("an owner's change is applied and the public pages are refreshed", async () => {
  const { store, updates } = ownerStore();
  const { value, log } = deps({ status: "ok", store, email: "owner@example.test" });
  const response = await runAdminAction(form({ id: "order-1", status: "ready", owner_notes: "Fixture" }), "order-update", value);
  assert.equal(location(response), "/admin/orders?ok=Order updated.");
  assert.deepEqual(updates, [{ id: "order-1", patch: { status: "ready", owner_notes: "Fixture" } }]);
  assert.deepEqual(log, ["revalidate"]);
});

test("invalid input comes back as a plain message, and the redirect stays inside the dashboard", async () => {
  const { store, updates } = ownerStore();
  const { value } = deps({ status: "ok", store, email: "owner@example.test" });
  const bad = await runAdminAction(form({ id: "order-1", status: "shipped", _back: "/admin/orders" }), "order-update", value);
  assert.equal(location(bad), "/admin/orders?error=Choose a valid status.");
  assert.deepEqual(updates, []);

  const sneaky = await runAdminAction(form({ id: "1", status: "nope", _back: "https://evil.example/" }), "order-update", value);
  assert.match(location(sneaky), /^\/admin\?error=/);
});

test("unknown actions are refused", async () => {
  const { store } = ownerStore();
  const { value } = deps({ status: "ok", store, email: "owner@example.test" });
  assert.match(location(await runAdminAction(form({}), "drop-everything", value)), /isn't available/);
});

test("sign-in: wrong password gets one generic message", async () => {
  resetRateLimit();
  const { value } = deps({ status: "signed-out" }, { signIn: async () => false });
  const response = await runAdminAction(form({ email: "owner@example.test", password: "wrong" }), "login", value);
  assert.match(location(response), /don't match an owner account/);
});

test("sign-in: a real account that isn't an owner is signed straight back out", async () => {
  resetRateLimit();
  const { value, log } = deps({ status: "not-admin" });
  const response = await runAdminAction(form({ email: "someone@example.test", password: "pw" }), "login", value);
  assert.match(location(response), /isn't authorized/);
  assert.deepEqual(log, ["signIn", "signOut"]);
});

test("sign-in: an owner lands on the dashboard", async () => {
  resetRateLimit();
  const { store } = ownerStore();
  const { value } = deps({ status: "ok", store, email: "owner@example.test" });
  assert.equal(location(await runAdminAction(form({ email: "owner@example.test", password: "pw" }), "login", value)), "/admin");
});

test("sign-in attempts are rate limited", async () => {
  resetRateLimit();
  const { value } = deps({ status: "signed-out" }, { signIn: async () => false });
  let last = "";
  for (let i = 0; i < 6; i += 1) last = location(await runAdminAction(form({ email: "x@example.test", password: "x" }), "login", value));
  assert.match(last, /Too many sign-in attempts/);
});
