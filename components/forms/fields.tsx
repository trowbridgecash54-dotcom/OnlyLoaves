"use client";

import { useId, type ReactNode } from "react";
import { HONEYPOT_FIELD } from "@/lib/spam";

export const inputClass =
  "block w-full rounded-[2px] border bg-paper px-4 py-3 text-base text-espresso placeholder:text-espresso/45 transition-colors duration-200 focus:border-espresso";

function borderFor(error?: string) {
  return error ? "border-terracotta-deep" : "border-espresso/30";
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block font-medium">
      {children}
      {optional ? <span className="type-small font-normal text-espresso/70"> (optional)</span> : null}
    </label>
  );
}

function Notes({
  hint,
  error,
  hintId,
  errorId,
}: {
  hint?: string;
  error?: string;
  hintId: string;
  errorId: string;
}) {
  return (
    <>
      {hint ? (
        <p id={hintId} className="type-small mt-2 text-espresso/75">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="type-small mt-2 font-medium text-terracotta-deep">
          {error}
        </p>
      ) : null}
    </>
  );
}

function describedBy(hint: string | undefined, error: string | undefined, hintId: string, errorId: string) {
  return [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
}

type CommonProps = {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function TextField({
  label,
  name,
  hint,
  error,
  required = false,
  type = "text",
  autoComplete,
  inputMode,
  min,
  max,
  defaultValue,
}: CommonProps & {
  type?: "text" | "email" | "tel" | "date";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
  min?: string;
  max?: string;
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} optional={!required}>
        {label}
      </Label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        min={min}
        max={max}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, `${id}-hint`, `${id}-error`)}
        className={`${inputClass} ${borderFor(error)}`}
      />
      <Notes hint={hint} error={error} hintId={`${id}-hint`} errorId={`${id}-error`} />
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  error,
  required = false,
  rows = 4,
  maxLength,
}: CommonProps & { rows?: number; maxLength?: number }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} optional={!required}>
        {label}
      </Label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, `${id}-hint`, `${id}-error`)}
        className={`${inputClass} ${borderFor(error)} resize-y`}
      />
      <Notes hint={hint} error={error} hintId={`${id}-hint`} errorId={`${id}-error`} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  required = false,
  options,
  placeholder,
  defaultValue = "",
}: CommonProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} optional={!required}>
        {label}
      </Label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, `${id}-hint`, `${id}-error`)}
        className={`${inputClass} ${borderFor(error)} min-h-[3.125rem]`}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Notes hint={hint} error={error} hintId={`${id}-hint`} errorId={`${id}-error`} />
    </div>
  );
}

/**
 * Spam trap. People never see or reach this field; bots that fill in
 * every input reveal themselves. See lib/spam.ts.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Company
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/** A numbered part of a form: "1  Your loaves". */
export function FormSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-espresso/20 pt-7">
      <legend className="float-left mb-6 flex w-full items-baseline gap-4">
        <span aria-hidden="true" className="font-serif text-3xl leading-none text-terracotta-deep">
          {step}
        </span>
        <span className="type-title">{title}</span>
      </legend>
      <div className="clear-both space-y-6">{children}</div>
    </fieldset>
  );
}
