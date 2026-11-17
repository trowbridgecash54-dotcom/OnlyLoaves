import {
  defaultBusiness,
  defaultCopy,
  defaultPickup,
  defaultPlan,
  defaultPolicies,
  defaultProducts,
  defaultStory,
} from "./defaults";
import type { Plan, Product, SiteData } from "./types";

type Group = Record<string, unknown>;

/** Saved values win; anything not saved yet falls back to the starting content. */
function merged<T extends object>(defaults: T, saved: unknown): T {
  const group = saved !== null && typeof saved === "object" ? (saved as Group) : {};
  const result: Group = { ...(defaults as Group) };
  for (const key of Object.keys(defaults)) {
    if (group[key] !== undefined) result[key] = group[key];
  }
  return result as T;
}

/** Assembles what public pages need from what the database returned. */
export function buildSite(
  settings: Record<string, unknown>,
  products: Product[],
  plans: Plan[],
  closures: { closed_on: string }[],
): SiteData {
  return {
    source: "database",
    business: merged(defaultBusiness, settings.business),
    copy: merged(defaultCopy, settings.copy),
    story: merged(defaultStory, settings.story),
    policies: merged(defaultPolicies, settings.policies),
    pickup: {
      ...merged(defaultPickup, settings.pickup),
      unavailableDates: closures.map((closure) => closure.closed_on),
    },
    products: products.filter((product) => product.archived_at === null),
    plan: plans.find((plan) => plan.enabled) ?? null,
  };
}

/** The built-in starting content, used when no database is connected. */
export function defaultSite(): SiteData {
  return {
    source: "defaults",
    business: defaultBusiness,
    copy: defaultCopy,
    story: defaultStory,
    policies: defaultPolicies,
    pickup: { ...defaultPickup, unavailableDates: [] },
    products: defaultProducts,
    plan: defaultPlan,
  };
}

/* ---------- Small questions pages ask of the site data ---------- */

export function isRequestable(product: Product): boolean {
  return product.availability === "available" || product.availability === "limited";
}

export const requestableProducts = (site: SiteData) => site.products.filter(isRequestable);
export const featuredProducts = (site: SiteData) => site.products.filter((product) => product.featured);

/** Breads Club members can receive. "Coming soon" breads are left out. */
export const clubProducts = (site: SiteData) =>
  site.products.filter((product) => product.club_eligible && product.availability !== "coming-soon");

/** One-time ordering is open only when the owner has opened it. */
export const ordersOpen = (site: SiteData) => site.business.ordersOpen;

/** Club enrollment needs the site open, a plan, and the plan accepting requests. */
export const enrollmentOpen = (site: SiteData) =>
  site.business.ordersOpen && site.plan !== null && site.plan.accepting_requests;
