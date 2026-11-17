/**
 * Made-up test data. None of this is real business information.
 */
import { buildSite } from "@/lib/site-build";
import type { Plan, Product, SiteData } from "@/lib/types";
import { defaultPlan, defaultProducts } from "@/lib/defaults";

export const TODAY = "2026-11-16"; // a Monday

export function fixtureSite(overrides: {
  ordersOpen?: boolean;
  products?: Partial<Product>[];
  plan?: Partial<Plan> | null;
  pickup?: Record<string, unknown>;
} = {}): SiteData {
  const products = defaultProducts.map((product, index) => ({
    ...product,
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    price_cents: index === 0 ? 1200 : null,
    ...(overrides.products?.[index] ?? {}),
  }));
  const plan = overrides.plan === null ? [] : [{ ...defaultPlan, id: "00000000-0000-4000-8000-0000000000aa", ...overrides.plan }];
  return buildSite(
    { business: { ordersOpen: overrides.ordersOpen ?? true }, pickup: overrides.pickup ?? {} },
    products,
    plan,
    [],
  );
}
