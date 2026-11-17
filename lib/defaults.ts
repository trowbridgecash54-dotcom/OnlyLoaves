import type {
  BusinessSettings,
  CopySettings,
  LaunchSettings,
  PickupPrivateSettings,
  PickupSettings,
  Plan,
  PolicyKey,
  PolicySettings,
  Product,
  StorySettings,
} from "./types";

/**
 * STARTING CONTENT
 * ------------------------------------------------------------------
 * What the site says before the owner has changed anything. Once a
 * database is connected, every value here can be edited in the owner
 * dashboard (/admin) and the saved value wins over the one below.
 *
 * Nothing here is invented business information: no prices, no
 * ingredients, no policies, no email address, no permit details.
 */

export const defaultBusiness: BusinessSettings = {
  name: "OnlyLoafs",
  tagline: "Small-batch sourdough, freshly baked and available for local pickup.",
  email: "",
  instagramUrl: "",
  announcement: "",
  disclosures: [],
  // Closed until the owner opens ordering from the dashboard.
  ordersOpen: false,
};

export const defaultCopy: CopySettings = {
  heroLine1: "Good Bread.",
  heroLine2: "Better Days.",
  heroSupporting: "Small-batch sourdough, freshly baked and available for local pickup.",
  heroImage: null,
  featuredHeading: "What's Baking",
  clubHeading: "Some Loaves Are Worth Subscribing To.",
  clubSupporting:
    "{LoavesWord} fresh sourdough loaves every {interval}. One less thing to think about.",
  clubAside: "Your favorite kind of subscription.",
  clubImage: null,
  clubPageHeadline: "Subscribe for the Bread. Stay for the Crust.",
  clubPageSupporting: "{LoavesWord} loaves a {interval}, freshly baked and ready for pickup.",
  clubPageAside: "Fresh content. Fresher bread.",
};

export const defaultStory: StorySettings = {
  intro: "",
  howItStarted: "",
  whyBaking: "",
  process: "",
  whyUs: "",
  bakerName: "",
  image: null,
};

export const defaultPolicies: PolicySettings = {
  payment: "",
  renewal: "",
  pauseAndCancel: "",
  missedPickup: "",
  unusedLoaves: "",
  refunds: "",
};

export const defaultPickup: PickupSettings = {
  // The owner's time zone, so "today" is right. Editable in the dashboard.
  timeZone: "America/Los_Angeles",
  weekdays: [],
  minNoticeDays: null,
  maxAdvanceDays: null,
  area: "",
  instructions: "",
};

export const defaultPickupPrivate: PickupPrivateSettings = { address: "", instructions: "" };

export const defaultLaunch: LaunchSettings = {
  permitConfirmed: false,
  labelsConfirmed: false,
  notes: "",
};

/** The initial Club plan. Mirrors supabase/migrations/…_initial_data.sql. */
export const defaultPlan: Plan = {
  id: "onlyloafs-club",
  slug: "onlyloafs-club",
  name: "OnlyLoafs Club",
  price_cents: 5000,
  currency: "USD",
  billing_interval: "month",
  loaves_per_period: 3,
  pickup_only: true,
  enabled: true,
  accepting_requests: true,
  closed_message:
    "The Club isn't taking new members right now. Send us a message and we'll let you know when a spot opens.",
  max_subscribers: null,
  allow_mixed_loaves: true,
  allow_pause_requests: true,
  selection_mode: "choose",
  tracking_period: "calendar-month",
  unused_loaf_policy: "undecided",
};

const sample = (slug: string, name: string, description: string, alt: string, order: number): Product => ({
  id: slug,
  slug,
  name,
  description,
  price_cents: null,
  image_path: null,
  image_alt: alt,
  ingredients: null,
  allergens: null,
  availability: "available",
  availability_note: "",
  featured: true,
  club_eligible: true,
  sort_order: order,
  archived_at: null,
});

/** The three sample loaves. Mirrors supabase/migrations/…_initial_data.sql. */
export const defaultProducts: Product[] = [
  sample("classic-sourdough", "Classic Sourdough", "Our plain sourdough loaf.", "Illustration of a round sourdough loaf", 10),
  sample("rosemary-garlic", "Rosemary & Garlic", "Sourdough baked with rosemary and garlic.", "Illustration of a sourdough loaf with rosemary", 20),
  sample("cinnamon-sourdough", "Cinnamon Sourdough", "Sourdough baked with cinnamon.", "Illustration of an oval cinnamon sourdough loaf", 30),
];

/** The largest quantity of one loaf the order form accepts. */
export const maxQuantityPerLoaf = 12;

export const availabilityLabels = {
  available: "Available",
  limited: "Limited",
  "sold-out": "Sold out",
  "coming-soon": "Coming soon",
} as const;

export const policyLabels: Record<PolicyKey, string> = {
  payment: "Payment",
  renewal: "Renewal",
  pauseAndCancel: "Pausing and canceling",
  missedPickup: "Missed pickups",
  unusedLoaves: "Unused loaves",
  refunds: "Refunds",
};

export const policyFallback = "We'll confirm this with you before your subscription starts.";
export const storyFallback = "We're still writing this part.";
export const priceFallback = "Price confirmed when ordering";

export const storySectionTitles = {
  howItStarted: "How it started",
  whyBaking: "Why bread",
  process: "How it's made",
  whyUs: "Why OnlyLoafs",
} as const;

/**
 * FAQ. Answers may use {loaves}, {loavesWord}, {price}, {interval} and
 * {planName}; a `policy` shows the owner's policy from the dashboard, or
 * the "we'll confirm" line while it's undecided.
 */
export type FaqItem = {
  group: "orders" | "club";
  question: string;
  answer?: string;
  policy?: PolicyKey;
};

export const faq: FaqItem[] = [
  {
    group: "orders",
    question: "How do I order a single loaf?",
    answer:
      "Pick your bread on the Our Bread page, choose how many loaves you'd like, and send the order request. We'll get back to you to confirm availability, the total and your pickup time. You don't need a subscription to order.",
  },
  {
    group: "orders",
    question: "When do I pick up my bread?",
    answer:
      "You suggest a pickup date when you order. It isn't final until we confirm it with you, and we'll share the pickup details at the same time.",
  },
  { group: "orders", question: "Do you ship or deliver?", answer: "No. OnlyLoafs is local pickup only." },
  {
    group: "orders",
    question: "How do I pay for a one-time order?",
    answer:
      "There's no online checkout. We'll confirm payment details with you when we confirm your order.",
  },
  {
    group: "club",
    question: "How does {planName} work?",
    answer:
      "{planName} is {loaves} loaves each {interval} for {price}, picked up locally. You send an enrollment request, and we get in touch to confirm your membership, bread selections, payment arrangements and pickup schedule. Membership is arranged with us directly — nothing starts, and nothing is charged, until we've confirmed it with you.",
  },
  {
    group: "club",
    question: "Can I choose my {loavesWord} loaves?",
    answer:
      "You can tell us what you'd like on the enrollment form. Selections depend on what's being baked, so we'll confirm them with you.",
  },
  { group: "club", question: "How do subscription payments work?", policy: "payment" },
  { group: "club", question: "Does my membership renew automatically?", policy: "renewal" },
  { group: "club", question: "Can I pause or cancel my subscription?", policy: "pauseAndCancel" },
  { group: "club", question: "What happens if I miss a pickup?", policy: "missedPickup" },
  { group: "club", question: "What happens to unused monthly loaves?", policy: "unusedLoaves" },
  { group: "club", question: "Can I get a refund?", policy: "refunds" },
];
