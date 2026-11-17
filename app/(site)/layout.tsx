import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { siteUrl } from "@/lib/site";
import { getSite } from "@/lib/site-data";

/**
 * Public pages are rebuilt from the database at most once a minute, and
 * immediately whenever the owner saves a change in the dashboard.
 */
export const revalidate = 60;

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const site = await getSite();
  const { business } = site;

  /** Tells search engines this is a bakery. No address is published. */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: business.name,
    description: business.tagline,
    url: siteUrl(),
  };

  return (
    <>
      {business.announcement ? (
        <p className="type-small bg-espresso px-5 py-2.5 text-center text-cream">
          {business.announcement}
        </p>
      ) : null}
      <Header />
      <main id="main">{children}</main>
      <Footer site={site} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
