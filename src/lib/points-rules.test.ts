import { describe, expect, it } from "vitest";
import {
  REFERRAL_REWARD_POINTS,
  PointsRuleError,
  applyDelta,
  balanceFromLedger,
  deriveFundingMode,
  isPointsShippingEligible,
  isPurchaseRewardDue,
  isReferralRewardDue,
  linePointsTotal,
  pointsIdempotencyKey,
  resolvePointsPrice,
} from "./points-rules";

describe("funding mode", () => {
  it("is CASH_ONLY when every component is cash", () => {
    expect(deriveFundingMode(["CASH", "CASH"])).toBe("CASH_ONLY");
  });

  it("is POINTS_ONLY when every component is points", () => {
    expect(deriveFundingMode(["POINTS", "POINTS"])).toBe("POINTS_ONLY");
  });

  it("rejects combining cash and points in one order", () => {
    expect(() => deriveFundingMode(["CASH", "POINTS"])).toThrow(PointsRuleError);
  });

  it("rejects an order with no payable component", () => {
    expect(() => deriveFundingMode([])).toThrow(PointsRuleError);
  });
});

describe("points pricing", () => {
  it("prefers the variant points price over the product default", () => {
    expect(
      resolvePointsPrice({ pointsEnabled: true, defaultPointsPrice: 500, variantPointsPrice: 420 }),
    ).toBe(420);
  });

  it("falls back to the product default points price", () => {
    expect(
      resolvePointsPrice({ pointsEnabled: true, defaultPointsPrice: 500, variantPointsPrice: null }),
    ).toBe(500);
  });

  it("returns null when the product is not points-enabled", () => {
    expect(
      resolvePointsPrice({ pointsEnabled: false, defaultPointsPrice: 500, variantPointsPrice: 420 }),
    ).toBeNull();
  });

  it("rejects non-integer and negative points prices", () => {
    expect(() =>
      resolvePointsPrice({ pointsEnabled: true, defaultPointsPrice: 12.5, variantPointsPrice: null }),
    ).toThrow(PointsRuleError);
    expect(() =>
      resolvePointsPrice({ pointsEnabled: true, defaultPointsPrice: -1, variantPointsPrice: null }),
    ).toThrow(PointsRuleError);
  });

  it("multiplies unit points by quantity with integer math", () => {
    expect(linePointsTotal(150, 3)).toBe(450);
    expect(() => linePointsTotal(150, 0)).toThrow(PointsRuleError);
  });
});

describe("balance safety", () => {
  it("applies positive and negative deltas", () => {
    expect(applyDelta(100, 50)).toBe(150);
    expect(applyDelta(100, -100)).toBe(0);
  });

  it("never allows a negative balance", () => {
    expect(() => applyDelta(10, -11)).toThrow(/insufficient points balance/);
  });

  it("rejects a zero delta", () => {
    expect(() => applyDelta(10, 0)).toThrow(PointsRuleError);
  });

  it("derives the balance from the ledger", () => {
    expect(balanceFromLedger([{ delta: 200 }, { delta: -50 }, { delta: 50 }])).toBe(200);
  });
});

describe("shipping eligibility", () => {
  it("is eligible at or above the threshold", () => {
    expect(isPointsShippingEligible({ balance: 500, freeShippingPointsThreshold: 500 })).toBe(true);
    expect(isPointsShippingEligible({ balance: 499, freeShippingPointsThreshold: 500 })).toBe(false);
  });
});

describe("purchase reward", () => {
  it("is due only on DELIVERED", () => {
    expect(isPurchaseRewardDue({ status: "DELIVERED", purchaseRewardGranted: false })).toBe(true);
    for (const status of ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED", "RETURNED"]) {
      expect(isPurchaseRewardDue({ status, purchaseRewardGranted: false })).toBe(false);
    }
  });

  it("is not due twice", () => {
    expect(isPurchaseRewardDue({ status: "DELIVERED", purchaseRewardGranted: true })).toBe(false);
  });
});

describe("referral reward", () => {
  const base = {
    status: "DELIVERED",
    referralRewardGranted: false,
    referrerId: "referrer",
    refereeId: "referee",
    refereeHasEarlierDeliveredOrder: false,
  };

  it("is 50 points", () => {
    expect(REFERRAL_REWARD_POINTS).toBe(50);
  });

  it("is due on the referee's first delivered order", () => {
    expect(isReferralRewardDue(base)).toBe(true);
  });

  it("is not due for cancelled or undelivered orders", () => {
    expect(isReferralRewardDue({ ...base, status: "CANCELLED" })).toBe(false);
    expect(isReferralRewardDue({ ...base, status: "SHIPPED" })).toBe(false);
  });

  it("is not due on a later delivered order", () => {
    expect(isReferralRewardDue({ ...base, refereeHasEarlierDeliveredOrder: true })).toBe(false);
  });

  it("is not due twice or for self-referral", () => {
    expect(isReferralRewardDue({ ...base, referralRewardGranted: true })).toBe(false);
    expect(isReferralRewardDue({ ...base, referrerId: "same", refereeId: "same" })).toBe(false);
  });

  it("is not due without an attribution", () => {
    expect(isReferralRewardDue({ ...base, referrerId: null })).toBe(false);
  });
});

describe("idempotency keys", () => {
  it("is stable per reward scope", () => {
    expect(pointsIdempotencyKey("EARN_PURCHASE", "order-1")).toBe("EARN_PURCHASE:order-1");
    expect(pointsIdempotencyKey("EARN_REFERRAL", "referee-1")).toBe("EARN_REFERRAL:referee-1");
  });
});
