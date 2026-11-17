import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { policyFallback, policyLabels } from "@/lib/defaults";
import { capitalize, formatCents, numberWord, pluralize } from "@/lib/format";
import type { Plan, PolicyKey, PolicySettings } from "@/lib/types";

/** What the plan includes, built from the plan settings so it can't drift. */
export function planFeatures(plan: Plan): string[] {
  const loaves = pluralize(plan.loaves_per_period, "loaf", "loaves");
  return [
    "Freshly baked sourdough",
    `${capitalize(numberWord(plan.loaves_per_period))} ${loaves} each ${plan.billing_interval}`,
    ...(plan.pickup_only ? ["Local pickup"] : []),
    "Bread selection based on availability",
  ];
}

/** One small scored loaf per loaf in the allowance, like a bakery punch card. */
function LoafPunches({ count }: { count: number }) {
  if (count > 8) return null;
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <svg key={index} viewBox="0 0 32 32" className="size-7 sm:size-8">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 20c5-1.5 9-4.5 12-9"
            fill="none"
            stroke="var(--color-terracotta)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * The Club's signature element: the plan presented as a bakery card,
 * with a tear line and one punch per loaf. Everything on it comes from
 * the plan the owner has saved.
 *
 *   detailed={false}  compact version for the homepage
 *   detailed          full version for the Club page, with features and a slot for the button
 */
export function ClubCard({
  plan,
  detailed = false,
  children,
  className = "",
}: {
  plan: Plan;
  detailed?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const loaves = pluralize(plan.loaves_per_period, "loaf", "loaves");

  return (
    <div className={`border border-espresso bg-paper text-espresso ${className}`}>
      <div className="px-6 pb-6 pt-6 sm:px-9 sm:pb-8 sm:pt-8">
        <p className={detailed ? "type-label" : "font-medium"}>{plan.name}</p>
        <p className="mt-5 flex items-baseline gap-3">
          <span className="type-price">{formatCents(plan.price_cents, plan.currency)}</span>
          <span className="text-lg">/ {plan.billing_interval}</span>
        </p>
      </div>

      <div className="perforation mx-6 sm:mx-9" />

      <div className="px-6 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-lg font-medium">
            {plan.loaves_per_period} {loaves}{" "}
            {detailed ? "included" : `each ${plan.billing_interval}`}
          </p>
          <LoafPunches count={plan.loaves_per_period} />
        </div>

        {detailed ? (
          <ul className="mt-6 space-y-2.5">
            {planFeatures(plan).map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check size={18} strokeWidth={1.75} className="mt-[0.3rem] shrink-0 text-olive-deep" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : plan.pickup_only ? (
          <p className="mt-1 text-espresso/80">Local pickup</p>
        ) : null}

        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * The Club's policies as the owner has set them. Anything not decided
 * yet says so plainly instead of inventing a rule.
 */
export function PolicyList({
  policies,
  className = "",
}: {
  policies: PolicySettings;
  className?: string;
}) {
  const keys = Object.keys(policyLabels) as PolicyKey[];

  // Nothing decided yet: say so once rather than repeating it on every row.
  if (keys.every((key) => policies[key] === "")) {
    const topics = keys.map((key) => policyLabels[key].toLowerCase());
    const list = `${topics.slice(0, -1).join(", ")} and ${topics[topics.length - 1]}`;
    return (
      <p className={`border-y border-espresso/15 py-5 ${className}`}>
        {capitalize(list)}: we&apos;ll confirm these with you before your subscription starts.
      </p>
    );
  }

  return (
    <dl className={`divide-y divide-espresso/15 border-y border-espresso/15 ${className}`}>
      {keys.map((key) => (
        <div key={key} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[11rem_1fr]">
          <dt className="font-medium">{policyLabels[key]}</dt>
          <dd className={policies[key] ? "whitespace-pre-line" : "text-espresso/75"}>
            {policies[key] || policyFallback}
          </dd>
        </div>
      ))}
    </dl>
  );
}
