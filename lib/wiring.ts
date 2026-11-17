import { revalidatePath } from "next/cache";
import { checkAdmin } from "./admin/auth";
import type { AdminHttpDeps } from "./admin/http";
import { canSaveSubmissions, serviceDb, signIn, signOut } from "./backend";
import { sendOwnerEmail } from "./email";
import type { FormDeps } from "./handlers";
import { getSite } from "./site-data";
import { Store } from "./store";

/**
 * Connects the framework-free logic in lib/ to the real services.
 * Route files import from here; tests pass their own stand-ins instead.
 */

/** What the three public form endpoints need. */
export async function formDeps(): Promise<FormDeps> {
  return {
    site: await getSite(),
    store: canSaveSubmissions() ? new Store(serviceDb()) : null,
    send: (email) => sendOwnerEmail(email),
  };
}

/** What the dashboard's form endpoint needs. */
export function adminDeps(): AdminHttpDeps {
  return {
    check: checkAdmin,
    signIn,
    signOut,
    // Public pages are cached for speed; an owner's change clears that cache.
    afterChange: () => revalidatePath("/", "layout"),
    timeZone: async () => (await getSite()).pickup.timeZone,
  };
}
