import { routes } from "@/lib/site";
import type { Plan } from "@/lib/types";
import { ButtonLink } from "./ui";

const oneTimeSteps = [
  { title: "Browse the bread", detail: "See what's baking and what's available." },
  { title: "Choose your quantity", detail: "One loaf or several — order only what you want." },
  { title: "Submit your request", detail: "Tell us when you'd like to pick up. No payment online." },
  { title: "Receive pickup confirmation", detail: "We email you to confirm the total, time and place." },
];

const clubSteps = [
  { title: "Choose a monthly subscription", detail: "Review what the Club includes and what it costs." },
  { title: "Submit your signup request", detail: "It's a request — nothing starts or is charged yet." },
  {
    title: "Arrange your recurring pickups with the owner",
    detail: "We confirm your bread, payment and schedule with you directly.",
  },
];

function Steps({ steps, detailed }: { steps: typeof oneTimeSteps; detailed: boolean }) {
  return (
    <ol className="mt-8 space-y-5">
      {steps.map((step, index) => (
        <li key={step.title} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-3">
          <span aria-hidden="true" className="font-serif text-3xl leading-none text-terracotta-deep">
            {index + 1}
          </span>
          <div>
            <p className="font-medium">{step.title}</p>
            {detailed ? <p className="mt-1 text-espresso/75">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The two ways to buy, side by side and given equal weight.
 * `detailed` adds a sentence under each step (used on /how-to-order).
 */
export function HowItWorks({ plan, detailed = false }: { plan: Plan | null; detailed?: boolean }) {
  return (
    <div className="grid gap-y-14 lg:grid-cols-2 lg:gap-x-0">
      <section aria-labelledby="how-one-time" className="lg:pr-16">
        <h3 id="how-one-time" className="type-title">
          Buying Individual Loaves
        </h3>
        <Steps steps={oneTimeSteps} detailed={detailed} />
        <div className="mt-9">
          <ButtonLink href={routes.bread}>Browse the Bread</ButtonLink>
        </div>
      </section>

      {plan ? (
        <section
          aria-labelledby="how-club"
          className="border-t border-espresso/15 pt-14 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0"
        >
          <h3 id="how-club" className="type-title">
            Joining {plan.name}
          </h3>
          <Steps steps={clubSteps} detailed={detailed} />
          <div className="mt-9">
            <ButtonLink href={routes.club} variant="secondary">
              See the Club
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
