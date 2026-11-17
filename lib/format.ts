import type { Plan } from "./types";

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** 3 → "three". Falls back to digits above twelve. */
export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length
    ? NUMBER_WORDS[n]
    : String(n);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 50 → "$50", 12.5 → "$12.50". */
export function formatPrice(amount: number, currency = "USD"): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** 5000 → "$50". Prices are stored in cents. */
export function formatCents(cents: number, currency = "USD"): string {
  return formatPrice(cents / 100, currency);
}

/** "12", "12.50" or "$12" → 1200 / 1250 / 1200. "" → null. Returns undefined when it isn't a price. */
export function parsePriceToCents(input: string): number | null | undefined {
  const text = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (text === "") return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(text)) return undefined;
  return Math.round(Number(text) * 100);
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Swaps {tokens} in owner-written copy for the plan's current values, so
 * wording never drifts from the configured price and loaf count.
 */
export function fillPlanTokens(text: string, plan: Plan): string {
  const word = numberWord(plan.loaves_per_period);
  const values: Record<string, string> = {
    loaves: String(plan.loaves_per_period),
    loavesWord: word,
    LoavesWord: capitalize(word),
    price: formatCents(plan.price_cents, plan.currency),
    interval: plan.billing_interval,
    planName: plan.name,
  };
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** Collapses whitespace and trims. Used on every free-text form value. */
export function clean(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

/** Single-line version of `clean`, safe for email subjects. */
export function cleanLine(value: unknown, maxLength: number): string {
  return clean(value, maxLength).replace(/\s+/g, " ");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
