import { todayInTimeZone } from "../pickup";
import { allowRequest } from "../spam";
import type { Store } from "../store";
import { actions, explain } from "./actions";

/**
 * Handles every form the dashboard submits (POST /admin/do/<action>).
 *
 * Order of checks, none of which can be skipped:
 *   1. The request must come from this website (same-origin check).
 *   2. The session is verified with the auth server.
 *   3. The signed-in user must be listed as an administrator.
 *   4. The action runs through the owner's own database connection, so
 *      row-level security applies to it as well.
 *
 * Every outcome is a redirect back to a dashboard page carrying a short
 * message, so the forms work as ordinary web forms.
 */

export type AdminCheck =
  | { status: "ok"; store: Store; email: string }
  | { status: "not-configured" | "signed-out" | "not-admin" };

export type AdminHttpDeps = {
  check: () => Promise<AdminCheck>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Called after a successful change so public pages pick it up. */
  afterChange: () => void;
  timeZone: () => Promise<string>;
};

function redirect(path: string, params: Record<string, string> = {}): Response {
  const query = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 303,
    headers: { Location: query ? `${path}?${query}` : path, "Cache-Control": "no-store" },
  });
}

/**
 * Browsers attach an Origin header to every form POST. Requiring it to
 * match this site's own host stops other websites from submitting
 * dashboard forms on a signed-in owner's behalf.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Only ever send the owner back to a page inside the dashboard. */
function safeBack(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return /^\/admin(\/[A-Za-z0-9\-/]*)?$/.test(path) ? path : fallback;
}

export async function runAdminAction(
  request: Request,
  name: string,
  deps: AdminHttpDeps,
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return new Response("This request didn't come from the dashboard.", { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin", { error: "That form couldn't be read. Try again." });
  }

  if (name === "login") {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (!allowRequest(`login:${ip}`)) {
      return redirect("/admin/login", { error: "Too many sign-in attempts. Wait a few minutes and try again." });
    }
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const signedIn = email !== "" && password !== "" && (await deps.signIn(email, password));
    if (!signedIn) {
      // The same message whether the email or the password was wrong.
      return redirect("/admin/login", { error: "That email and password don't match an owner account." });
    }
    const check = await deps.check();
    if (check.status !== "ok") {
      // A real account, but not an authorized owner: end the session at once.
      await deps.signOut();
      return redirect("/admin/login", { error: "That account isn't authorized for this dashboard." });
    }
    return redirect("/admin");
  }

  if (name === "logout") {
    await deps.signOut();
    return redirect("/admin/login", { ok: "You're signed out." });
  }

  const check = await deps.check();
  if (check.status !== "ok") {
    return redirect("/admin/login", {
      error:
        check.status === "not-admin"
          ? "That account isn't authorized for this dashboard."
          : "Sign in to continue.",
    });
  }

  const action = actions[name];
  const back = safeBack(form.get("_back"), "/admin");
  if (!action) return redirect(back, { error: "That action isn't available." });

  try {
    const today = todayInTimeZone(await deps.timeZone());
    const result = await action(form, { store: check.store, today });
    deps.afterChange();
    return redirect(result.to, { ok: result.ok });
  } catch (error) {
    return redirect(back, { error: explain(error) });
  }
}
