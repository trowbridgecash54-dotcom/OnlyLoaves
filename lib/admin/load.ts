import { defaultLaunch, defaultPickupPrivate } from "../defaults";
import { todayInTimeZone } from "../pickup";
import { buildSite } from "../site-build";
import type { Store } from "../store";
import type { LaunchSettings, PickupPrivateSettings, Product, SiteData } from "../types";

/**
 * What most dashboard pages need first: the site's current settings as
 * the owner sees them (including archived loaves and private settings),
 * and today's date in the business's time zone.
 */
export type OwnerView = {
  site: SiteData;
  /** Every loaf, including archived ones. */
  allProducts: Product[];
  pickupPrivate: PickupPrivateSettings;
  launch: LaunchSettings;
  today: string;
};

export async function loadOwnerView(store: Store): Promise<OwnerView> {
  const [settings, allProducts, plans, closures] = await Promise.all([
    store.settings(),
    store.products(),
    store.plans(),
    store.closures(),
  ]);
  const site = buildSite(settings, allProducts, plans, closures);
  // The owner manages the plan even while it's switched off.
  if (!site.plan && plans.length > 0) site.plan = plans[0];
  const group = <T extends object>(defaults: T, saved: unknown): T => ({
    ...defaults,
    ...(saved !== null && typeof saved === "object" ? (saved as Partial<T>) : {}),
  });
  return {
    site,
    allProducts,
    pickupPrivate: group(defaultPickupPrivate, settings.pickup_private),
    launch: group(defaultLaunch, settings.launch),
    today: todayInTimeZone(site.pickup.timeZone),
  };
}
