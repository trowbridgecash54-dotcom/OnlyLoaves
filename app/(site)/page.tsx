import { MapPin } from "lucide-react";
import { FeaturedLoaf } from "@/components/bread";
import { ClubCard } from "@/components/club";
import { HowItWorks } from "@/components/HowItWorks";
import { ButtonLink, Paragraphs, Photo, Shell, TextLink } from "@/components/ui";
import { storyFallback } from "@/lib/defaults";
import { fillPlanTokens } from "@/lib/format";
import { imageOr, placeholderImages } from "@/lib/images";
import { featuredProducts, ordersOpen } from "@/lib/site-build";
import { getSite } from "@/lib/site-data";
import { routes } from "@/lib/site";

// Each "What's Baking" column sits at a different height on wide screens.
const stagger = ["md:mt-0", "md:mt-20", "md:mt-8"];

export default async function HomePage() {
  const site = await getSite();
  const { copy, story, plan } = site;
  const featured = featuredProducts(site).slice(0, 3);
  const canOrder = ordersOpen(site);

  return (
    <>
      {/* Hero */}
      <section>
        <Shell className="grid gap-y-10 pb-16 pt-10 lg:grid-cols-12 lg:gap-x-8 lg:pb-24 lg:pt-14">
          <div className="lg:col-span-7 lg:self-center">
            <h1 className="type-display">
              {[copy.heroLine1, copy.heroLine2].map((line, index) => (
                <span
                  key={line}
                  className={`block animate-rise ${index === 1 ? "[animation-delay:120ms] sm:pl-[0.5em]" : ""}`}
                >
                  {line}
                </span>
              ))}
            </h1>
            <div className="animate-rise [animation-delay:280ms] sm:pl-[0.4rem]">
              <p className="type-lede mt-8 max-w-[25rem]">{copy.heroSupporting}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href={routes.bread}>Shop the Loaves</ButtonLink>
                {plan ? (
                  <ButtonLink href={routes.club} variant="secondary">
                    Join the Club
                  </ButtonLink>
                ) : null}
              </div>
              <p className="type-small mt-9 flex items-center gap-2 text-olive-deep">
                <MapPin size={16} strokeWidth={1.75} />
                Local Pickup Only
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Photo
              src={imageOr(copy.heroImage, placeholderImages.hero)}
              alt={copy.heroImage ? "Freshly baked sourdough" : "Illustration of a scored sourdough loaf"}
              ratio="4 / 5"
              sizes="(min-width: 1024px) 40vw, 100vw"
              eager
              className="animate-unveil"
            />
          </div>
        </Shell>
      </section>

      {/* What's Baking */}
      <section className="border-t border-espresso/15">
        <Shell className="py-16 lg:pb-28 lg:pt-24">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <h2 className="type-headline">{copy.featuredHeading}</h2>
            <TextLink href={routes.bread} className="mb-2 font-medium">
              See all the bread
            </TextLink>
          </div>
          <ul className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-3 lg:mt-14 lg:gap-x-12">
            {featured.map((product, index) => (
              <li key={product.id} className={stagger[index]}>
                <FeaturedLoaf product={product} canOrder={canOrder} />
              </li>
            ))}
          </ul>
        </Shell>
      </section>

      {/* OnlyLoafs Club */}
      {plan ? (
        <section className="bg-espresso text-cream">
          <Shell className="grid gap-y-12 py-16 lg:grid-cols-12 lg:gap-x-8 lg:py-28">
            <div className="lg:col-span-5 lg:self-center">
              <h2 className="type-headline">{copy.clubHeading}</h2>
              <p className="type-lede mt-6 max-w-[24rem] text-cream/85">
                {fillPlanTokens(copy.clubSupporting, plan)}
              </p>
              <div className="mt-8">
                <ButtonLink href={routes.club} variant="light">
                  Explore the Club
                </ButtonLink>
              </div>
              <p className="mt-8 font-serif text-2xl italic text-wheat">{copy.clubAside}</p>
            </div>

            <div className="relative lg:col-span-6 lg:col-start-7">
              <Photo
                src={imageOr(copy.clubImage, placeholderImages.club)}
                alt={copy.clubImage ? "Sourdough loaves" : "Illustration of several sourdough loaves"}
                ratio="4 / 3"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <ClubCard
                plan={plan}
                className="relative z-10 -mt-16 ml-auto mr-4 w-[min(23rem,88%)] sm:mr-8 lg:absolute lg:-bottom-14 lg:-left-20 lg:mr-0 lg:mt-0 lg:-rotate-2"
              />
            </div>
          </Shell>
        </section>
      ) : null}

      {/* How It Works */}
      <section>
        <Shell className="py-16 lg:py-28">
          <h2 className="type-headline">How It Works</h2>
          <p className="type-lede mt-5 max-w-[32rem] text-espresso/80">
            Two ways to get your bread. Pick whichever suits you.
          </p>
          <div className="mt-12 lg:mt-16">
            <HowItWorks plan={plan} />
          </div>
        </Shell>
      </section>

      {/* Our Story */}
      <section className="border-t border-espresso/15">
        <Shell className="grid gap-y-10 py-16 lg:grid-cols-12 lg:gap-x-8 lg:py-28">
          <div className="max-w-[20rem] lg:col-span-4 lg:col-start-2">
            <Photo
              src={imageOr(story.image, placeholderImages.baker)}
              alt={story.image ? (story.bakerName || "The baker") : "Placeholder for a photograph of the baker"}
              ratio="4 / 5"
              sizes="(min-width: 1024px) 30vw, 60vw"
            />
          </div>
          <div className="lg:col-span-5 lg:col-start-7 lg:self-center">
            <h2 className="type-headline">Our Story</h2>
            {story.intro ? (
              <Paragraphs text={story.intro} className="type-lede mt-6" />
            ) : (
              <p className="type-lede mt-6 text-espresso/75">{storyFallback}</p>
            )}
            <div className="mt-8">
              <TextLink href={routes.story} className="font-medium">
                Read our story
              </TextLink>
            </div>
          </div>
        </Shell>
      </section>
    </>
  );
}
