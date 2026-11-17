import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClubForm } from "@/components/forms/ClubForm";
import { ButtonLink, Shell, TextLink } from "@/components/ui";
import { formatCents, pluralize } from "@/lib/format";
import { clubProducts, enrollmentOpen, ordersOpen } from "@/lib/site-build";
import { getSite } from "@/lib/site-data";
import { closedMessage } from "@/lib/validation";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Join OnlyLoafs Club",
  description:
    "Send a request to join the OnlyLoafs Club. We review every request and confirm the details with you before anything starts.",
  alternates: { canonical: routes.clubJoin },
};

export default async function ClubJoinPage() {
  const site = await getSite();
  const { plan } = site;
  if (!plan) notFound();
  const open = enrollmentOpen(site);

  return (
    <Shell className="grid gap-y-12 pb-20 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-28 lg:pt-20">
      <header className="lg:col-span-4">
        <div className="lg:sticky lg:top-10">
          <p className="type-label text-terracotta-deep">Enrollment request</p>
          <h1 className="type-headline mt-5">Join {plan.name}</h1>
          <p className="type-lede mt-6 max-w-[24rem]">
            Send us your details and we&apos;ll get in touch to set everything up.
          </p>

          <dl className="mt-8 max-w-[24rem] divide-y divide-espresso/15 border-y border-espresso/15">
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-espresso/75">Price</dt>
              <dd className="font-medium">
                {formatCents(plan.price_cents, plan.currency)} / {plan.billing_interval}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-espresso/75">Included</dt>
              <dd className="font-medium">
                {plan.loaves_per_period} {pluralize(plan.loaves_per_period, "loaf", "loaves")} each{" "}
                {plan.billing_interval}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-espresso/75">Pickup</dt>
              <dd className="font-medium">Local pickup only</dd>
            </div>
          </dl>
          <p className="type-small mt-5 max-w-[24rem] text-espresso/75">
            <TextLink href={routes.club}>Back to the Club details</TextLink>
          </p>
        </div>
      </header>

      <div className="lg:col-span-7 lg:col-start-6">
        {open ? (
          <ClubForm
            plan={plan}
            eligibleProducts={clubProducts(site)}
            pickup={site.pickup}
            policies={site.policies}
          />
        ) : (
          <div className="border-t border-espresso/15 pt-8">
            <p className="type-lede max-w-[34rem]">{ordersOpen(site) ? plan.closed_message : closedMessage}</p>
            <div className="mt-8">
              <ButtonLink href={routes.contact}>Send a Message</ButtonLink>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
