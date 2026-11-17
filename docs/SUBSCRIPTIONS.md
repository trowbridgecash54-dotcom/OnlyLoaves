# OnlyLoafs Club — how memberships work

## The journey

1. **Customer** reads the Club page and sends an enrollment request. They tick that they understand it's a request, not a subscription, and that nothing is charged automatically. They see "Welcome to the Next Step" and a reference like `CL-7K3F9Q`.
2. **Website** saves it as an **inquiry** and (if email is set up) emails the owner. No subscription exists yet.
3. **Owner** contacts the customer and agrees the terms, payment and pickups. The inquiry can be marked *In conversation* meanwhile.
4. **Owner approves** in the dashboard (only with the confirmation tick). This creates the **membership**, copying the plan's current price and loaf count. It records no payment.
5. **Each month**, the owner records loaves as they're picked up, and records payment status by hand.
6. **Pause or cancel** from the member's page at any time.

Detailed steps for the owner are in [OWNER-GUIDE.md](OWNER-GUIDE.md#onlyloafs-club). This page describes the rules behind them.

## Records

| Record | What it is |
| --- | --- |
| Inquiry (`subscription_inquiries`) | A request to join. Status: new → in conversation → approved or declined. |
| Membership (`subscriptions`) | Created only by approving an inquiry. Status: active, paused, canceled. Keeps the price and loaves agreed at approval. |
| Period (`subscription_periods`) | One allowance period for one member, with its allowance, any authorized extras, and the manually recorded payment status. |
| Loaf record (`fulfillments`) | One loaf handed over. Permanent; can be voided but not deleted or edited. |

## The allowance rules

- The initial plan: **3 loaves of any kind per calendar month**. Both the number and the period type (calendar month, or each member's monthly start date) are editable in **Club → Plan and terms**.
- Each recorded loaf reduces the remaining allowance by one. A voided record gives it back.
- The database refuses a loaf beyond the allowance unless the owner explicitly records it as an **extra purchase**.
- The same "mark fulfilled" form submitted twice (double click, resubmit) is recorded once.
- Allowances are created only for **active** members, and only for periods on or after their start date. Paused, canceled and declined people get none.
- **Unused loaves are never carried forward automatically.** The plan has an *unused loaves* setting (undecided / expire / roll over / credit) that defaults to *undecided*; the customer-facing rule is whatever the owner writes under **Policies → Unused loaves**. Nothing is promised until she does.

## Policies that must be decided before taking members

Payment, renewal, pausing and canceling, missed pickups, unused loaves, refunds. Each is editable in the dashboard and shown on the Club page, the enrollment form and the FAQ. While blank, the site says the term will be confirmed with the customer — it never invents one.

## Payments

Arranged directly between the owner and the member. The website takes no payments, stores no card details, and never shows "payment successful" or "subscription active" to a customer. The owner records *Paid / Waived / Refunded* per period for her own tracking.

The database has unused columns reserved for a future Stripe Billing integration (`stripe_price_id`, `stripe_customer_id`, `stripe_subscription_id`). What that would take is in the README, section 11. It requires a separate decision and published automatic-renewal terms first.
