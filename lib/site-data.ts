import { cache } from "react";
import { isBackendConfigured, publicDb } from "./backend";
import { buildSite, defaultSite } from "./site-build";
import { Store } from "./store";
import type { SiteData } from "./types";

/**
 * Loads everything public pages show: settings, bread, the Club plan
 * and pickup rules. Read as a visitor, so only public data can ever
 * come back. Called once per request however many components ask.
 *
 * With no database connected the site shows its built-in starting
 * content, so it can still be previewed. If a database IS connected and
 * can't be reached, this throws rather than quietly showing stale
 * starting content as if it were the owner's.
 */
export const getSite = cache(async (): Promise<SiteData> => {
  if (!isBackendConfigured()) return defaultSite();
  const store = new Store(publicDb());
  const [settings, products, plans, closures] = await Promise.all([
    store.settings(),
    store.products(),
    store.plans(),
    store.closures(),
  ]);
  return buildSite(settings, products, plans, closures);
});
