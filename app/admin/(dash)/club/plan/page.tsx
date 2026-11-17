import Link from "next/link";
import { AdminPage, Area, Choice, Empty, Field, Hidden, PostForm, Save, Section, Tick, adminLink, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { policyLabels } from "@/lib/defaults";
import type { PolicyKey } from "@/lib/types";

const POLICY_HINTS: Record<PolicyKey, string> = {
  payment: "How and when members pay you, e.g. cash or Venmo at the first pickup each month.",
  renewal: "Whether membership continues month to month until canceled.",
  pauseAndCancel: "How members pause or cancel, and any notice you need.",
  missedPickup: "What happens if a member doesn't come for an arranged pickup.",
  unusedLoaves: "Whether loaves not picked up by month's end expire, roll over or become credit.",
  refunds: "Whether and when you give refunds.",
};

export default async function PlanPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const { site } = await loadOwnerView(store);
  const plan = site.plan;

  return (
    <AdminPage
      title="Plan and terms"
      intro="What the website offers. Changes apply to new members; existing members keep the price and loaves they were approved with."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
      aside={<Link href="/admin/club" className={adminLink}>Back to Club</Link>}
    >
      {!plan ? (
        <Empty title="No plan found">The database setup didn&apos;t create the Club plan. See the README.</Empty>
      ) : (
        <Section title="The plan">
          <PostForm action="plan-save" back="/admin/club/plan" className="grid max-w-[48rem] gap-5 sm:grid-cols-2">
            <Hidden name="id" value={plan.id} />
            <div className="sm:col-span-2"><Field label="Name" name="name" required defaultValue={plan.name} /></div>
            <Field label="Price per month ($)" name="price" inputMode="decimal" required defaultValue={(plan.price_cents / 100).toFixed(plan.price_cents % 100 ? 2 : 0)} />
            <Field label="Loaves included each month" name="loaves_per_period" type="number" required defaultValue={plan.loaves_per_period} />
            <Field label="Subscriber limit" name="max_subscribers" type="number" defaultValue={plan.max_subscribers ?? ""} hint="Leave blank for no limit. Approvals stop when it's reached." />
            <Choice label="How members choose bread" name="selection_mode" defaultValue={plan.selection_mode} options={[["choose", "They pick specific loaves"], ["preferences", "They say what they like; you choose"]]} />
            <Choice label="Count loaves per" name="tracking_period" defaultValue={plan.tracking_period} options={[["calendar-month", "Calendar month"], ["anniversary", "Each member's monthly start date"]]} />
            <Choice label="Unused loaves" name="unused_loaf_policy" defaultValue={plan.unused_loaf_policy} options={[["undecided", "Not decided yet"], ["expire", "Expire at the end of the period"], ["rollover", "Roll over"], ["credit", "Become credit"]]} hint="Internal setting. Describe the rule to customers under Policies below." />
            <div className="sm:col-span-2 space-y-1">
              <Tick label="Show the Club on the website" name="enabled" defaultChecked={plan.enabled} />
              <Tick label="Accept new requests to join" name="accepting_requests" defaultChecked={plan.accepting_requests} />
              <Tick label="Members may mix different breads" name="allow_mixed_loaves" defaultChecked={plan.allow_mixed_loaves} />
              <Tick label="Mention that members can ask to pause" name="allow_pause_requests" defaultChecked={plan.allow_pause_requests} />
            </div>
            <div className="sm:col-span-2"><Area label="Message when not accepting requests" name="closed_message" defaultValue={plan.closed_message} rows={2} /></div>
            <div className="sm:col-span-2"><Save>Save plan</Save></div>
          </PostForm>
        </Section>
      )}

      <Section
        id="policies"
        title="Policies"
        description="Shown on the Club page, the enrollment form and the FAQ. Leave one blank until you've decided — the site then says it will be confirmed with the customer. Decide these before taking members."
      >
        <PostForm action="policies-save" back="/admin/club/plan" className="max-w-[48rem] space-y-5">
          {(Object.keys(policyLabels) as PolicyKey[]).map((key) => (
            <Area key={key} label={policyLabels[key]} name={key} defaultValue={site.policies[key]} hint={POLICY_HINTS[key]} />
          ))}
          <Save>Save policies</Save>
        </PostForm>
      </Section>
    </AdminPage>
  );
}
