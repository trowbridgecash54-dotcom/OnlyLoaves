import type { Metadata } from "next";
import { Faq } from "@/components/Faq";
import { ContactForm } from "@/components/forms/ContactForm";
import { PickupInfo } from "@/components/PickupInfo";
import { Shell, TextLink } from "@/components/ui";
import { InstagramIcon } from "@/components/ui";
import { routes } from "@/lib/site";
import { getSite } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send OnlyLoafs a message, and find answers about ordering, pickup and the Club.",
  alternates: { canonical: routes.contact },
};

export default async function ContactPage() {
  const site = await getSite();
  const { business } = site;
  return (
    <>
      <Shell className="grid gap-y-12 pb-16 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-5">
          <h1 className="type-display">Contact</h1>
          <p className="type-lede mt-8 max-w-[24rem]">
            Questions about an order, the Club or what&apos;s baking? Write to us.
          </p>

          <ul className="mt-8 space-y-3">
            {business.email ? (
              <li>
                <span className="type-small block text-espresso/75">Email</span>
                <TextLink href={`mailto:${business.email}`} className="break-all text-lg">
                  {business.email}
                </TextLink>
              </li>
            ) : null}
            {business.instagramUrl ? (
              <li>
                <a
                  href={business.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2.5 text-lg underline decoration-terracotta decoration-[1.5px] underline-offset-[5px] hover:text-terracotta-deep"
                >
                  <InstagramIcon className="size-6" />
                  <span>Follow us on Instagram</span>
                </a>
              </li>
            ) : null}
          </ul>

          <h2 className="type-title mt-12">Pickup</h2>
          <PickupInfo pickup={site.pickup} className="mt-4 max-w-[28rem]" />
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <h2 className="type-title mb-6">Send a message</h2>
          <ContactForm />
          <p className="type-small mt-6 text-espresso/75">
            Ordering bread? The <TextLink href={routes.order}>order form</TextLink> is
            quicker.
          </p>
        </div>
      </Shell>

      <section id="faq" className="scroll-mt-8 border-t border-espresso/15">
        <Shell className="py-16 lg:py-24">
          <h2 className="type-headline">Questions, answered</h2>
          <div className="mt-10 lg:mt-14">
            <Faq site={site} />
          </div>
        </Shell>
      </section>
    </>
  );
}
