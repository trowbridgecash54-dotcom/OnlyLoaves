import { AdminPage, Area, Choice, Field, Hidden, PostForm, Save, Section, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { WEEKDAYS, formatPickupDate, formatWeekday } from "@/lib/pickup";

const ZONES: [string, string][] = [
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
];

export default async function PickupPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const { site, pickupPrivate, today } = await loadOwnerView(store);
  const { pickup } = site;
  const upcoming = pickup.unavailableDates.filter((date) => date >= today);

  return (
    <AdminPage
      title="Pickup"
      intro="These settings decide which dates customers can choose on the order and Club forms. Every date is a preference until you confirm it."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
    >
      <Section title="Schedule">
        <PostForm action="pickup-save" back="/admin/pickup" className="grid max-w-[48rem] gap-5 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 font-medium">Pickup days</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="weekdays" value={day} defaultChecked={pickup.weekdays.includes(day)} className="size-5 accent-espresso" />
                  {formatWeekday(day)}
                </label>
              ))}
            </div>
            <p className="type-small mt-1 text-espresso/70">With no days ticked, customers can suggest any date.</p>
          </fieldset>
          <Field label="Minimum notice (days)" name="minNoticeDays" type="number" defaultValue={pickup.minNoticeDays ?? ""} hint="Blank means same-day requests are allowed." />
          <Field label="Book up to (days ahead)" name="maxAdvanceDays" type="number" defaultValue={pickup.maxAdvanceDays ?? ""} hint="Blank means no limit." />
          <Choice label="Time zone" name="timeZone" defaultValue={pickup.timeZone} options={ZONES} />
          <Field label="General pickup area" name="area" defaultValue={pickup.area} hint="Shown publicly. A neighborhood or town only — never a street address." />
          <div className="sm:col-span-2"><Area label="Public pickup instructions" name="instructions" defaultValue={pickup.instructions} hint="Shown on the website, e.g. “Porch pickup, 9am to noon.”" /></div>

          <div className="space-y-5 border-t border-espresso/20 pt-5 sm:col-span-2">
            <p className="font-medium">Private — never shown on the website</p>
            <Area label="Exact pickup address" name="private_address" defaultValue={pickupPrivate.address} rows={2} hint="Only for your reference here. Share it with customers yourself when you confirm." />
            <Area label="Private pickup notes" name="private_instructions" defaultValue={pickupPrivate.instructions} />
          </div>
          <div className="sm:col-span-2"><Save>Save pickup settings</Save></div>
        </PostForm>
      </Section>

      <Section title="Days off" description="Block holidays or vacations so customers can't choose them.">
        <PostForm action="closure-add" back="/admin/pickup" className="flex max-w-[48rem] flex-wrap items-end gap-4">
          <div className="basis-44"><Field label="Date" name="closed_on" type="date" required /></div>
          <div className="min-w-0 flex-1 basis-56"><Field label="Note (private)" name="note" /></div>
          <Save quiet>Block date</Save>
        </PostForm>
        {upcoming.length ? (
          <ul className="mt-6 max-w-[48rem] divide-y divide-espresso/15 border-y border-espresso/15">
            {upcoming.map((date) => (
              <li key={date} className="flex items-center justify-between gap-4 py-2">
                {formatPickupDate(date)}
                <PostForm action="closure-remove" back="/admin/pickup">
                  <Hidden name="closed_on" value={date} />
                  <Save quiet>Reopen</Save>
                </PostForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-espresso/70">No upcoming days off.</p>
        )}
      </Section>
    </AdminPage>
  );
}
