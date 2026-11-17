import type { Metadata } from "next";
import { ButtonLink, Paragraphs, Photo, Shell, TextLink } from "@/components/ui";
import { storyFallback, storySectionTitles } from "@/lib/defaults";
import { imageOr, placeholderImages } from "@/lib/images";
import { getSite } from "@/lib/site-data";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Story",
  description: "The baker and the bread behind OnlyLoafs.",
  alternates: { canonical: routes.story },
};

const sections = Object.keys(storySectionTitles) as (keyof typeof storySectionTitles)[];

export default async function StoryPage() {
  const { story, plan } = await getSite();

  return (
    <>
      <Shell className="grid gap-y-10 pb-14 pt-12 lg:grid-cols-12 lg:gap-x-8 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-7 lg:self-end">
          <h1 className="type-display">Our Story</h1>
          {story.intro ? (
            <Paragraphs text={story.intro} className="type-lede mt-8 max-w-[34rem]" />
          ) : (
            <p className="type-lede mt-8 max-w-[34rem] text-espresso/75">{storyFallback}</p>
          )}
        </div>
        <figure className="lg:col-span-4 lg:col-start-9">
          <Photo
            src={imageOr(story.image, placeholderImages.baker)}
            alt={story.image ? (story.bakerName || "The baker") : "Placeholder for a photograph of the baker"}
            ratio="4 / 5"
            sizes="(min-width: 1024px) 33vw, 100vw"
            eager
          />
          {story.bakerName ? (
            <figcaption className="type-small mt-3 text-espresso/75">{story.bakerName}</figcaption>
          ) : null}
        </figure>
      </Shell>

      <Shell className="pb-16 lg:pb-28">
        {sections.map((key) => {
          const text = story[key];
          return (
            <section
              key={key}
              aria-labelledby={`story-${key}`}
              className="grid gap-y-4 border-t border-espresso/15 py-10 lg:grid-cols-12 lg:gap-x-8 lg:py-16"
            >
              <h2 id={`story-${key}`} className="type-title lg:col-span-4">
                {storySectionTitles[key]}
              </h2>
              <div className="max-w-[38rem] lg:col-span-7 lg:col-start-6">
                {text ? (
                  <Paragraphs text={text} className="type-lede" />
                ) : (
                  <p className="type-lede text-espresso/75">{storyFallback}</p>
                )}
              </div>
            </section>
          );
        })}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-espresso/15 pt-10">
          <ButtonLink href={routes.bread}>Browse the Bread</ButtonLink>
          {plan ? (
            <TextLink href={routes.club} className="font-medium">
              See {plan.name}
            </TextLink>
          ) : null}
        </div>
      </Shell>
    </>
  );
}
