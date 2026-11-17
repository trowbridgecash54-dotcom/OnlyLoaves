"use client";

import type { FormEvent } from "react";
import { Honeypot, TextAreaField, TextField } from "./fields";
import { Confirmation, FormAlert, SubmitButton } from "./parts";
import { field, useRequestForm } from "./useRequestForm";

export function ContactForm() {
  const { status, errors, message, submit, alertRef, confirmationRef } =
    useRequestForm("/api/contact");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void submit(form, {
      name: field(form, "name"),
      email: field(form, "email"),
      message: field(form, "message"),
    });
  }

  if (status === "sent") {
    return (
      <Confirmation heading="Message sent." confirmationRef={confirmationRef}>
        <p>Thanks for getting in touch. We&apos;ll reply by email.</p>
      </Confirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-6">
      <Honeypot />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="name"
          required
          autoComplete="name"
          error={errors.name}
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          error={errors.email}
        />
      </div>
      <TextAreaField
        label="Message"
        name="message"
        required
        rows={6}
        maxLength={3000}
        error={errors.message}
      />
      <FormAlert message={message} alertRef={alertRef} />
      <SubmitButton status={status} sendingLabel="Sending your message…">
        Send Message
      </SubmitButton>
    </form>
  );
}
