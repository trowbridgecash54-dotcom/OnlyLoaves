import type { Db, Files, Row } from "./db";
import type {
  ContactMessage,
  Fulfillment,
  Inquiry,
  NotificationStatus,
  Order,
  OrderItem,
  Period,
  Plan,
  Product,
  Subscription,
} from "./types";

/**
 * Every read and write the site makes, in one place.
 *
 * A Store is created around a database connection that already carries
 * an identity — a visitor, the website's server, or a signed-in owner —
 * and the database's row-level security decides what that identity may
 * see and change. Nothing here grants access by itself.
 */

export type Saved = { id: string; reference: string; duplicate: boolean };

export type OrderInput = {
  idempotency_key: string;
  name: string;
  email: string;
  phone: string;
  pickup_date: string;
  notes: string;
  items: { product_id: string; quantity: number }[];
};

export type InquiryInput = {
  idempotency_key: string;
  plan_id: string;
  name: string;
  email: string;
  phone: string;
  pickup_day: string;
  first_pickup_date: string;
  requested_loaves: { name: string; quantity: number | null }[];
  bread_preferences: string;
  requests: string;
};

export type ContactInput = {
  idempotency_key: string;
  name: string;
  email: string;
  message: string;
};

export type ProductInput = Omit<Product, "id" | "archived_at">;

export class Store {
  constructor(
    private db: Db,
    private files: Files | null = null,
  ) {}

  /* ---------- What visitors can read ---------- */

