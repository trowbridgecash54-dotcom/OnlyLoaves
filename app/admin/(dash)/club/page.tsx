import Link from "next/link";
import {
  AdminPage, Area, Choice, ContactLinks, Empty, Field, Hidden, Pill, PostForm, Save, Tick, adminLink, formatWhen, param, type Search,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { summarizeAllowance } from "@/lib/allowance";
import { formatCents } from "@/lib/format";
import { WEEKDAYS, formatPickupDate, formatWeekday } from "@/lib/pickup";

const dayOptions: [string, string][] = [["flexible", "Flexible"], ...WEEKDAYS.map((day) => [day, formatWeekday(day)] as [string, string])];
const dayLabel = (day: string) => (day === "flexible" ? "Flexible" : formatWeekday(day as (typeof WEEKDAYS)[number]));

export default async function ClubPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const [view, inquiries, subscriptions] = await Promise.all([loadOwnerView(store), store.inquiries(), store.subscriptions()]);
  const { site, today } = view;
  const plan = site.plan;
  const rule = plan?.tracking_period ?? "calendar-month";

  const periods = await store.periods({ endingOnOrAfter: today });
  const fulfillments = periods.length ? await store.fulfillments({ periodIds: periods.map((p) => p.id) }) : [];

  const pending = inquiries.filter((row) => row.status === "inquiry" || row.status === "pending-approval");
  const decided = inquiries.filter((row) => row.status === "rejected");
  const members = subscriptions.filter((row) => row.status !== "canceled");
  const canceled = subscriptions.filter((row) => row.status === "canceled");
  const activeCount = subscriptions.filter((row) => row.status === "active" || row.status === "paused").length;

  return (
    <AdminPage
      title="OnlyLoafs Club"
      intro="Review requests to join, then track each member's loaves and payments. Nothing here charges anyone."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
      aside={<Link href="/admin/club/plan" className={adminLink}>Plan and terms</Link>}
    >
      {plan ? (
        <p className="mb-8 text-espresso/80">
          {plan.name}: {formatCents(plan.price_cents)} / {plan.billing_interval}, {plan.loaves_per_period} loaves.{" "}
          {plan.accepting_requests ? "Taking requests" : "Not taking requests"}
          {plan.max_subscribers !== null ? ` · ${activeCount} of ${plan.max_subscribers} spots filled` : ` · ${activeCount} ${activeCount === 1 ? "member" : "members"}`}.
        </p>
      ) : null}

      <section className="border-t border-espresso/20 py-8">
        <h2 className="type-title">Requests to join ({pending.length})</h2>
        <p className="mt-2 max-w-[40rem] text-espresso/75">
          Contact the customer to agree the terms, payment and pickup schedule first. Approve only once that&apos;s settled — approving
          doesn&apos;t record a payment or message anyone.
        </p>
        <div className="mt-6">
          {pending.length === 0 ? (
            <Empty title="No requests waiting">New Club requests from the website appear here.</Empty>
          ) : (
            <ul className="space-y-6">
              {pending.map((row) => (
                <li key={row.id} id={row.reference} className="scroll-mt-6 border border-espresso/20 bg-paper">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-espresso/15 px-5 py-4">
                    <div>
                      <p className="font-serif text-2xl">{row.name}</p>
                      <p className="type-small text-espresso/70">{row.reference} · received {formatWhen(row.created_at, site.pickup.timeZone)}</p>
                    </div>
                    <div className="flex gap-2">
                      {row.notification_status === "failed" ? <Pill tone="attention">Email not sent</Pill> : null}
                      <Pill tone={row.status === "inquiry" ? "attention" : "neutral"}>{row.status === "inquiry" ? "New" : "In conversation"}</Pill>
                    </div>
                  </div>
                  <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
                    <dl className="space-y-3">
                      <div><dt className="type-small text-espresso/70">Contact</dt><dd><ContactLinks email={row.email} phone={row.phone} subject="Your OnlyLoafs Club request" /></dd></div>
                      <div><dt className="type-small text-espresso/70">Preferred pickup</dt><dd>{dayLabel(row.preferred_pickup_day)}, starting {formatPickupDate(row.preferred_first_pickup_date)}</dd></div>
                      {row.requested_loaves.length ? (
                        <div><dt className="type-small text-espresso/70">Bread</dt><dd>{row.requested_loaves.map((l) => (l.quantity ? `${l.quantity} × ${l.name}` : l.name)).join(", ")}</dd></div>
                      ) : null}
                      {row.bread_preferences ? <div><dt className="type-small text-espresso/70">Preferences</dt><dd className="whitespace-pre-line">{row.bread_preferences}</dd></div> : null}
                      {row.additional_requests ? <div><dt className="type-small text-espresso/70">Other requests</dt><dd className="whitespace-pre-line">{row.additional_requests}</dd></div> : null}
                    </dl>
                    <PostForm action="inquiry-update" back="/admin/club" className="space-y-4">
                      <Hidden name="id" value={row.id} />
                      <Choice label="Status" name="status" defaultValue={row.status} options={[["inquiry", "New"], ["pending-approval", "In conversation"], ["rejected", "Decline"]]} />
                      <Area label="Your notes (private)" name="owner_notes" defaultValue={row.owner_notes} rows={2} />
                      <Save quiet>Update</Save>
                    </PostForm>
                    <PostForm action="inquiry-approve" back="/admin/club" className="space-y-4 border-t border-espresso/15 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <Hidden name="id" value={row.id} />
                      <Field label="Membership starts" name="started_on" type="date" required defaultValue={row.preferred_first_pickup_date < today ? today : row.preferred_first_pickup_date} />
                      <Choice label="Pickup day" name="pickup_day" defaultValue={row.preferred_pickup_day} options={dayOptions} />
                      <Tick label="I've agreed the terms, payment and pickups with this customer" name="confirmed" required />
                      <Save>Approve membership</Save>
                    </PostForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="members" className="scroll-mt-6 border-t border-espresso/20 py-8">
        <h2 className="type-title">Members ({members.length})</h2>
        <p className="mt-2 text-espresso/75">Loaves are counted per {rule === "calendar-month" ? "calendar month" : "member's monthly anniversary"}.</p>
        <div className="mt-6">
          {members.length === 0 ? (
            <Empty title="No members yet">Approved requests become members here.</Empty>
          ) : (
            <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
              {members.map((sub) => {
                const summary = summarizeAllowance(sub, rule, periods.filter((p) => p.subscription_id === sub.id), fulfillments, today);
                const paid = summary.period?.payment_status ?? "unpaid";
                return (
                  <li key={sub.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
                    <div>
                      <Link href={`/admin/club/${sub.id}`} className={`${adminLink} font-serif text-2xl no-underline hover:underline`}>{sub.subscriber_name}</Link>
                      <p className="type-small text-espresso/70">Pickup: {dayLabel(sub.pickup_day)} · since {formatPickupDate(sub.started_on)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {sub.status === "paused" ? <Pill tone="muted">Paused</Pill> : (
                        <>
                          <Pill tone={summary.remaining > 0 ? "neutral" : "good"}>{summary.remaining} of {summary.allowance} loaves left</Pill>
                          <Pill tone={paid === "paid" || paid === "waived" ? "good" : "attention"}>{paid === "unpaid" ? "Not marked paid" : paid}</Pill>
                        </>
                      )}
                      <Link href={`/admin/club/${sub.id}`} className={`${adminLink} type-small`}>Open</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {canceled.length + decided.length > 0 ? (
        <details className="border-t border-espresso/20 py-6">
          <summary className="min-h-11 py-2 font-medium">Canceled memberships and declined requests ({canceled.length + decided.length})</summary>
          <ul className="mt-4 space-y-2">
            {canceled.map((sub) => (
              <li key={sub.id}><Link href={`/admin/club/${sub.id}`} className={adminLink}>{sub.subscriber_name}</Link> — canceled {sub.canceled_on ? formatPickupDate(sub.canceled_on) : ""}</li>
            ))}
            {decided.map((row) => (
              <li key={row.id}>{row.name} — request declined ({row.reference})</li>
            ))}
          </ul>
        </details>
      ) : null}
    </AdminPage>
  );
}
