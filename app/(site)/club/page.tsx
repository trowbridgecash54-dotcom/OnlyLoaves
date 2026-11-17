import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClubCard, PolicyList } from "@/components/club";
import { ButtonLink, Photo, Shell, TextLink } from "@/components/ui";
import { fillPlanTokens } from "@/lib/format";
import { imageOr, placeholderImages } from "@/lib/images";
import { enrollmentOpen, ordersOpen } from "@/lib/site-build";
import { getSite } from "@/lib/site-data";
import { closedMessage } from "@/lib/validation";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "OnlyLoafs Club",
  description:
    "A monthly sourdough subscription for local pickup. Send a request to join and we'll confirm the details with you.",
  alternates: { canonical: routes.club },
};

const steps = [
  {
    title: "Send your request",
    detail:
      "Fill in the enrollment form with your details, pickup preferences and the bread you like.",
  },
  {
    title: "We confirm with you",
    detail:
      "We get in touch to confirm your subscription, bread selections, payment arrangements and pickup schedule.",
  },
  {
    title: "Pick up your bread",
    detail: "Collect your loaves locally on the schedule we've arranged together.",
  },
];

export default async function ClubPage() {
  const site = await getSite();
  const { copy, plan } = site;
  if (!plan) notFound();
  const open = enrollmentOpen(site);
  const whyClosed = ordersOpen(site) ? plan.closed_message : closedMessage;

  return (
    <>
      {/* Introduction */}
      <section>
        <Shell className="grid gap-y-10 pb-14 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-8">
            <p className="type-label text-terracotta-deep">The {plan.name}</p>
            <h1 className="type-display mt-6">{copy.clubPageHeadline}</h1>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-4">
            <p className="type-lede max-w-[24rem]">{fillPlanTokens(copy.clubPageSupporting, plan)}</p>
            <p className="mt-5 font-serif text-2xl italic text-olive-deep">{copy.clubPageAside}</p>
          </div>
        </Shell>
      </section>

      {/* The plan */}
      <section className="bg-espresso text-cream">
        <Shell className="grid gap-y-12 py-16 lg:grid-cols-12 lg:gap-x-8 lg:py-24">
          <div className="lg:col-span-6 lg:self-center">
            <Photo
              src={imageOr(copy.clubImage, placeholderImages.club)}
              alt={copy.clubImage ? "Sourdough loaves" : "Illustration of several sourdough loaves"}
              ratio="4 / 3"
              sizes="(min-width: 1024px) 50vw, 100vw"
              eager
            />
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <ClubCard plan={plan} detailed>
              {open ? (
                <ButtonLink href={routes.clubJoin} className="w-full">
                  Join {plan.name}
                </ButtonLink>
              ) : (
                <p className="font-medium">{whyClosed}</p>
              )}
            </ClubCard>
            <p className="type-small mt-4 text-cream/80">
              {open ? (
                "Subscription requests are reviewed before enrollment is confirmed. Membership and payment are arranged with the owner directly; nothing is charged automatically."
              ) : (
                <TextLink href={routes.contact} className="hover:text-wheat">
                  Send us a message
                </TextLink>
              )}
            </p>
          </div>
        </Shell>
      </section>

      {/* How joining works */}
      <section>
        <Shell className="grid gap-y-10 py-16 lg:grid-cols-12 lg:gap-x-8 lg:py-28">
          <h2 className="type-headline lg:col-span-4">How joining works</h2>
          <ol className="lg:col-span-7 lg:col-start-6">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[3rem_1fr] items-baseline gap-x-4 border-t border-espresso/15 py-6 last:border-b"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-4xl leading-none text-terracotta-deep"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="type-title">{step.title}</h3>
                  <p className="mt-2 max-w-[34rem] text-espresso/80">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Shell>
      </section>

      {/* Policies */}
      <section className="border-t border-espresso/15">
        <Shell className="grid gap-y-10 py-16 lg:grid-cols-12 lg:gap-x-8 lg:py-28">
          <div className="lg:col-span-4">
            <h2 className="type-headline">Good to know</h2>
            <p className="mt-5 max-w-[22rem] text-espresso/80">
              The terms of the Club, as they stand today.
              {plan.allow_pause_requests
                ? " Need a break? You can ask us to pause your subscription."
                : ""}
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <PolicyList policies={site.policies} />
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              {open ? (
                <ButtonLink href={routes.clubJoin}>Join {plan.name}</ButtonLink>
              ) : null}
              <TextLink href={routes.faq} className="font-medium">
                Read the Club FAQ
              </TextLink>
            </div>
            <p className="type-small mt-10 text-espresso/75">
              Only after a loaf or two? <TextLink href={routes.bread}>Order by the loaf</TextLink>{" "}
              — no subscription needed.
            </p>
          </div>
        </Shell>
      </section>
    </>
  );
}
