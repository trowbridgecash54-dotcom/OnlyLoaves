import { formatPickupDate, listWeekdays } from "@/lib/pickup";
import type { PickupConfig } from "@/lib/types";

/**
 * General pickup information as the owner has saved it. Only shows what
 * she has filled in, and never an exact address: the private pickup
 * details are stored separately and are not sent to visitors at all.
 */
export function PickupInfo({ pickup, className = "" }: { pickup: PickupConfig; className?: string }) {
  const rows: [string, string][] = [
    [
      "Where",
      pickup.area
        ? `${pickup.area}. The exact location is shared when your order is confirmed.`
        : "Local pickup only. The location is shared when your order is confirmed.",
    ],
    [
      "When",
      pickup.weekdays.length > 0
        ? `Pickup is offered on ${listWeekdays(pickup.weekdays)}. Your date is final once we confirm it.`
        : "You suggest a date and we confirm it with you.",
    ],
  ];

  if (pickup.minNoticeDays && pickup.minNoticeDays > 0) {
    rows.push([
      "Notice",
      `Please order at least ${pickup.minNoticeDays} ${pickup.minNoticeDays === 1 ? "day" : "days"} ahead.`,
    ]);
  }
  if (pickup.instructions) rows.push(["How", pickup.instructions]);
  if (pickup.unavailableDates.length > 0) {
    rows.push(["No pickup", pickup.unavailableDates.map((date) => formatPickupDate(date)).join("; ")]);
  }

  return (
    <dl className={`divide-y divide-espresso/15 border-y border-espresso/15 ${className}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[7rem_1fr]">
          <dt className="font-medium">{label}</dt>
          <dd className="text-espresso/85">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
