/**
 * Creates (or authorizes) an owner account for the dashboard.
 *
 *   npm run create-owner -- owner@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the
 * environment (for example from .env.local, loaded with
 * `node --env-file=.env.local`, or set in the terminal). It:
 *   1. creates a Supabase Auth user with a long random password, already
 *      confirmed, unless that email already has an account;
 *   2. adds the user to public.admins, which is what grants dashboard access;
 *   3. prints the temporary password ONCE. Change it after first sign-in
 *      by asking the developer to reset it in Supabase.
 *
 * There is no sign-up page anywhere on the site. This script (or the
 * manual steps in the README) is the only way to become an owner.
 */
import { randomBytes } from "node:crypto";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error("Usage: npm run create-owner -- owner@example.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first (see README).");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function findUser(): Promise<{ id: string } | null> {
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, { headers });
    if (!response.ok) throw new Error(`Listing users failed (HTTP ${response.status}).`);
    const { users } = (await response.json()) as { users: { id: string; email?: string }[] };
    const match = users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (users.length < 100) return null;
  }
  return null;
}

async function main() {
  let user = await findUser();
  let password: string | null = null;

  if (!user) {
    password = randomBytes(18).toString("base64url");
    const response = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!response.ok) throw new Error(`Creating the account failed (HTTP ${response.status}): ${await response.text()}`);
    user = (await response.json()) as { id: string };
  }

  const grant = await fetch(`${url}/rest/v1/admins?on_conflict=user_id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ user_id: user.id, email }),
  });
  if (!grant.ok) throw new Error(`Authorizing the account failed (HTTP ${grant.status}): ${await grant.text()}`);

  console.log(`\n${email} is an owner and can sign in at /admin/login.`);
  if (password) {
    console.log(`Temporary password (shown once): ${password}`);
    console.log("Store it somewhere safe, or reset it later from the Supabase dashboard.\n");
  } else {
    console.log("That email already had an account; its password was not changed.\n");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
