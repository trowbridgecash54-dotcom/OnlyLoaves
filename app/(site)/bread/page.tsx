import type { Metadata } from "next";
import { CatalogLoaf } from "@/components/bread";
import { Shell, TextLink } from "@/components/ui";
import { ordersOpen } from "@/lib/site-build";
import { getSite } from "@/lib/site-data";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Bread",
  description:
    "Sourdough loaves you can order one at a time for local pickup. No subscription needed.",
  alternates: { canonical: routes.bread },
};

export default async function BreadPage() {
  const site = await getSite();
  const { products, plan } = site;
  const canOrder = ordersOpen(site);

  return (
    <Shell>
      <header className="grid gap-y-6 pb-12 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-20 lg:pt-20">
        <h1 className="type-display lg:col-span-7">Our Bread</h1>
        <p className="type-lede max-w-[30rem] lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-3">
          Order by the loaf, whenever you like. Choose a quantity, send your request, and
          we&apos;ll confirm your pickup.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="type-lede border-t border-espresso/15 py-16">
          Nothing is on the menu right now.{" "}
          <TextLink href={routes.contact}>Send us a message</TextLink> to ask what&apos;s
          baking next.
        </p>
      ) : (
        products.map((product, index) => (
          <CatalogLoaf key={product.id} product={product} flip={index % 2 === 1} canOrder={canOrder} />
        ))
      )}

      {plan ? (
        <p className="border-t border-espresso/15 py-10 text-espresso/80">
          Prefer bread every {plan.billing_interval} without reordering?{" "}
          <TextLink href={routes.club}>See {plan.name}</TextLink>.
        </p>
      ) : null}
    </Shell>
  );
}
