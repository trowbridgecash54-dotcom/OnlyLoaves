import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DbError, type Db, type Files, type Filter, type Row, type SelectOptions } from "./db";

/**
 * The connection to Supabase (database, sign-in and photo storage).
 * This is the only file that talks to Supabase directly; everything
 * else uses the Db and Files interfaces from lib/db.ts.
 *
 * Three identities, three keys:
 *   publicDb()   visitors. Publishable key; row-level security applies.
 *   sessionDb()  the signed-in owner. Publishable key plus their session
 *                cookie; row-level security checks they're an admin.
 *   serviceDb()  the website's server. Secret key; used only to save the
 *                public forms. NEVER import this into a client component.
 *
 * Environment variables (see .env.example). The older key names are
 * still read so a project created with legacy keys keeps working.
 */

export const PHOTO_BUCKET = "photos";

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishableKey = () =>
  (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
const secretKey = () =>
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

/** True when the site can read from the database. */
export function isBackendConfigured(): boolean {
  return supabaseUrl() !== "" && publishableKey() !== "";
}

/** True when the server can also save form submissions. */
export function canSaveSubmissions(): boolean {
  return isBackendConfigured() && secretKey() !== "";
}

/* ---------- Db on top of the Supabase client ---------- */

type Query = {
  eq(column: string, value: unknown): Query;
  is(column: string, value: null): Query;
  gte(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
};

function applyFilter<Q extends Query>(query: Q, filter: Filter | undefined): Q {
  let next: Query = query;
  for (const [column, value] of Object.entries(filter ?? {})) {
    if (value !== null && typeof value === "object") {
      next = "gte" in value ? next.gte(column, value.gte) : next.in(column, value.in);
    } else if (value === null) {
      next = next.is(column, null);
    } else {
      next = next.eq(column, value);
    }
  }
  return next as Q;
}

function check<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new DbError(result.error.message, result.error.code ?? "");
  return result.data as T;
}

function toDb(client: SupabaseClient): Db {
  return {
    async rpc<T>(fn: string, args: Row = {}) {
      return check<T>(await client.rpc(fn, args));
    },
    async select<T>(table: string, options: SelectOptions = {}) {
      let query = applyFilter(client.from(table).select("*"), options.filter);
      for (const [column, direction] of options.order ?? []) {
        query = query.order(column, { ascending: direction === "asc" });
      }
      if (options.limit) query = query.limit(options.limit);
      return check<T[]>(await query);
    },
    async insert<T>(table: string, row: Row) {
      return check<T>(await client.from(table).insert(row).select().single());
    },
    async upsert<T>(table: string, row: Row, conflictColumn: string) {
      return check<T>(
        await client.from(table).upsert(row, { onConflict: conflictColumn }).select().single(),
      );
    },
    async update<T>(table: string, filter: Filter, patch: Row) {
      return check<T[]>(await applyFilter(client.from(table).update(patch), filter).select());
    },
    async remove(table: string, filter: Filter) {
      check(await applyFilter(client.from(table).delete(), filter));
    },
  };
}

const stateless = { auth: { persistSession: false, autoRefreshToken: false } };

export function publicDb(): Db {
  return toDb(createClient(supabaseUrl(), publishableKey(), stateless));
}

export function serviceDb(): Db {
  if (!canSaveSubmissions()) throw new Error("The Supabase secret key is not configured.");
  return toDb(createClient(supabaseUrl(), secretKey(), stateless));
}

/* ---------- The signed-in owner ---------- */

async function sessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Pages can't write cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export async function sessionDb(): Promise<Db> {
  return toDb(await sessionClient());
}

export async function sessionFiles(): Promise<Files> {
  const storage = (await sessionClient()).storage.from(PHOTO_BUCKET);
  return {
    async upload(path, bytes, contentType) {
      const { error } = await storage.upload(path, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new DbError(error.message);
    },
    async remove(path) {
      const { error } = await storage.remove([path]);
      if (error) throw new DbError(error.message);
    },
  };
}

export type SessionUser = { id: string; email: string };

/**
 * The signed-in user, verified with Supabase Auth on every call (the
 * cookie alone is never trusted). Being signed in is not authorization:
 * see lib/admin/auth.ts, which also requires a row in public.admins.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isBackendConfigured()) return null;
  const { data, error } = await (await sessionClient()).auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

export async function signIn(email: string, password: string): Promise<boolean> {
  const { error } = await (await sessionClient()).auth.signInWithPassword({ email, password });
  return !error;
}

export async function signOut(): Promise<void> {
  await (await sessionClient()).auth.signOut();
}
