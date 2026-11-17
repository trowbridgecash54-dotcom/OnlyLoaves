import { redirect } from "next/navigation";
import { getSessionUser, isBackendConfigured, sessionDb, sessionFiles } from "../backend";
import { Store } from "../store";
import type { AdminCheck } from "./http";

/**
 * Who is asking, and are they an owner?
 *
 * Three things must all be true before any dashboard page renders or
 * any dashboard action runs:
 *   - a database is connected,
 *   - the visitor's session is valid (checked with Supabase Auth, not
 *     just read from a cookie),
 *   - their user id is listed in the admins table.
 *
 * The Store handed back uses that owner's own session, so the database
 * re-checks the same thing on every query through row-level security.
 */
export async function checkAdmin(): Promise<AdminCheck> {
  if (!isBackendConfigured()) return { status: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { status: "signed-out" };
  const store = new Store(await sessionDb(), await sessionFiles());
  if (!(await store.isAdmin())) return { status: "not-admin" };
  return { status: "ok", store, email: user.email };
}

/** For dashboard pages: returns the owner's Store, or sends the visitor to sign in. */
export async function requireAdmin(): Promise<{ store: Store; email: string }> {
  const check = await checkAdmin();
  if (check.status === "ok") return check;
  redirect(check.status === "not-admin" ? "/admin/login?error=not-authorized" : "/admin/login");
}
