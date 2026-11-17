/**
 * The shapes of everything the site stores. Record types mirror the
 * database tables in supabase/migrations (same column names), so there
 * is no translation layer to drift out of date.
 */

export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/* ---------- Catalog ---------- */

export type Availability = "available" | "limited" | "sold-out" | "coming-soon";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** One-time price in cents, or null while the owner hasn't set one. */
  price_cents: number | null;
  /** Path inside the "photos" storage bucket, or null for the placeholder. */
  image_path: string | null;
  image_alt: string;
  ingredients: string | null;
  allergens: string | null;
  availability: Availability;
  availability_note: string;
  featured: boolean;
  club_eligible: boolean;
  sort_order: number;
  archived_at: string | null;
};

/* ---------- The Club ---------- */

export type Plan = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_interval: "month";
  loaves_per_period: number;
  pickup_only: boolean;
  enabled: boolean;
  accepting_requests: boolean;
  closed_message: string;
  max_subscribers: number | null;
  allow_mixed_loaves: boolean;
  allow_pause_requests: boolean;
  selection_mode: "choose" | "preferences";
  tracking_period: "calendar-month" | "anniversary";
  unused_loaf_policy: "undecided" | "expire" | "rollover" | "credit";
};

export type NotificationStatus = "pending" | "sent" | "failed" | "not-configured";

export type InquiryStatus = "inquiry" | "pending-approval" | "approved" | "rejected";

export type Inquiry = {
  id: string;
  reference: string;
  status: InquiryStatus;
  plan_id: string;
  name: string;
  email: string;
  phone: string;
  preferred_pickup_day: string;
  preferred_first_pickup_date: string;
  requested_loaves: { name: string; quantity: number | null }[];
  bread_preferences: string;
  additional_requests: string;
  acknowledged_terms_at: string;
  subscription_id: string | null;
  owner_notes: string;
  notification_status: NotificationStatus;
  notification_error: string | null;
  created_at: string;
};

export type SubscriptionStatus = "active" | "paused" | "canceled";

export type Subscription = {
  id: string;
  inquiry_id: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  subscriber_name: string;
  subscriber_email: string;
  subscriber_phone: string;
  price_cents: number;
  currency: string;
  loaves_per_period: number;
  pickup_day: string;
  pickup_notes: string;
  started_on: string;
  paused_on: string | null;
  canceled_on: string | null;
  owner_notes: string;
  created_at: string;
};

export type PaymentStatus = "unpaid" | "paid" | "waived" | "refunded";

export type Period = {
  id: string;
  subscription_id: string;
  starts_on: string;
  ends_on: string;
  allowance: number;
  authorized_extra_loaves: number;
  payment_status: PaymentStatus;
  paid_on: string | null;
  payment_note: string;
};

export type Fulfillment = {
  id: string;
  subscription_id: string;
  period_id: string;
  product_id: string | null;
  product_name: string;
  fulfilled_on: string;
  is_authorized_extra: boolean;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

/* ---------- Orders and messages ---------- */

export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "completed" | "canceled";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price_cents: number | null;
  quantity: number;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_date: string;
  notes: string;
  owner_notes: string;
  notification_status: NotificationStatus;
  notification_error: string | null;
  created_at: string;
  items: OrderItem[];
};

export type ContactMessage = {
  id: string;
  status: "new" | "resolved";
  name: string;
  email: string;
  message: string;
  notification_status: NotificationStatus;
  notification_error: string | null;
  resolved_at: string | null;
  created_at: string;
};

/* ---------- Settings (stored as JSON, one row per group) ---------- */

export type BusinessSettings = {
  name: string;
  tagline: string;
  /** Public contact address. "" hides email links. */
  email: string;
  /** Full Instagram link. "" hides Instagram. */
  instagramUrl: string;
  announcement: string;
  /** Required business or food-label wording, one line each. Shown in the footer. */
  disclosures: string[];
  /** Master switch. While false, the order and Club forms are closed. */
  ordersOpen: boolean;
};

export type CopySettings = {
  heroLine1: string;
  heroLine2: string;
  heroSupporting: string;
  heroImage: string | null;
  featuredHeading: string;
  clubHeading: string;
  clubSupporting: string;
  clubAside: string;
  clubImage: string | null;
  clubPageHeadline: string;
  clubPageSupporting: string;
  clubPageAside: string;
};

/** "" means the owner hasn't written that part yet. */
export type StorySettings = {
  intro: string;
  howItStarted: string;
  whyBaking: string;
  process: string;
  whyUs: string;
  bakerName: string;
  image: string | null;
};

/** "" means not decided. The site never invents a policy. */
export type PolicySettings = {
  payment: string;
  renewal: string;
  pauseAndCancel: string;
  missedPickup: string;
  unusedLoaves: string;
  refunds: string;
};

export type PolicyKey = keyof PolicySettings;

export type PickupSettings = {
  timeZone: string;
  weekdays: Weekday[];
  minNoticeDays: number | null;
  maxAdvanceDays: number | null;
  /** General area only — never a street address. */
  area: string;
  /** Instructions that are safe to publish. */
  instructions: string;
};

/** Never sent to visitors. Shown only in the dashboard. */
export type PickupPrivateSettings = {
  address: string;
  instructions: string;
};

/** Owner's own launch confirmations. Never sent to visitors. */
export type LaunchSettings = {
  permitConfirmed: boolean;
  labelsConfirmed: boolean;
  notes: string;
};

/** What lib/pickup.ts needs to decide which dates are allowed. */
export type PickupConfig = PickupSettings & { unavailableDates: string[] };

/** Everything a public page needs, loaded once per request. */
export type SiteData = {
  /** "defaults" means no database is connected and the site is showing its built-in starting content. */
  source: "database" | "defaults";
  business: BusinessSettings;
  copy: CopySettings;
  story: StorySettings;
  policies: PolicySettings;
  pickup: PickupConfig;
  products: Product[];
  plan: Plan | null;
};
