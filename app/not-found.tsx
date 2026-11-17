import { ButtonLink, Shell, TextLink } from "@/components/ui";
import { routes } from "@/lib/site";

export default function NotFound() {
  return (
    <Shell className="py-24 lg:py-36">
      <h1 className="type-display">This page isn&apos;t on the menu.</h1>
      <p className="type-lede mt-8 max-w-[30rem]">
        The link may be old, or the address may have a typo. The bread is still here.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <ButtonLink href={routes.bread}>Browse the Bread</ButtonLink>
        <TextLink href={routes.home} className="font-medium">
          Go to the homepage
        </TextLink>
      </div>
    </Shell>
  );
}
