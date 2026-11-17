"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { numberWord, pluralize } from "@/lib/format";
import { formatWeekday, WEEKDAYS } from "@/lib/pickup";
import type { PickupConfig, Plan, PolicySettings, Product } from "@/lib/types";
import { PolicyList } from "../club";
import { Stepper } from "../Stepper";
import {
  FormSection,
  Honeypot,
  SelectField,
  TextAreaField,
  TextField,
} from "./fields";
import { Confirmation, FormAlert, PickupDateField, SubmitButton } from "./parts";
import { field, useRequestForm } from "./useRequestForm";

/**
 * OnlyLoafs Club enrollment request. Submitting this creates an inquiry
 * for the owner — never an active subscription and never a charge.
 */
export function ClubForm({
  plan,
  eligibleProducts,
  pickup,
  policies,
}: {
  plan: Plan;
  eligibleProducts: Product[];
  pickup: PickupConfig;
  policies: PolicySettings;
}) {
  const { status, errors, message, reference, submit, alertRef, confirmationRef } =
    useRequestForm("/api/club");

  // "choose" mode: a quantity per bread, capped at the plan's allowance.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // "preferences" mode: breads the customer likes.
  const [liked, setLiked] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);

  const allowance = plan.loaves_per_period;
  const loafWord = pluralize(allowance, "loaf", "loaves");
  const chosen = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const remaining = allowance - chosen;
  const choosing = plan.selection_mode === "choose" && eligibleProducts.length > 0;

  const dayOptions = [
    { value: "flexible", label: "I'm flexible" },
    ...(pickup.weekdays.length > 0 ? pickup.weekdays : WEEKDAYS).map((day) => ({
      value: day,
      label: formatWeekday(day),
    })),
  ];

  function selections(form: HTMLFormElement) {
    if (!choosing) return [];
    if (!plan.allow_mixed_loaves) {
      // Mixing isn't allowed: one bread for every loaf in the allowance.
      const productId = field(form, "singleChoice");
      return productId ? [{ productId, quantity: allowance }] : [];
    }
    return Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void submit(form, {
      planId: plan.id,
      name: field(form, "name"),
      email: field(form, "email"),
      phone: field(form, "phone"),
      pickupDay: field(form, "pickupDay"),
      firstPickupDate: field(form, "firstPickupDate"),
      selections: selections(form),
      preferredProductIds: plan.selection_mode === "preferences" ? liked : [],
      breadPreferences: field(form, "breadPreferences"),
      requests: field(form, "requests"),
      acceptedTerms: accepted,
    });
  }

  if (status === "sent") {
    return (
      <Confirmation heading="Welcome to the Next Step." reference={reference} confirmationRef={confirmationRef}>
        <p>
          Thanks for your interest in {plan.name}! We&apos;ll reach out to confirm your
          subscription, bread selections, payment arrangements, and pickup schedule.
        </p>
        <p className="text-base text-espresso/75">
          Your subscription isn&apos;t active yet and nothing has been charged.
        </p>
      </Confirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-12">
      <Honeypot />

      <FormSection step={1} title="Your details">
        <TextField
          label="Full name"
          name="name"
          required
          autoComplete="name"
          error={errors.name}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Email address"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            error={errors.email}
          />
          <TextField
            label="Phone number"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            error={errors.phone}
          />
        </div>
      </FormSection>

      <FormSection step={2} title="Pickup">
        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField
            label="Preferred pickup day"
            name="pickupDay"
            required
            defaultValue="flexible"
            options={dayOptions}
            error={errors.pickupDay}
            hint="The day that usually suits you."
          />
          <PickupDateField
            name="firstPickupDate"
            label="Preferred first pickup date"
            error={errors.firstPickupDate}
            pickup={pickup}
          />
        </div>
        <p className="type-small text-espresso/75">
          Local pickup only. Your recurring schedule is arranged with us directly, and
          dates aren&apos;t final until we confirm them.
        </p>
      </FormSection>

      <FormSection step={3} title="Your bread">
        {choosing && plan.allow_mixed_loaves ? (
          <div>
            <p id="selection-help" className="mb-4">
              Tell us which {numberWord(allowance)} {loafWord} you&apos;d like most{" "}
              {plan.billing_interval}s. Leave any unchosen and we&apos;ll pick for you.
            </p>
            <ul
              aria-describedby="selection-help"
              className="divide-y divide-espresso/15 border-y border-espresso/15"
            >
              {eligibleProducts.map((product) => {
                const value = quantities[product.id] ?? 0;
                return (
                  <li
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                  >
                    <p className="font-medium">{product.name}</p>
                    <Stepper
                      value={value}
                      max={value + remaining}
                      itemName={product.name}
                      onChange={(next) =>
                        setQuantities((current) => ({ ...current, [product.id]: next }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <p aria-live="polite" className="mt-4 font-medium">
              {chosen} of {allowance} {loafWord} chosen
            </p>
          </div>
        ) : null}

        {choosing && !plan.allow_mixed_loaves ? (
          <SelectField
            label={`Which bread would you like for your ${numberWord(allowance)} ${loafWord}?`}
            name="singleChoice"
            placeholder="No preference"
            options={eligibleProducts.map((product) => ({
              value: product.id,
              label: product.name,
            }))}
            hint={`All ${numberWord(allowance)} ${loafWord} are the same kind each ${plan.billing_interval}.`}
          />
        ) : null}

        {plan.selection_mode === "preferences" && eligibleProducts.length > 0 ? (
          <fieldset>
            <legend className="mb-3 font-medium">Breads you&apos;d like to receive</legend>
            <ul className="space-y-1">
              {eligibleProducts.map((product) => (
                <li key={product.id}>
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-espresso"
                      checked={liked.includes(product.id)}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setLiked((current) =>
                          event.target.checked
                            ? [...current, product.id]
                            : current.filter((id) => id !== product.id),
                        )
                      }
                    />
                    <span>{product.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {errors.selections ? (
          <p className="type-small font-medium text-terracotta-deep">{errors.selections}</p>
        ) : null}
        <p className="type-small text-espresso/75">
          Selections depend on what&apos;s being baked. We&apos;ll confirm yours with you.
        </p>

        <TextAreaField
          label="Bread preferences"
          name="breadPreferences"
          rows={3}
          maxLength={1000}
          hint="Favorites, breads to avoid, or anything you'd like us to know."
        />
        <TextAreaField
          label="Additional requests"
          name="requests"
          rows={3}
          maxLength={1500}
        />
      </FormSection>

      <FormSection step={4} title="Before you join">
        <PolicyList policies={policies} />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="acceptedTerms"
            required
            checked={accepted}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAccepted(event.target.checked)}
            aria-invalid={errors.acceptedTerms ? true : undefined}
            className="mt-1 size-5 shrink-0 accent-espresso"
          />
          <span>
            I understand this is a request to join, not an active subscription.
            Membership is arranged and confirmed by the owner: the price, payment,
            pickup schedule and terms above are confirmed with me before anything
            starts, and nothing is charged automatically.
          </span>
        </label>
        {errors.acceptedTerms ? (
          <p className="type-small font-medium text-terracotta-deep">
            {errors.acceptedTerms}
          </p>
        ) : null}
      </FormSection>

      <div className="space-y-5 border-t border-espresso/20 pt-7">
        <FormAlert message={message} alertRef={alertRef} />
        <SubmitButton status={status} sendingLabel="Sending your request…">
          Send Enrollment Request
        </SubmitButton>
        <p className="type-small max-w-[34rem] text-espresso/75">
          Subscription requests are reviewed before enrollment is confirmed. You
          won&apos;t be charged by submitting this form.
        </p>
      </div>
    </form>
  );
}
