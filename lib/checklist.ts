import { policyLabels } from "./defaults";
import type { LaunchSettings, PolicyKey, SiteData } from "./types";

/**
 * The launch checklist: what still needs doing before OnlyLoafs opens
 * for orders. Used by the dashboard (/admin/checklist) and by
 * `npm run checklist`. It only reports — it never changes anything.
 */

export type ChecklistGroup =
  | "Business information"
  | "Bread"
  | "Accounts and services"
  | "Policies and permits";

export type ChecklistItem = {
  group: ChecklistGroup;
  label: string;
  done: boolean;
  /** Where the owner fixes it. */
  where: string;
  /** Optional items don't block launch. */
  optional?: boolean;
};

export type ChecklistEnvironment = {
  databaseConnected: boolean;
  canSaveForms: boolean;
  emailConfigured: boolean;
  siteUrlSet: boolean;
  ownerAccountExists: boolean | null;
};

export function buildChecklist(
  site: SiteData,
  launch: LaunchSettings,
  environment: ChecklistEnvironment,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const add = (group: ChecklistGroup, label: string, done: boolean, where: string, optional = false) =>
    items.push({ group, label, done, where, optional });

  /* Requires real business information */
  const { business, story, pickup } = site;
  add("Business information", "Our Story: introduction", story.intro !== "", "Settings → Our Story");
  add("Business information", "Our Story: how it started", story.howItStarted !== "", "Settings → Our Story");
  add("Business information", "Our Story: why bread", story.whyBaking !== "", "Settings → Our Story");
  add("Business information", "Our Story: how it's made", story.process !== "", "Settings → Our Story");
  add("Business information", "Our Story: why OnlyLoafs", story.whyUs !== "", "Settings → Our Story");
  add("Business information", "Photo of the baker", story.image !== null, "Settings → Our Story", true);
  add("Business information", "Homepage photo", site.copy.heroImage !== null, "Settings → Wording and photos");
  add("Business information", "Club photo", site.copy.clubImage !== null, "Settings → Wording and photos");
  add("Business information", "Pickup days", pickup.weekdays.length > 0, "Pickup");
  add("Business information", "General pickup area (never a street address)", pickup.area !== "", "Pickup");
  add("Business information", "Public contact email", business.email !== "", "Settings → Business details", true);
  add("Business information", "Instagram link", business.instagramUrl !== "", "Settings → Business details", true);

  /* Bread */
  if (site.products.length === 0) add("Bread", "At least one loaf on the menu", false, "Bread");
  for (const product of site.products) {
    add("Bread", `${product.name}: price`, product.price_cents !== null, "Bread");
    add("Bread", `${product.name}: ingredients`, Boolean(product.ingredients), "Bread");
    add("Bread", `${product.name}: allergens`, Boolean(product.allergens), "Bread");
    add("Bread", `${product.name}: real photo`, product.image_path !== null, "Bread");
  }

  /* Requires an external service or account */
  add("Accounts and services", "Database connected (Supabase)", environment.databaseConnected, "Developer setup: README");
  add("Accounts and services", "Server can save form submissions (Supabase secret key)", environment.canSaveForms, "Developer setup: README");
  if (environment.ownerAccountExists !== null) {
    add("Accounts and services", "Owner account created", environment.ownerAccountExists, "Developer setup: README");
  }
  add("Accounts and services", "Email notifications (Resend)", environment.emailConfigured, "Developer setup: README", true);
  add("Accounts and services", "Website address / domain set", environment.siteUrlSet, "Developer setup: README");

  /* Requires legal or business policy confirmation */
  for (const key of Object.keys(policyLabels) as PolicyKey[]) {
    add("Policies and permits", `Club policy: ${policyLabels[key].toLowerCase()}`, site.policies[key] !== "", "Club → Plan and terms");
  }
  add("Policies and permits", "Cottage-food permit approved and confirmed", launch.permitConfirmed, "Checklist");
  add("Policies and permits", "Food-label information confirmed", launch.labelsConfirmed, "Checklist");
  add("Policies and permits", "Required disclosures added to the site footer", business.disclosures.length > 0, "Settings → Business details");
  add("Policies and permits", "Ordering opened to the public", business.ordersOpen, "Settings → Business details");

  return items;
}

export function remaining(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => !item.done && !item.optional);
}
