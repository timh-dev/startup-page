// @vitest-environment node
import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { pickSubscription } from "./stripe";

function sub(id: string, status: Stripe.Subscription.Status, created: number) {
  return { id, status, created } as Stripe.Subscription;
}

describe("pickSubscription", () => {
  it("returns null when the customer has no subscriptions", () => {
    expect(pickSubscription([])).toBeNull();
  });

  it("prefers a live subscription over a newer canceled one", () => {
    const picked = pickSubscription([sub("old-active", "active", 100), sub("new-canceled", "canceled", 200)]);
    expect(picked?.id).toBe("old-active");
  });

  it("ranks past_due above canceled so a lapsed payment still shows as past due", () => {
    const picked = pickSubscription([sub("canceled", "canceled", 300), sub("late", "past_due", 100)]);
    expect(picked?.id).toBe("late");
  });

  it("breaks ties on status by picking the newest", () => {
    const picked = pickSubscription([sub("a", "canceled", 100), sub("b", "canceled", 200)]);
    expect(picked?.id).toBe("b");
  });
});
