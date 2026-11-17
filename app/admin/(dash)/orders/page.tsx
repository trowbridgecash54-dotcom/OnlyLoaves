import Link from "next/link";
import {
  AdminPage, Area, Choice, ContactLinks, Empty, Hidden, Pill, PostForm, Save, adminLink, formatWhen, param, type Search,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { formatCents } from "@/lib/format";
import { formatPickupDate } from "@/lib/pickup";
import type { Order, OrderStatus } from "@/lib/types";

const STATUSES: [OrderStatus, string][] = [
  ["new", "New"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["ready", "Ready for pickup"],
  ["completed", "Completed"],
  ["canceled", "Canceled"],
];
const label = Object.fromEntries(STATUSES) as Record<OrderStatus, string>;

const SORTS = {
  newest: ["Newest first", (a: Order, b: Order) => b.created_at.localeCompare(a.created_at)],
  pickup: ["Pickup date", (a: Order, b: Order) => a.pickup_date.localeCompare(b.pickup_date)],
} as const;

function total(order: Order): string {
  if (order.items.some((item) => item.unit_price_cents === null)) return "Price to confirm";
  return formatCents(order.items.reduce((sum, item) => sum + (item.unit_price_cents ?? 0) * item.quantity, 0));
}

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const [{ site }, orders] = await Promise.all([loadOwnerView(store), store.orders()]);
  const filter = (await param(searchParams, "status")) ?? "open";
  const sortKey = ((await param(searchParams, "sort")) ?? "newest") as keyof typeof SORTS;
  const sort = SORTS[sortKey] ?? SORTS.newest;
  const q = ((await param(searchParams, "q")) ?? "").trim().toLowerCase();

  const shown = orders
    .filter((order) =>
      filter === "all" ? true : filter === "open" ? !["completed", "canceled"].includes(order.status) : order.status === filter,
    )
    .filter((order) =>
      q === "" ? true : [order.customer_name, order.customer_email, order.reference].some((v) => v.toLowerCase().includes(q)),
    )
    .sort(sort[1]);

  const count = (status: string) => orders.filter((order) => order.status === status).length;
  const tabs: [string, string][] = [
    ["open", `Open (${orders.filter((o) => !["completed", "canceled"].includes(o.status)).length})`],
    ...STATUSES.map(([value, text]) => [value, `${text} (${count(value)})`] as [string, string]),
    ["all", `All (${orders.length})`],
  ];
  const link = (status: string) => `/admin/orders?status=${status}&sort=${sortKey}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <AdminPage
      title="Orders"
      intro="One-time order requests. A request isn't confirmed until you contact the customer and change its status."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([value, text]) => (
          <Link
            key={value}
            href={link(value)}
            aria-current={filter === value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] ${
              filter === value ? "border-espresso bg-espresso text-cream" : "border-espresso/30 hover:border-espresso"
            }`}
          >
            {text}
          </Link>
        ))}
      </div>
      <form method="get" className="mb-8 flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={filter} />
        <label className="min-w-0 flex-1 basis-56">
          <span className="mb-1.5 block font-medium">Search</span>
          <input name="q" defaultValue={q} placeholder="Name, email or reference" className="block w-full rounded-[2px] border border-espresso/30 bg-paper px-3.5 py-2.5" />
        </label>
        <label>
          <span className="mb-1.5 block font-medium">Sort</span>
          <select name="sort" defaultValue={sortKey} className="min-h-[2.875rem] rounded-[2px] border border-espresso/30 bg-paper px-3.5">
            {Object.entries(SORTS).map(([key, [text]]) => <option key={key} value={key}>{text}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-[2px] border border-espresso px-5 font-medium hover:bg-espresso hover:text-cream">Apply</button>
      </form>

      {shown.length === 0 ? (
        <Empty title={orders.length === 0 ? "No order requests yet" : "No orders match"}>
          {orders.length === 0 ? "When a customer sends an order request from the website, it appears here." : "Try a different filter or search."}
        </Empty>
      ) : (
        <ul className="space-y-6">
          {shown.map((order) => (
            <li key={order.id} id={order.reference} className="scroll-mt-6 border border-espresso/20 bg-paper">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-espresso/15 px-5 py-4">
                <div>
                  <p className="font-serif text-2xl">{order.customer_name}</p>
                  <p className="type-small text-espresso/70">
                    {order.reference} · received {formatWhen(order.created_at, site.pickup.timeZone)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.notification_status === "failed" ? <Pill tone="attention">Email not sent</Pill> : null}
                  <Pill tone={order.status === "new" ? "attention" : order.status === "completed" ? "good" : order.status === "canceled" ? "muted" : "neutral"}>
                    {label[order.status]}
                  </Pill>
                </div>
              </div>
              <div className="grid gap-6 px-5 py-5 md:grid-cols-2">
                <dl className="space-y-3">
                  <div>
                    <dt className="type-small text-espresso/70">Loaves</dt>
                    <dd>
                      <ul>
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity} × {item.product_name}
                            {item.unit_price_cents !== null ? ` (${formatCents(item.unit_price_cents)} each)` : ""}
                          </li>
                        ))}
                      </ul>
                      <span className="type-small text-espresso/70">Total: {total(order)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="type-small text-espresso/70">Preferred pickup</dt>
                    <dd>{formatPickupDate(order.pickup_date)}</dd>
                  </div>
                  {order.notes ? (
                    <div>
                      <dt className="type-small text-espresso/70">Customer notes</dt>
                      <dd className="whitespace-pre-line">{order.notes}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="type-small text-espresso/70">Contact</dt>
                    <dd>
                      <ContactLinks email={order.customer_email} phone={order.customer_phone} subject={`Your OnlyLoafs order ${order.reference}`} />
                    </dd>
                  </div>
                </dl>
                <PostForm action="order-update" back={`/admin/orders?status=${filter}`} className="space-y-4">
                  <Hidden name="id" value={order.id} />
                  <Choice label="Status" name="status" defaultValue={order.status} options={STATUSES} />
                  <Area label="Your notes (private)" name="owner_notes" defaultValue={order.owner_notes} rows={2} />
                  <Save>Update order</Save>
                  <p className="type-small text-espresso/70">
                    Changing the status doesn&apos;t message the customer. Contact them yourself with the email or phone links.
                  </p>
                </PostForm>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="type-small mt-8">
        <Link href="/admin" className={adminLink}>Back to overview</Link>
      </p>
    </AdminPage>
  );
}
