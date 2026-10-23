import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../_lib/db.js";
import { users, type User } from "../_lib/schema.js";
import { getStripe } from "../_lib/stripe.js";
import { env } from "../_lib/env.js";
import { json } from "../_lib/http.js";

function customerIdOf(customer: string | { id: string } | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function findUserByCustomer(customerId: string): Promise<User | null> {
  const byCustomer = await getDb().query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });
  if (byCustomer) return byCustomer;

  // Webhook ordering fallback: subscription events can arrive before
  // checkout.session.completed links the customer. The customer's metadata
  // carries the clerk_user_id set when the customer was created.
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (!customer.deleted) {
      // Customer.deleted is typed `void`, so !deleted doesn't narrow the union.
      const clerkUserId = (customer as Stripe.Customer).metadata?.clerk_user_id;
      if (clerkUserId) {
        const user = await getDb().query.users.findFirst({
          where: eq(users.clerkUserId, clerkUserId),
        });
        if (user) {
          await getDb()
            .update(users)
            .set({ stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(users.id, user.id));
          return { ...user, stripeCustomerId: customerId };
        }
      }
    }
  } catch {
    // Fall through — unlinked customer.
  }
  return null;
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  // API versions ≥ 2025-03-31 moved current_period_end onto subscription items.
  const ts =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

// Lower is better: the subscription that decides a customer's access.
const STATUS_RANK: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  incomplete: 4,
  paused: 5,
  incomplete_expired: 6,
  canceled: 7,
};

/** The subscription that should drive access: best status first, then the newest. */
export function pickSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const rank = (sub: Stripe.Subscription) => STATUS_RANK[sub.status] ?? 99;
  return [...subs].sort((a, b) => rank(a) - rank(b) || b.created - a.created)[0] ?? null;
}

/**
 * Write the customer's current subscription state, fetched fresh from Stripe.
 * Stripe can deliver events late, twice, or out of order, so an event is only
 * a signal that something changed; the event's own copy of the object may be
 * stale (a late subscription.updated arriving after subscription.deleted
 * would otherwise reactivate a canceled user). Re-reading the source of truth
 * makes every event idempotent and order-independent.
 */
async function syncCustomerSubscription(customerId: string): Promise<void> {
  const user = await findUserByCustomer(customerId);
  if (!user) return;

  const { data } = await getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const sub = pickSubscription(data);
  const live = sub && sub.status !== "canceled" && sub.status !== "incomplete_expired";

  await getDb()
    .update(users)
    .set({
      stripeSubscriptionId: live ? sub.id : null,
      subscriptionStatus: sub ? sub.status : "none",
      subscriptionPeriodEnd: live ? subscriptionPeriodEnd(sub) : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return json({ detail: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const clerkUserId = session.client_reference_id;
        const customerId = customerIdOf(session.customer);
        if (clerkUserId && customerId) {
          const user = await getDb().query.users.findFirst({
            where: eq(users.clerkUserId, clerkUserId),
          });
          if (user && !user.stripeCustomerId) {
            await getDb()
              .update(users)
              .set({ stripeCustomerId: customerId, updatedAt: new Date() })
              .where(eq(users.id, user.id));
          }
          await syncCustomerSubscription(customerId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const customerId = customerIdOf(event.data.object.customer);
        if (customerId) await syncCustomerSubscription(customerId);
        break;
      }

      case "invoice.payment_failed": {
        const customerId = customerIdOf(event.data.object.customer);
        if (customerId) await syncCustomerSubscription(customerId);
        break;
      }
    }
  } catch (err) {
    // A 5xx makes Stripe retry the event later, which is safe because
    // handling is idempotent.
    console.error(`[stripe webhook] ${event.type} ${event.id} failed:`, err);
    return json({ detail: "Webhook handling failed" }, 500);
  }

  return json({ received: true });
}
