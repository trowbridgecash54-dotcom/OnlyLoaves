"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  formatPickupDate,
  getPickupWindow,
  listPickupDates,
  listWeekdays,
  todayInTimeZone,
} from "@/lib/pickup";
import type { PickupConfig } from "@/lib/types";
import { buttonClass } from "../ui";
import { SelectField, TextField } from "./fields";
import type { FormStatus } from "./useRequestForm";

/**
 * Preferred pickup date. When the owner has set pickup days in the
 * dashboard this is a list of real dates; until then it's an open
 * date field. Either way the date is a preference until confirmed.
 */
export function PickupDateField({
  name,
  label,
  error,
  pickup,
}: {
  name: string;
  label: string;
  error?: string;
  pickup: PickupConfig;
}) {
  // "Today" depends on when the page is opened, so work it out in the browser.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayInTimeZone(pickup.timeZone)), [pickup.timeZone]);

  const hint = "This is your preference. We'll confirm the date with you.";

  if (pickup.weekdays.length > 0) {
    const dates = today ? listPickupDates(pickup, today) : [];
    return (
      <SelectField
        key={today ?? "loading"}
        label={label}
        name={name}
        required
        error={error}
        placeholder={today ? "Choose a date" : "Loading dates…"}
        options={dates.map((date) => ({ value: date, label: formatPickupDate(date) }))}
        hint={`Pickup is offered on ${listWeekdays(pickup.weekdays)}. ${hint}`}
      />
    );
  }

  const range = today ? getPickupWindow(pickup, today) : null;
  return (
    <TextField
      label={label}
      name={name}
      type="date"
      required
      error={error}
      min={range?.earliest}
      max={range?.latest ?? undefined}
      hint={hint}
    />
  );
}

/** Error summary shown above the submit button. */
export function FormAlert({
  message,
  alertRef,
}: {
  message: string;
  alertRef: RefObject<HTMLDivElement | null>;
}) {
  if (!message) return null;
  return (
    <div
      ref={alertRef}
      role="alert"
      tabIndex={-1}
      className="border-l-2 border-terracotta-deep bg-paper px-5 py-4 font-medium text-terracotta-deep"
    >
      {message}
    </div>
  );
}

export function SubmitButton({
  status,
  children,
  sendingLabel,
}: {
  status: FormStatus;
  children: ReactNode;
  sendingLabel: string;
}) {
  const sending = status === "sending";
  return (
    <button
      type="submit"
      disabled={sending}
      className={buttonClass("primary", "w-full sm:w-auto sm:min-w-64")}
    >
      {sending ? sendingLabel : children}
    </button>
  );
}

/** Shown in place of a form once the request has been delivered. */
export function Confirmation({
  heading,
  reference = "",
  children,
  confirmationRef,
}: {
  heading: string;
  /** The saved request's reference, e.g. OL-7K3F9Q. */
  reference?: string;
  children: ReactNode;
  confirmationRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <motion.div
      ref={confirmationRef}
      tabIndex={-1}
      role="status"
      className="border border-espresso bg-paper px-6 py-10 sm:px-10 sm:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-olive-deep text-cream">
        <Check size={22} strokeWidth={2} />
      </span>
      <h2 className="type-headline mt-6">{heading}</h2>
      <div className="type-lede mt-5 max-w-[34rem] space-y-4">{children}</div>
      {reference ? (
        <p className="mt-6 border-t border-espresso/15 pt-5">
          Your reference is <strong className="font-medium tracking-wide">{reference}</strong>. Mention it
          if you get in touch.
        </p>
      ) : null}
    </motion.div>
  );
}