  async settings(): Promise<Record<string, unknown>> {
    const rows = await this.db.select<{ key: string; value: unknown }>("settings");
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /** Visitors get loaves that aren't archived; a signed-in owner gets all of them. */
  products(): Promise<Product[]> {
    return this.db.select<Product>("products", {
      order: [
        ["sort_order", "asc"],
        ["name", "asc"],
      ],
    });
  }

  plans(): Promise<Plan[]> {
    return this.db.select<Plan>("subscription_plans", { order: [["created_at", "asc"]] });
  }

  async closures(): Promise<{ closed_on: string; note: string }[]> {
    return this.db.select("pickup_closures", { order: [["closed_on", "asc"]] });
  }

  /* ---------- Saving the three public forms (server identity) ---------- */

  submitOrder(input: OrderInput): Promise<Saved> {
    return this.db.rpc<Saved>("submit_order", { p: input });
  }

  submitInquiry(input: InquiryInput): Promise<Saved> {
    return this.db.rpc<Saved>("submit_inquiry", { p: input });
  }

  async submitContact(input: ContactInput): Promise<Saved> {
    const saved = await this.db.rpc<{ id: string; duplicate: boolean }>("submit_contact", {
      p: input,
    });
    return { ...saved, reference: "" };
  }

  async setNotification(
    kind: "order" | "inquiry" | "contact",
    id: string,
    status: NotificationStatus,
    error: string | null = null,
  ): Promise<void> {
    await this.db.rpc("set_notification", {
      p_kind: kind,
      p_id: id,
      p_status: status,
      p_error: error,
    });
  }

  /** True when this visitor is within the limit. Counts the attempt. */
  rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
    return this.db.rpc<boolean>("check_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
  }

  /* ---------- Owner only (row-level security enforces it) ---------- */

  isAdmin(): Promise<boolean> {
    return this.db.rpc<boolean>("is_admin");
  }

  async saveSetting(key: string, value: Row, isPublic: boolean): Promise<void> {
    await this.db.upsert(
      "settings",
      { key, value, is_public: isPublic, updated_at: new Date().toISOString() },
      "key",
    );
  }

  async saveProduct(id: string | null, input: Partial<ProductInput>): Promise<Product> {
    if (id === null) return this.db.insert<Product>("products", input);
    const [row] = await this.db.update<Product>("products", { id }, input);
    if (!row) throw new Error("product_not_found");
    return row;
  }

  async archiveProduct(id: string, archived: boolean): Promise<void> {
    await this.db.update("products", { id }, {
      archived_at: archived ? new Date().toISOString() : null,
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.db.remove("products", { id });
  }

  async uploadPhoto(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    if (!this.files) throw new Error("photo_storage_unavailable");
    await this.files.upload(path, bytes, contentType);
  }

  /** Best effort: a leftover file is harmless, a failed save is not. */
  async removePhoto(path: string | null): Promise<void> {
    if (!path || !this.files) return;
    try {
      await this.files.remove(path);
    } catch {
      console.error("[onlyloafs] Could not remove an old photo.");
    }
  }

  async orders(): Promise<Order[]> {
    const [orders, items] = await Promise.all([
      this.db.select<Omit<Order, "items">>("orders", {
        order: [["created_at", "desc"]],
        limit: 500,
      }),
      this.db.select<OrderItem>("order_items"),
    ]);
    return orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id),
    }));
  }

  async updateOrder(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("orders", { id }, patch);
    if (rows.length === 0) throw new Error("order_not_found");
  }

  inquiries(): Promise<Inquiry[]> {
    return this.db.select<Inquiry>("subscription_inquiries", {
      order: [["created_at", "desc"]],
      limit: 500,
    });
  }

  async updateInquiry(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("subscription_inquiries", { id }, patch);
    if (rows.length === 0) throw new Error("inquiry_not_found");
  }

  /** Creates the subscription. Records no payment and grants no allowance yet. */
  approveInquiry(id: string, startedOn: string, pickupDay: string): Promise<string> {
    return this.db.rpc<string>("approve_inquiry", {
      p_inquiry_id: id,
      p_started_on: startedOn,
      p_pickup_day: pickupDay,
    });
  }

  subscriptions(): Promise<Subscription[]> {
    return this.db.select<Subscription>("subscriptions", { order: [["created_at", "desc"]] });
  }

  async subscription(id: string): Promise<Subscription | null> {
    const [row] = await this.db.select<Subscription>("subscriptions", { filter: { id } });
    return row ?? null;
  }

  async updateSubscription(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("subscriptions", { id }, patch);
    if (rows.length === 0) throw new Error("subscription_not_found");
  }

  /** Periods for one subscription, or every period still running on `from`. */
  periods(query: { subscriptionId: string } | { endingOnOrAfter: string }): Promise<Period[]> {
    return this.db.select<Period>("subscription_periods", {
      filter:
        "subscriptionId" in query
          ? { subscription_id: query.subscriptionId }
          : { ends_on: { gte: query.endingOnOrAfter } },
      order: [["starts_on", "desc"]],
    });
  }

  ensurePeriod(subscriptionId: string, startsOn: string, endsOn: string): Promise<Period> {
    return this.db.rpc<Period>("ensure_period", {
      p_subscription_id: subscriptionId,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
    });
  }

  async updatePeriod(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("subscription_periods", { id }, patch);
    if (rows.length === 0) throw new Error("period_not_found");
  }

  fulfillments(query: { subscriptionId: string } | { periodIds: string[] }): Promise<Fulfillment[]> {
    return this.db.select<Fulfillment>("fulfillments", {
      filter:
        "subscriptionId" in query
          ? { subscription_id: query.subscriptionId }
          : { period_id: { in: query.periodIds } },
      order: [["created_at", "desc"]],
    });
  }

  fulfillLoaf(input: {
    periodId: string;
    productId: string | null;
    fulfilledOn: string;
    idempotencyKey: string;
    asExtra: boolean;
  }): Promise<{ id: string; duplicate: boolean; is_extra: boolean }> {
    return this.db.rpc("fulfill_loaf", {
      p_period_id: input.periodId,
      p_product_id: input.productId,
      p_fulfilled_on: input.fulfilledOn,
      p_idempotency_key: input.idempotencyKey,
      p_as_extra: input.asExtra,
    });
  }

  /** Keeps the record, marks it void, and gives the loaf back. */
  async voidFulfillment(id: string, reason: string): Promise<void> {
    const rows = await this.db.update("fulfillments", { id }, {
      voided_at: new Date().toISOString(),
      void_reason: reason,
    });
    if (rows.length === 0) throw new Error("fulfillment_not_found");
  }

  async savePlan(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("subscription_plans", { id }, patch);
    if (rows.length === 0) throw new Error("plan_not_found");
  }

  async addClosure(date: string, note: string): Promise<void> {
    await this.db.upsert("pickup_closures", { closed_on: date, note }, "closed_on");
  }

  async removeClosure(date: string): Promise<void> {
    await this.db.remove("pickup_closures", { closed_on: date });
  }

  messages(): Promise<ContactMessage[]> {
    return this.db.select<ContactMessage>("contact_messages", {
      order: [["created_at", "desc"]],
      limit: 500,
    });
  }

  async updateMessage(id: string, patch: Row): Promise<void> {
    const rows = await this.db.update("contact_messages", { id }, patch);
    if (rows.length === 0) throw new Error("message_not_found");
  }
}
