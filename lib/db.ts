/**
 * The small set of database operations the site uses. Everything that
 * reads or writes data goes through this interface, so the rest of the
 * code doesn't depend on how the database is reached:
 *
 *   - lib/backend.ts implements it with the Supabase client (production)
 *   - tests/support/psql-db.ts implements it with psql against a local
 *     PostgreSQL, so the same store code and the real SQL are tested
 *     together, row-level security included
 */

export type Scalar = string | number | boolean | null;

/** Column → value (equals), or { gte } / { in } for the two other filters we need. */
export type Filter = Record<string, Scalar | { gte: Scalar } | { in: Scalar[] }>;

export type SelectOptions = {
  filter?: Filter;
  order?: [column: string, direction: "asc" | "desc"][];
  limit?: number;
};

export type Row = Record<string, unknown>;

export interface Db {
  /** Calls a database function in the public schema. */
  rpc<T>(fn: string, args?: Row): Promise<T>;
  select<T>(table: string, options?: SelectOptions): Promise<T[]>;
  insert<T>(table: string, row: Row): Promise<T>;
  /** Insert, or update the existing row with the same `conflictColumn`. */
  upsert<T>(table: string, row: Row, conflictColumn: string): Promise<T>;
  update<T>(table: string, filter: Filter, patch: Row): Promise<T[]>;
  remove(table: string, filter: Filter): Promise<void>;
}

/** Photo storage. */
export interface Files {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * A database error. `message` is the database's own message — for our
 * functions that is a short code such as "allowance_exhausted".
 */
export class DbError extends Error {
  constructor(
    message: string,
    public code: string = "",
  ) {
    super(message);
    this.name = "DbError";
  }
}
