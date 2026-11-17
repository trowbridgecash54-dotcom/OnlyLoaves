/**
 * Launch checklist — run with:  npm run checklist
 *
 * Reads the live settings from the database (as a visitor would, so
 * only public information is used) and lists what's still needed.
 * The same list, plus the owner's own confirmations, is in the
 * dashboard under Checklist.
 */
import { createClient } from "@supabase/supabase-js";
import { buildChecklist, type ChecklistGroup } from "../lib/checklist";
import { defaultLaunch } from "../lib/defaults";
import { isEmailConfigured } from "../lib/email";
import { buildSite, defaultSite } from "../lib/site-build";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function load() {
  if (!url || !key) return defaultSite();
  const client = createClient(url, key, { auth: { persistSession: false } });
  const read = async (table: string) => {
    const { data, error } = await client.from(table).select("*");
    if (error) throw new Error(`Couldn't read ${table}: ${error.message}`);
    return data ?? [];
  };
  const [settings, products, plans, closures] = await Promise.all([
    read("settings"), read("products"), read("subscription_plans"), read("pickup_closures"),
  ]);
  return buildSite(
    Object.fromEntries(settings.map((row: { key: string; value: unknown }) => [row.key, row.value])),
    products, plans, closures,
  );
}

async function main() {
  const site = await load();
  const items = buildChecklist(site, defaultLaunch, {
    databaseConnected: Boolean(url && key),
    canSaveForms: Boolean(url && key && secret),
    emailConfigured: isEmailConfigured(),
    siteUrlSet: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    ownerAccountExists: null,
  });

  console.log(`\nOnlyLoafs launch checklist${site.source === "defaults" ? " (no database connected — showing starting content)" : ""}`);
  console.log("Permit and label confirmations are ticked by the owner in the dashboard.\n");
  const groups: ChecklistGroup[] = ["Business information", "Bread", "Accounts and services", "Policies and permits"];
  for (const group of groups) {
    console.log(group);
    for (const item of items.filter((candidate) => candidate.group === group)) {
      console.log(`  [${item.done ? "x" : " "}] ${item.label}${item.optional ? " (optional)" : ""}${item.done ? "" : `  → ${item.where}`}`);
    }
    console.log("");
  }
  const todo = items.filter((item) => !item.done && !item.optional).length;
  console.log(`${todo} required items left.\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
