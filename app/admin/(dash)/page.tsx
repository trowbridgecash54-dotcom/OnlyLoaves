import Link from "next/link";
import { AdminPage, Empty, Pill, adminLink, formatWhen, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { buildChecklist, remaining } from "@/lib/checklist";
import { isEmailConfigured } from "@/lib/email";
import { formatPickupDate } from "@/lib/pickup";
import { canSaveSubmissions, isBackendConfigured } from "@/lib/backend";
import { isRequestable } from "@/lib/site-build";

export default async function OverviewPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const [view, orders, inquiries, subscriptions, messages] = await Promise.all([
    loadOwnerView(store),
    store.orders(),
    store.inquiries(),
    store.subscriptions(),
    store.messages(),
  ]);
  const { site, today } = view;
  const tz = site.pickup.timeZone;

  const newOrders = orders.filter((order) => order.status === "new");
  const pendingInquiries = inquiries.filter((row) => row.status === "inquiry" || row.status === "pending-approval");
  const active = subscriptions.filter((row) => row.status === "active");
  const upcoming = orders
    .filter((order) => order.pickup_date >= today && !["completed", "canceled"].includes(order.status))
    .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))
    .slice(0, 6);
  const available = site.products.filter(isRequestable);
  const newMessages = messages.filter((message) => message.status === "new");
  const failedEmails = [...orders, ...inquiries, ...messages].filter((row) => row.notification_status === "failed").length;

  const todo = remaining(
    buildChecklist(site, view.launch, {
      databaseConnected: isBackendConfigured(),
      canSaveForms: canSaveSubmissions(),
      emailConfigured: isEmailConfigured(),
      siteUrlSet: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      ownerAccountExists: true,
    }),
  );

  type Activity = { when: string; text: string; href: string };
  const activity: Activity[] = [
    ...orders.map((order) => ({ when: order.created_at, text: `Order request ${order.reference} from ${order.customer_name}`, href: `/admin/orders#${order.reference}` })),
    ...inquiries.map((row) => ({ when: row.created_at, text: `Club request ${row.reference} from ${row.name}`, href: `/admin/club#${row.reference}` })),
    ...messages.map((row) => ({ when: row.created_at, text: `Message from ${row.name}`, href: "/admin/messages" })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 8);

  const tiles: [string, number, string][] = [
    ["New order requests", newOrders.length, "/admin/orders?status=new"],
    ["Club requests to review", pendingInquiries.length, "/admin/club"],
    ["Active Club members", active.length, "/admin/club#members"],
    ["Loaves available to order", available.length, "/admin/products"],
    ["Unanswered messages", newMessages.length, "/admin/messages"],
  ];

  return (
    <AdminPage title="Overview" ok={await param(searchParams, "ok")} error={await param(searchParams, "error")}>
      {!site.business.ordersOpen ? (
        <p className="mb-8 border-l-2 border-terracotta bg-paper px-5 py-4">
          <strong className="font-medium">Ordering is closed to the public.</strong> Customers can browse but can&apos;t send
          order or Club requests. Open it under{" "}
          <Link href="/admin/settings" className={adminLink}>Settings</Link> once the{" "}
          <Link href="/admin/checklist" className={adminLink}>launch checklist</Link> is done
          {todo.length > 0 ? ` (${todo.length} items left)` : ""}.
        </p>
      ) : null}
      {failedEmails > 0 ? (
        <p className="mb-8 border-l-2 border-terracotta-deep bg-paper px-5 py-4">
          {failedEmails} notification {failedEmails === 1 ? "email" : "emails"} didn&apos;t send. The requests are all saved
          here — look for the “Email not sent” label.
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-px border border-espresso/15 bg-espresso/15 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, count, href]) => (
          <li key={label} className="bg-paper">
            <Link href={href} className="block h-full px-5 py-5 hover:bg-wheat/50">
              <span className="block font-serif text-5xl leading-none">{count}</span>
              <span className="type-small mt-2 block">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="type-title">Upcoming pickups</h2>
          <p className="type-small mt-1 text-espresso/70">One-time orders that aren&apos;t completed or canceled.</p>
          <div className="mt-5">
            {upcoming.length === 0 ? (
              <Empty title="No pickups coming up">Order requests with a future pickup date will show here.</Empty>
            ) : (
              <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
                {upcoming.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <Link href={`/admin/orders#${order.reference}`} className={adminLink}>
                      {formatPickupDate(order.pickup_date)} — {order.customer_name}
                    </Link>
                    <Pill tone={order.status === "new" ? "attention" : "neutral"}>{order.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="type-title">Recent activity</h2>
          <p className="type-small mt-1 text-espresso/70">The latest requests and messages from the website.</p>
          <div className="mt-5">
            {activity.length === 0 ? (
              <Empty title="Nothing yet">When customers send requests or messages, they&apos;ll appear here.</Empty>
            ) : (
              <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
                {activity.map((item) => (
                  <li key={item.when + item.text} className="py-3">
                    <Link href={item.href} className={adminLink}>{item.text}</Link>
                    <span className="type-small block text-espresso/65">{formatWhen(item.when, tz)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
