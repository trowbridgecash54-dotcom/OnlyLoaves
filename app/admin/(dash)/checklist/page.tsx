import { AdminPage, Area, PostForm, Save, Section, Tick, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { canSaveSubmissions, isBackendConfigured } from "@/lib/backend";
import { buildChecklist, remaining, type ChecklistGroup } from "@/lib/checklist";
import { isEmailConfigured } from "@/lib/email";

const GROUPS: ChecklistGroup[] = ["Business information", "Bread", "Accounts and services", "Policies and permits"];

export default async function ChecklistPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const { site, launch } = await loadOwnerView(store);
  const items = buildChecklist(site, launch, {
    databaseConnected: isBackendConfigured(),
    canSaveForms: canSaveSubmissions(),
    emailConfigured: isEmailConfigured(),
    siteUrlSet: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    ownerAccountExists: true,
  });
  const left = remaining(items).length;

  return (
    <AdminPage
      title="Launch checklist"
      intro={left === 0 ? "Everything required is done." : `${left} required items left before opening for orders. Optional items are marked.`}
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
    >
      {GROUPS.map((group) => (
        <Section key={group} title={group}>
          <ul className="max-w-[48rem] divide-y divide-espresso/15 border-y border-espresso/15">
            {items.filter((item) => item.group === group).map((item) => (
              <li key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
                <span className={item.done ? "text-espresso/55" : ""}>
                  <span aria-hidden="true" className="mr-2 inline-block w-4">{item.done ? "✓" : "○"}</span>
                  <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
                  {item.label}
                  {item.optional ? <span className="type-small text-espresso/60"> (optional)</span> : null}
                </span>
                {!item.done ? <span className="type-small text-espresso/70">{item.where}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Your confirmations" description="Tick these yourself once they're true. The website can't check them for you.">
        <PostForm action="launch-save" back="/admin/checklist" className="max-w-[48rem] space-y-3">
          <Tick label="My cottage-food permit is approved" name="permitConfirmed" defaultChecked={launch.permitConfirmed} hint="Then add any required wording under Settings → Required disclosures." />
          <Tick label="My product labels and ingredient/allergen information are confirmed" name="labelsConfirmed" defaultChecked={launch.labelsConfirmed} />
          <Area label="Notes" name="notes" defaultValue={launch.notes} />
          <Save>Save</Save>
        </PostForm>
      </Section>
    </AdminPage>
  );
}
