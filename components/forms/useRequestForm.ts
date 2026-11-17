"use client";

import { useEffect, useRef, useState } from "react";
import { HONEYPOT_FIELD, STARTED_AT_FIELD } from "@/lib/spam";

export type FormStatus = "idle" | "sending" | "sent" | "error";

type Reply = {
  ok?: boolean;
  reference?: string;
  message?: string;
  errors?: Record<string, string>;
};

/**
 * Shared sending logic for the order, Club and contact forms.
 * `status` only becomes "sent" after the server confirms the request
 * was saved (or, with no database connected, delivered by email) — the
 * forms never show success on their own.
 */
export function useRequestForm(endpoint: string) {
  const startedAt = useRef(0);
  // One id per filled-in form: sending it twice saves one request, not two.
  const requestId = useRef("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    requestId.current = crypto.randomUUID();
  }, []);

  // Move focus to the outcome so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (status === "error") alertRef.current?.focus();
    if (status === "sent") {
      confirmationRef.current?.focus();
      confirmationRef.current?.scrollIntoView({ block: "center" });
    }
  }, [status]);

  async function submit(form: HTMLFormElement, payload: Record<string, unknown>) {
    if (status === "sending") return;
    setStatus("sending");
    setErrors({});
    setMessage("");

    const honeypot = new FormData(form).get(HONEYPOT_FIELD);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestId: requestId.current,
          [HONEYPOT_FIELD]: typeof honeypot === "string" ? honeypot : "",
          [STARTED_AT_FIELD]: startedAt.current,
        }),
      });
      const reply = (await response.json().catch(() => null)) as Reply | null;

      if (response.ok && reply?.ok) {
        setReference(reply.reference ?? "");
        setStatus("sent");
        return;
      }
      setErrors(reply?.errors ?? {});
      setMessage(
        reply?.message ??
          "Your request wasn't sent — something went wrong on our side. Try again in a minute.",
      );
      setStatus("error");
    } catch {
      setMessage(
        "Your request wasn't sent — we couldn't reach the server. Check your connection and try again.",
      );
      setStatus("error");
    }
  }

  return { status, errors, message, reference, submit, alertRef, confirmationRef };
}

/** Reads a text field from a submitted form. */
export function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}
