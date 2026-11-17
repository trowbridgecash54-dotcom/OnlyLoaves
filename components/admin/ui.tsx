import Link from "next/link";
import { useId, type ReactNode } from "react";
import { SubmitButton } from "./client";

/**
 * Building blocks for the owner dashboard. Plain, roomy and predictable:
 * every form is an ordinary web form that posts to /admin/do/<action>
 * and comes back with a message at the top of the page.
 */

const control =
  "block w-full rounded-[2px] border border-espresso/30 bg-paper px-3.5 py-2.5 text-base text-espresso focus:border-espresso";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) {
    return (
      <p role="alert" className="mb-8 border-l-2 border-terracotta-deep bg-paper px-5 py-4 font-medium text-terracotta-deep">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="mb-8 border-l-2 border-olive-deep bg-paper px-5 py-4 font-medium">
        {ok}
      </p>
    );
  }
  return null;
}

export type Search = Promise<Record<string, string | string[] | undefined>>;

/** Reads one value from the page's query string. */
export async function param(search: Search, name: string): Promise<string | undefined> {
  const value = (await search)[name];
  return Array.isArray(value) ? value[0] : value;
}

export function AdminPage({
  title,
  intro,
  ok,
  error,
  aside,
  children,
}: {
  title: string;
  intro?: ReactNode;
  ok?: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="type-headline">{title}</h1>
          {intro ? <p className="mt-3 max-w-[40rem] text-espresso/80">{intro}</p> : null}
        </div>
        {aside}
      </div>
      <Flash ok={ok} error={error} />
      {children}
    </>
  );
}

export function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-espresso/20 py-8">
      <h2 className="type-title">{title}</h2>
      {description ? <p className="mt-2 max-w-[40rem] text-espresso/75">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-espresso/30 px-6 py-10 text-center">
      <p className="font-serif text-2xl">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-[30rem] text-espresso/75">{children}</p> : null}
    </div>
  );
}

const tones = {
  neutral: "border-espresso/30 text-espresso",
  attention: "border-terracotta-deep bg-terracotta-deep text-cream",
  good: "border-olive-deep bg-olive-deep text-cream",
  muted: "border-espresso/20 text-espresso/60",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** A dashboard form. `back` is where the owner lands if something needs fixing. */
export function PostForm({
  action,
  back,
  upload = false,
  className = "",
  children,
}: {
  action: string;
  back: string;
  upload?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      method="post"
      action={`/admin/do/${action}`}
      encType={upload ? "multipart/form-data" : undefined}
      className={className}
    >
      <input type="hidden" name="_back" value={back} />
      {children}
    </form>
  );
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

function Labelled({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="type-small mt-1.5 text-espresso/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type FieldProps = { label: string; name: string; hint?: ReactNode; required?: boolean };

export function Field({
  label,
  name,
  hint,
  required,
  defaultValue = "",
  type = "text",
  inputMode,
  autoComplete = "off",
}: FieldProps & {
  defaultValue?: string | number;
  type?: "text" | "email" | "password" | "date" | "number" | "url";
  inputMode?: "decimal" | "numeric" | "email" | "url";
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={control}
      />
    </Labelled>
  );
}

export function Area({
  label,
  name,
  hint,
  required,
  defaultValue = "",
  rows = 3,
}: FieldProps & { defaultValue?: string; rows?: number }) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${control} resize-y`}
      />
    </Labelled>
  );
}

export function Choice({
  label,
  name,
  hint,
  defaultValue,
  options,
}: FieldProps & { defaultValue: string; options: [value: string, label: string][] }) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${control} min-h-[2.875rem]`}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

export function Tick({
  label,
  name,
  hint,
  defaultChecked = false,
  value,
  required,
}: FieldProps & { defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-1.5">
      <input
        type="checkbox"
        name={name}
        value={value}
        required={required}
        defaultChecked={defaultChecked}
        className="mt-1 size-5 shrink-0 accent-espresso"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="type-small block text-espresso/70">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Save({ children = "Save", quiet = false }: { children?: ReactNode; quiet?: boolean }) {
  return <SubmitButton quiet={quiet}>{children}</SubmitButton>;
}

export const adminLink =
  "underline decoration-terracotta decoration-[1.5px] underline-offset-[5px] hover:text-terracotta-deep";

/** One-tap ways to reach a customer. */
export function ContactLinks({
  email,
  phone,
  subject,
}: {
  email: string;
  phone?: string;
  subject: string;
}) {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-1">
      <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}`} className={`${adminLink} break-all`}>
        Email {email}
      </a>
      {digits ? (
        <>
          <a href={`tel:${digits}`} className={adminLink}>
            Call {phone}
          </a>
          <a href={`sms:${digits}`} className={adminLink}>
            Text
          </a>
        </>
      ) : null}
    </p>
  );
}

export function ButtonAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-[2px] bg-espresso px-5 py-2.5 text-[0.9375rem] font-medium text-cream transition-colors duration-200 hover:bg-terracotta-deep"
    >
      {children}
    </Link>
  );
}

/** "Nov 16, 2026, 7:04 PM" in the business's time zone. */
export function formatWhen(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
