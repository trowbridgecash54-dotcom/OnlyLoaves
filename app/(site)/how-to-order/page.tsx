import type { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";
import { PickupInfo } from "@/components/PickupInfo";
import { Shell, TextLink } from "@/components/ui";
import { routes } from "@/lib/site";
import { getSite } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "How to Order",
  description:
    "Two ways to get OnlyLoafs sourdough: order individual loaves, or join the monthly Club. Local pickup only.",
  alternates: { canonical: routes.howToOrder },
};

export default async function HowToOrderPage() {
  const site = await getSite();
  return (
    <>
      <Shell className="grid gap-y-6 pb-12 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-20 lg:pt-20">
        <h1 className="type-display lg:col-span-8">How to Order</h1>
        <p className="type-lede max-w-[26rem] lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-3">
          Buy a loaf when you want one, or subscribe and stop thinking about it. Both
          start with a request and end with a pickup.
        </p>
      </Shell>

      <section className="border-t border-espresso/15">
        <Shell className="py-14 lg:py-24">
          <HowItWorks plan={site.plan} detailed />
        </Shell>
      </section>

      <section className="border-t border-espresso/15">
        <Shell className="grid gap-y-8 py-14 lg:grid-cols-12 lg:gap-x-8 lg:py-24">
          <div className="lg:col-span-4">
            <h2 className="type-headline">Pickup</h2>
            <p className="mt-5 max-w-[22rem] text-espresso/80">
              Every order and every Club loaf is collected locally. We don&apos;t ship or
              deliver.
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <PickupInfo pickup={site.pickup} />
            <p className="mt-8 text-espresso/80">
              More questions? <TextLink href={routes.faq}>Read the FAQ</TextLink> or{" "}
              <TextLink href={routes.contact}>send us a message</TextLink>.
            </p>
          </div>
        </Shell>
      </section>
    </>
  );
}
