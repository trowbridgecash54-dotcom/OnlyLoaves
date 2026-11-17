import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminPage, Area, Choice, ContactLinks, Field, Hidden, Pill, PostForm, Save, Section, Tick, adminLink, param, type Search,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { summarizeAllowance } from "@/lib/allowance";
import { formatCents } from "@/lib/format";
import { WEEKDAYS, formatPickupDate, formatWeekday } from "@/lib/pickup";

const dayOptions: [string, string][] = [["flexible", "Flexible"], ...WEEKDAYS.map((day) => [day, formatWeekday(day)] as [string, string])];

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const { store } = await requireAdmin();
  const [view, subscription] = await Promise.all([loadOwnerView(store), store.subscription(id)]);
  if (!subscription) notFound();
  const { site, today } = view;
  const [periods, fulfillments] = await Promise.all([
    store.periods({ subscriptionId: id }),
    store.fulfillments({ subscriptionId: id }),
  ]);
  const rule = site.plan?.tracking_period ?? "calendar-month";
  const summary = summarizeAllowance(subscription, rule, periods, fulfillments, today);
  const back = `/admin/club/${id}`;
  const eligible = site.products.filter((product) => product.club_eligible);

  return (
    <AdminPage
      title={subscription.subscriber_name}
      intro={`Member since ${formatPickupDate(subscription.started_on)} · ${formatCents(subscription.price_cents)} / month for ${subscription.loaves_per_period} loaves (as approved)`}
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
      aside={<Link href="/admin/club" className={adminLink}>All Club members</Link>}
    >
      <ContactLinks email={subscription.subscriber_email} phone={subscription.subscriber_phone} subject="Your OnlyLoafs Club membership" />

      <Section
        title="This period's loaves"
        description={`${formatPickupDate(summary.startsOn)} – ${formatPickupDate(summary.endsOn)}. Unused loaves are not carried into the next period unless you set a rollover rule.`}
      >
        {!summary.applies ? (
          <p className="border-l-2 border-terracotta bg-paper px-5 py-4">
            This membership is {subscription.status === "active" ? "not started yet" : subscription.status}, so no loaves are allowed this period.
          </p>
        ) : (
          <>
            <dl className="grid max-w-[36rem] grid-cols-3 gap-px border border-espresso/15 bg-espresso/15 text-center">
              {[["Allowance", summary.allowance], ["Fulfilled", summary.fulfilled], ["Remaining", summary.remaining]].map(([label, value]) => (
                <div key={label} className="bg-paper px-3 py-4">
                  <dt className="type-small text-espresso/70">{label}</dt>
                  <dd className="font-serif text-5xl leading-none">{value}</dd>
                </div>
              ))}
            </dl>
            {summary.extras > 0 ? <p className="type-small mt-2">Plus {summary.extras} extra {summary.extras === 1 ? "loaf" : "loaves"} recorded as additional purchases.</p> : null}

            <PostForm action="loaf-fulfill" back={back} className="mt-6 grid max-w-[44rem] gap-4 sm:grid-cols-2">
              <Hidden name="subscription_id" value={id} />
              {/* A fresh key per page view: a double click records one loaf, not two. */}
              <Hidden name="key" value={randomUUID()} />
              <Choice label="Bread" name="product_id" defaultValue={eligible[0]?.id ?? ""} options={[...eligible.map((p) => [p.id, p.name] as [string, string]), ["", "Not specified"]]} />
              <Field label="Picked up on" name="fulfilled_on" type="date" defaultValue={today} />
              {summary.remaining === 0 ? (
                <div className="sm:col-span-2">
                  <Tick label="Record as an extra loaf" name="as_extra" hint="All included loaves are used. Tick this only if the member is buying an additional loaf." />
                </div>
              ) : null}
              <div className="sm:col-span-2"><Save>Mark one loaf fulfilled</Save></div>
            </PostForm>
          </>
        )}
      </Section>

      <Section title="Payment for this period" description="Record payments you've received directly. The website never takes or charges payments.">
        {subscription.status !== "active" && !summary.period ? (
          <p className="text-espresso/75">Nothing to record while the membership isn&apos;t active.</p>
        ) : (
          <PostForm action="period-update" back={back} className="grid max-w-[44rem] gap-4 sm:grid-cols-2">
            <Hidden name="subscription_id" value={id} />
            <Hidden name="period_date" value={summary.startsOn} />
            <Choice label="Status" name="payment_status" defaultValue={summary.period?.payment_status ?? "unpaid"} options={[["unpaid", "Not paid yet"], ["paid", "Paid"], ["waived", "Waived"], ["refunded", "Refunded"]]} />
            <Field label="Paid on" name="paid_on" type="date" defaultValue={summary.period?.paid_on ?? ""} />
            <div className="sm:col-span-2"><Field label="Note (e.g. cash, Venmo)" name="payment_note" defaultValue={summary.period?.payment_note ?? ""} /></div>
            <div className="sm:col-span-2"><Save quiet>Record payment status</Save></div>
          </PostForm>
        )}
      </Section>

      <Section title="Membership" description="Pause or cancel here. Changing status doesn't message the member.">
        <PostForm action="subscription-update" back={back} className="grid max-w-[44rem] gap-4 sm:grid-cols-2">
          <Hidden name="id" value={id} />
          <Choice label="Status" name="status" defaultValue={subscription.status} options={[["active", "Active"], ["paused", "Paused"], ["canceled", "Canceled"]]} />
          <Choice label="Pickup day" name="pickup_day" defaultValue={subscription.pickup_day} options={dayOptions} />
          <div className="sm:col-span-2"><Area label="Pickup arrangements (private)" name="pickup_notes" defaultValue={subscription.pickup_notes} rows={2} /></div>
          <div className="sm:col-span-2"><Area label="Your notes (private)" name="owner_notes" defaultValue={subscription.owner_notes} rows={2} /></div>
          <div className="sm:col-span-2"><Save>Save membership</Save></div>
        </PostForm>
      </Section>

      <Section title="Loaf history" description="Every loaf ever recorded. Records can't be deleted; void one if it was a mistake, which gives the loaf back.">
        {fulfillments.length === 0 ? (
          <p className="text-espresso/75">No loaves recorded yet.</p>
        ) : (
          <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
            {fulfillments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                <span className={row.voided_at ? "text-espresso/50 line-through" : ""}>
                  {formatPickupDate(row.fulfilled_on)} — {row.product_name || "Bread not specified"}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {row.is_authorized_extra ? <Pill>Extra purchase</Pill> : null}
                  {row.voided_at ? (
                    <Pill tone="muted">Voided{row.void_reason ? `: ${row.void_reason}` : ""}</Pill>
                  ) : (
                    <PostForm action="loaf-void" back={back} className="flex items-center gap-2">
                      <Hidden name="id" value={row.id} />
                      <Hidden name="subscription_id" value={id} />
                      <Hidden name="reason" value="Recorded by mistake" />
                      <Save quiet>Void</Save>
                    </PostForm>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AdminPage>
  );
}
