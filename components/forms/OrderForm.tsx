"use client";

import { useState, type FormEvent } from "react";
import { maxQuantityPerLoaf, priceFallback } from "@/lib/defaults";
import { formatCents, pluralize } from "@/lib/format";
import type { PickupConfig, Product } from "@/lib/types";
import { routes } from "@/lib/site";
import { Stepper } from "../Stepper";
import { TextLink } from "../ui";
import { FormSection, Honeypot, TextAreaField, TextField } from "./fields";
import { Confirmation, FormAlert, PickupDateField, SubmitButton } from "./parts";
import { field, useRequestForm } from "./useRequestForm";

/**
 * One-time order request. Not a cart and not a checkout: the customer
 * says what they'd like and when, and the owner confirms by email.
 */
export function OrderForm({
  products,
  initialQuantities,
  pickup,
}: {
  products: Product[];
  pickup: PickupConfig;
  /** Loaves prefilled from a "Request This Loaf" button. */
  initialQuantities: Record<string, number>;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const { status, errors, message, reference, submit, alertRef, confirmationRef } =
    useRequestForm("/api/order");

  const lines = products
    .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const loafCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const allPriced = lines.every((line) => line.product.price_cents !== null);
  const total = lines.reduce(
    (sum, line) => sum + (line.product.price_cents ?? 0) * line.quantity,
    0,
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void submit(form, {
      name: field(form, "name"),
      email: field(form, "email"),
      phone: field(form, "phone"),
      pickupDate: field(form, "pickupDate"),
      notes: field(form, "notes"),
      items: lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      })),
    });
  }

  if (status === "sent") {
    return (
      <Confirmation heading="Request received." reference={reference} confirmationRef={confirmationRef}>
        <p>
          Thanks — your order request is with us. This isn&apos;t a confirmed order yet:
          we&apos;ll get in touch to confirm availability, the total and your pickup details.
        </p>
        <p className="text-base text-espresso/75">
          Nothing is charged or reserved until we confirm with you.
        </p>
      </Confirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-12">
      <Honeypot />

      <FormSection step={1} title="Your loaves">
        <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="type-small text-espresso/75">
                  {product.price_cents !== null
                    ? `${formatCents(product.price_cents)} per loaf`
                    : priceFallback}
                </p>
              </div>
              <Stepper
                value={quantities[product.id] ?? 0}
                max={maxQuantityPerLoaf}
                itemName={product.name}
                onChange={(value) =>
                  setQuantities((current) => ({ ...current, [product.id]: value }))
                }
              />
            </li>
          ))}
        </ul>

        <p aria-live="polite" className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="font-medium">
            {loafCount === 0
              ? "No loaves added yet"
              : `${loafCount} ${pluralize(loafCount, "loaf", "loaves")} in this request`}
          </span>
          {loafCount > 0 ? (
            <span className="text-espresso/80">
              {allPriced
                ? `Estimated total ${formatCents(total)}`
                : "Total confirmed with you"}
            </span>
          ) : null}
        </p>
        {errors.items ? (
          <p className="type-small font-medium text-terracotta-deep">{errors.items}</p>
        ) : null}
        <p className="type-small text-espresso/75">
          Need more than {maxQuantityPerLoaf} of one loaf?{" "}
          <TextLink href={routes.contact}>Send us a message</TextLink> instead.
        </p>
      </FormSection>

      <FormSection step={2} title="Pickup">
        <PickupDateField
          name="pickupDate"
          label="Preferred pickup date"
          error={errors.pickupDate}
          pickup={pickup}
        />
      </FormSection>

      <FormSection step={3} title="Your details">
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
            autoComplete="tel"
            inputMode="tel"
            error={errors.phone}
          />
        </div>
        <TextAreaField
          label="Notes"
          name="notes"
          maxLength={1500}
          hint="Anything we should know — timing, allergies, questions."
        />
      </FormSection>

      <div className="space-y-5 border-t border-espresso/20 pt-7">
        <FormAlert message={message} alertRef={alertRef} />
        <SubmitButton status={status} sendingLabel="Sending your request…">
          Send Order Request
        </SubmitButton>
        <p className="type-small max-w-[34rem] text-espresso/75">
          This sends a request, not a payment. We&apos;ll get in touch to confirm your
          order and arrange pickup.
        </p>
      </div>
    </form>
  );
}
