import type { Metadata } from "next";
import { Shell, TextLink } from "@/components/ui";
import { routes } from "@/lib/site";
import { getSite } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What information OnlyLoafs collects through this website and how it is used.",
  alternates: { canonical: routes.privacy },
};

/**
 * A plain description of what this website actually does with
 * information. It is not legal advice and makes no compliance claims;
 * the owner should have it reviewed before launch.
 */
export default async function PrivacyPage() {
  const { business } = await getSite();

  const sections: { title: string; body: string[] }[] = [
    {
      title: "What we collect",
      body: [
        "When you send an order request, a Club enrollment request or a message, we collect what you type into the form: your name, email address, phone number if you give one, the bread and pickup date you asked for, and anything you write in the notes.",
        "We don't ask for payment details on this website and it doesn't take payments.",
      ],
    },
    {
      title: "How we use it",
      body: [
        "We use it to reply to you, confirm and prepare your order, arrange pickup, and manage your Club membership if you join. We don't sell it or use it for advertising.",
      ],
    },
    {
      title: "Where it's kept",
      body: [
        "Requests are stored in a private database that only the owner can sign in to. We use service providers to run the site: Vercel hosts the website, Supabase hosts the database and uploaded photos, and, when email notifications are switched on, Resend delivers a copy of each request to the owner's inbox.",
        "To limit spam, the site keeps a short-lived, scrambled marker of where form submissions come from. It isn't used to identify you.",
      ],
    },
    {
      title: "Cookies and tracking",
      body: [
        "This website doesn't use advertising or analytics cookies. The only cookie it sets is the one that keeps the owner signed in to the private dashboard.",
      ],
    },
    {
      title: "Your choices",
      body: [
        "You can ask us what information we hold about you, ask us to correct it, or ask us to delete it. Send us a message and we'll take care of it.",
      ],
    },
  ];

  return (
    <Shell className="pb-20 pt-12 lg:pb-28 lg:pt-20">
      <h1 className="type-display">Privacy</h1>
      <p className="type-lede mt-8 max-w-[38rem]">
        {business.name} is a small bakery. This page explains, in plain terms, what this
        website does with the information you give it.
      </p>

      <div className="mt-12 lg:mt-16">
        {sections.map((section) => (
          <section
            key={section.title}
            className="grid gap-y-3 border-t border-espresso/15 py-8 lg:grid-cols-12 lg:gap-x-8 lg:py-12"
          >
            <h2 className="type-title lg:col-span-4">{section.title}</h2>
            <div className="max-w-[38rem] space-y-4 lg:col-span-7 lg:col-start-6">
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="border-t border-espresso/15 pt-8">
        Questions about this page? <TextLink href={routes.contact}>Send us a message</TextLink>
        {business.email ? (
          <>
            {" "}
            or email <TextLink href={`mailto:${business.email}`}>{business.email}</TextLink>
          </>
        ) : null}
        .
      </p>
    </Shell>
  );
}
