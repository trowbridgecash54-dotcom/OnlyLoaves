import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DbError, type Db, type Files, type Filter, type Row, type Scalar, type SelectOptions } from "@/lib/db";

/**
 * TEST ADAPTER. Implements the Db interface by running SQL through the
 * `psql` command against a local PostgreSQL that has the project's
 * migrations applied (see scripts/local-db.sh).
 *
 * Each call runs as one of Supabase's roles, with the signed-in user's
 * id in request.jwt.claims — the same mechanism Supabase uses — so
 * row-level security is exercised for real.
 */

export type Identity =
  | { role: "anon" }
  | { role: "service_role" }
  | { role: "authenticated"; userId: string };

function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return `${literal(JSON.stringify(value))}::jsonb`;
  const text = String(value);
  let tag = "q";
  while (text.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${text}$${tag}$`;
}

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return name;
};

function where(filter: Filter | undefined): string {
  const parts = Object.entries(filter ?? {}).map(([column, value]) => {
    if (value !== null && typeof value === "object") {
      if ("gte" in value) return `${ident(column)} >= ${literal(value.gte)}`;
      if (value.in.length === 0) return "false";
      return `${ident(column)} in (${value.in.map((item: Scalar) => literal(item)).join(", ")})`;
    }
    return value === null ? `${ident(column)} is null` : `${ident(column)} = ${literal(value)}`;
  });
  return parts.length > 0 ? `where ${parts.join(" and ")}` : "";
}

export function psqlDb(url: string, identity: Identity): Db {
  function run<T>(sql: string): T {
    const claims =
      identity.role === "authenticated"
        ? JSON.stringify({ sub: identity.userId, role: "authenticated" })
        : JSON.stringify({ role: identity.role });
    const script = [
      "begin;",
      `set local role ${identity.role};`,
      `set local "request.jwt.claims" = ${literal(claims)};`,
      `${sql};`,
      "commit;",
    ].join("\n");
    const result = spawnSync(
      "psql",
      [url, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"],
      { input: script, encoding: "utf8" },
    );
    if (result.status !== 0) {
      const match = /ERROR:\s+(\w+):\s+(.*)/.exec(result.stderr ?? "");
      throw new DbError(match ? match[2].trim() : (result.stderr ?? "psql failed").trim(), match?.[1] ?? "");
    }
    const out = result.stdout.trim();
    return (out === "" ? null : JSON.parse(out)) as T;
  }

  return {
    async rpc<T>(fn: string, args: Row = {}) {
      const list = Object.entries(args)
        .map(([name, value]) => `${ident(name)} => ${literal(value)}`)
        .join(", ");
      return run<T>(`select to_json(r) from public.${ident(fn)}(${list}) as r`);
    },
    async select<T>(table: string, options: SelectOptions = {}) {
      const order = options.order?.length
        ? `order by ${options.order.map(([column, dir]) => `${ident(column)} ${dir}`).join(", ")}`
        : "";
      const limit = options.limit ? `limit ${Number(options.limit)}` : "";
      return run<T[]>(
        `select coalesce(json_agg(t), '[]'::json) from (select * from public.${ident(table)} ${where(options.filter)} ${order} ${limit}) t`,
      );
    },
    async insert<T>(table: string, row: Row) {
      const columns = Object.keys(row).map(ident);
      const values = Object.values(row).map(literal);
      return run<T>(
        `with r as (insert into public.${ident(table)} (${columns.join(", ")}) values (${values.join(", ")}) returning *) select to_json(r) from r`,
      );
    },
    async upsert<T>(table: string, row: Row, conflictColumn: string) {
      const columns = Object.keys(row).map(ident);
      const values = Object.values(row).map(literal);
      const updates = columns
        .filter((column) => column !== conflictColumn)
        .map((column) => `${column} = excluded.${column}`);
      return run<T>(
        `with r as (insert into public.${ident(table)} (${columns.join(", ")}) values (${values.join(", ")}) on conflict (${ident(conflictColumn)}) do update set ${updates.join(", ")} returning *) select to_json(r) from r`,
      );
    },
    async update<T>(table: string, filter: Filter, patch: Row) {
      const sets = Object.entries(patch).map(([column, value]) => `${ident(column)} = ${literal(value)}`);
      return run<T[]>(
        `with r as (update public.${ident(table)} set ${sets.join(", ")} ${where(filter)} returning *) select coalesce(json_agg(r), '[]'::json) from r`,
      );
    },
    async remove(table: string, filter: Filter) {
      run(`delete from public.${ident(table)} ${where(filter)}`);
    },
  };
}

/** Runs raw SQL as the database owner. For test setup only. */
export function sql(url: string, statement: string): string {
  const result = spawnSync("psql", [url, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input: statement,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

/** TEST ADAPTER for photo storage: plain files in a folder. */
export function folderFiles(root: string): Files {
  return {
    async upload(path, bytes) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), bytes);
    },
    async remove(path) {
      rmSync(join(root, path), { force: true });
    },
  };
}
