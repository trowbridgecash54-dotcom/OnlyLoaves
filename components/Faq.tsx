import { faq, policyFallback, type FaqItem } from "@/lib/defaults";
import { fillPlanTokens } from "@/lib/format";
import type { SiteData } from "@/lib/types";

function Group({ title, items, site }: { title: string; items: FaqItem[]; site: SiteData }) {
  const fill = (text: string) => (site.plan ? fillPlanTokens(text, site.plan) : text);
  const answer = (item: FaqItem) =>
    item.policy ? site.policies[item.policy] || policyFallback : (item.answer ?? policyFallback);
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="type-title">{title}</h3>
      <div className="mt-5 border-t border-espresso/15">
        {items.map((item) => (
          <details key={item.question} className="group border-b border-espresso/15">
            <summary className="flex min-h-11 items-center justify-between gap-6 py-4 font-medium transition-colors duration-200 hover:text-terracotta-deep">
              <span>{fill(item.question)}</span>
              <span aria-hidden="true" className="faq-mark" />
            </summary>
            <p className="max-w-[38rem] whitespace-pre-line pb-5 pr-10 text-espresso/85">
              {fill(answer(item))}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Questions and answers, grouped by journey. Policy answers come from the owner's saved policies. */
export function Faq({ site }: { site: SiteData }) {
  return (
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
      <Group title="Individual orders" items={faq.filter((item) => item.group === "orders")} site={site} />
      {site.plan ? (
        <Group title={site.plan.name} items={faq.filter((item) => item.group === "club")} site={site} />
      ) : null}
    </div>
  );
}
