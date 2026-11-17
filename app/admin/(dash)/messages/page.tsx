import { AdminPage, ContactLinks, Empty, Hidden, Pill, PostForm, Save, formatWhen, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";

export default async function MessagesPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const [{ site }, messages] = await Promise.all([loadOwnerView(store), store.messages()]);
  const open = messages.filter((m) => m.status === "new");
  const done = messages.filter((m) => m.status === "resolved");

  const list = (rows: typeof messages) => (
    <ul className="space-y-5">
      {rows.map((message) => (
        <li key={message.id} className="border border-espresso/20 bg-paper px-5 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="font-serif text-2xl">{message.name}</p>
            <div className="flex gap-2">
              {message.notification_status === "failed" ? <Pill tone="attention">Email not sent</Pill> : null}
              <Pill tone={message.status === "new" ? "attention" : "muted"}>{message.status === "new" ? "New" : "Resolved"}</Pill>
            </div>
          </div>
          <p className="type-small text-espresso/70">{formatWhen(message.created_at, site.pickup.timeZone)}</p>
          <p className="mt-4 max-w-[44rem] whitespace-pre-line">{message.message}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <ContactLinks email={message.email} subject="Re: your message to OnlyLoafs" />
            <PostForm action="message-update" back="/admin/messages">
              <Hidden name="id" value={message.id} />
              <Hidden name="status" value={message.status === "new" ? "resolved" : "new"} />
              <Save quiet>{message.status === "new" ? "Mark resolved" : "Reopen"}</Save>
            </PostForm>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <AdminPage title="Messages" intro="Messages sent from the Contact page." ok={await param(searchParams, "ok")} error={await param(searchParams, "error")}>
      {open.length === 0 ? <Empty title="No new messages">You&apos;re all caught up.</Empty> : list(open)}
      {done.length > 0 ? (
        <details className="mt-10">
          <summary className="min-h-11 py-2 font-medium">Resolved ({done.length})</summary>
          <div className="mt-4">{list(done)}</div>
        </details>
      ) : null}
    </AdminPage>
  );
}
