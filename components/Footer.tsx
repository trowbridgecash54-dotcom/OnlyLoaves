import Link from "next/link";
import { navigation, routes } from "@/lib/site";
import type { SiteData } from "@/lib/types";
import { InstagramIcon, Shell, TextLink } from "./ui";
import { Wordmark } from "./Wordmark";

export function Footer({ site }: { site: SiteData }) {
  const { business, pickup, plan } = site;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-espresso/15 bg-wheat/60">
      <Shell className="grid gap-x-8 gap-y-12 py-14 md:grid-cols-12 lg:py-20">
        <div className="md:col-span-5">
          <Link href={routes.home} className="inline-block">
            <Wordmark className="text-[2.75rem]" />
          </Link>
          <p className="mt-4 max-w-[22rem]">{business.tagline}</p>
          <p className="type-small mt-4 max-w-[22rem] text-espresso/75">
            Local pickup only
            {pickup.area ? ` in ${pickup.area}` : ""}. Pickup details are shared when your
            order is confirmed.
          </p>
        </div>

        <nav aria-label="Footer" className="md:col-span-3 md:col-start-7">
          <h2 className="type-small font-medium">Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-terracotta-deep">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={routes.order} className="hover:text-terracotta-deep">
                Order Bread
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="type-small font-medium">Get in touch</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <TextLink href={routes.contact}>Send a message</TextLink>
            </li>
            {business.email ? (
              <li>
                <TextLink href={`mailto:${business.email}`} className="break-all">
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
                  className="inline-flex min-h-11 items-center gap-2 hover:text-terracotta-deep"
                >
                  <InstagramIcon className="size-5" />
                  <span>Instagram</span>
                </a>
              </li>
            ) : null}
          </ul>

          {plan ? (
            <p className="mt-8 border-t border-espresso/20 pt-5">
              <span className="block font-serif text-2xl leading-tight">
                Bread every {plan.billing_interval}?
              </span>
              <TextLink href={routes.club} className="mt-2 inline-block">
                Join the Club
              </TextLink>
            </p>
          ) : null}
        </div>
      </Shell>

      <Shell>
        <div className="type-small flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-espresso/20 py-6 text-espresso/75">
          <p>
            © {year} {business.name} ·{" "}
            <Link href={routes.privacy} className="underline underline-offset-4 hover:text-terracotta-deep">
              Privacy
            </Link>
          </p>
          {business.disclosures.length > 0 ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {business.disclosures.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Shell>
    </footer>
  );
}
