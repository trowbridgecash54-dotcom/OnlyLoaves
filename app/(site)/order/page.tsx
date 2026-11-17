import type { Metadata } from "next";
import { OrderForm } from "@/components/forms/OrderForm";
import { Shell, TextLink } from "@/components/ui";
import { maxQuantityPerLoaf } from "@/lib/defaults";
import { ordersOpen, requestableProducts } from "@/lib/site-build";
import { getSite } from "@/lib/site-data";
import { closedMessage } from "@/lib/validation";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Order Bread",
  description:
    "Request individual sourdough loaves for local pickup. No online payment — we confirm every order by email.",
  alternates: { canonical: routes.order },
};

type SearchParams = Promise<{ loaf?: string | string[]; qty?: string | string[] }>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function OrderPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const site = await getSite();
  const { pickup } = site;
  const open = ordersOpen(site);
  const products = requestableProducts(site);

  // "Request This Loaf" buttons arrive as /order?loaf=<id>&qty=<n>.
  const initialQuantities: Record<string, number> = {};
  const loaf = products.find((product) => product.slug === first(params.loaf));
  if (loaf) {
    const quantity = Number.parseInt(first(params.qty) ?? "1", 10);
    initialQuantities[loaf.id] = Number.isInteger(quantity)
      ? Math.min(Math.max(quantity, 1), maxQuantityPerLoaf)
      : 1;
  }

  return (
    <Shell className="grid gap-y-12 pb-20 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-28 lg:pt-20">
      <header className="lg:col-span-4">
        <div className="lg:sticky lg:top-10">
          <h1 className="type-headline">Order Bread</h1>
          <p className="type-lede mt-6 max-w-[24rem]">
            Tell us which loaves you&apos;d like and when. We&apos;ll get in touch to confirm
            the total and pickup.
          </p>
          <ul className="mt-8 max-w-[24rem] space-y-3 border-t border-espresso/15 pt-6 text-espresso/80">
            <li>No payment online.</li>
            <li>
              Local pickup only{pickup.area ? `, in ${pickup.area}` : ""}. Pickup details
              come with your confirmation.
            </li>
            <li>
              Not sure what to pick? <TextLink href={routes.bread}>Browse the bread</TextLink>.
            </li>
          </ul>
        </div>
      </header>

      <div className="lg:col-span-7 lg:col-start-6">
        {!open ? (
          <div className="border-t border-espresso/15 pt-8">
            <p className="type-lede max-w-[34rem]">{closedMessage}</p>
            <div className="mt-8">
              <TextLink href={routes.contact} className="font-medium">
                Send us a message
              </TextLink>
            </div>
          </div>
        ) : products.length > 0 ? (
          <OrderForm
            // Remount when the prefilled loaf changes so the quantities reset.
            key={JSON.stringify(initialQuantities)}
            products={products}
            initialQuantities={initialQuantities}
            pickup={pickup}
          />
        ) : (
          <p className="type-lede border-t border-espresso/15 pt-8">
            We&apos;re not taking orders right now.{" "}
            <TextLink href={routes.contact}>Send us a message</TextLink> and we&apos;ll let
            you know when the next bake is open.
          </p>
        )}
      </div>
    </Shell>
  );
}
