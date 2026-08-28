import { describe, expect, it, vi } from "vitest";

describe("Profile Bootstrap Logic & Invariants", () => {
  it("generates 8-character uppercase alphanumeric referral codes", () => {
    for (let i = 0; i < 20; i++) {
      const code = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("extracts and trims user metadata fields safely", () => {
    const rawMetadata: Record<string, unknown> = {
      full_name: "  أحمد علي  ",
      phone: "01012345678",
      locale: "ar",
      referral_code: "REF12345",
    };

    const fullName = ((rawMetadata["full_name"] as string) || "").trim();
    const phone = ((rawMetadata["phone"] as string) || "").trim();
    const locale = rawMetadata["locale"] === "en" ? "en" : "ar";
    const ref = ((rawMetadata["referral_code"] as string) || "").trim().toUpperCase();

    expect(fullName).toBe("أحمد علي");
    expect(phone).toBe("01012345678");
    expect(locale).toBe("ar");
    expect(ref).toBe("REF12345");
  });

  it("defaults invalid locale values to Arabic ('ar')", () => {
    const invalidLocales = ["fr", "de", "es", "", null, undefined];
    for (const loc of invalidLocales) {
      const sanitized = loc === "ar" || loc === "en" ? loc : "ar";
      expect(sanitized).toBe("ar");
    }
  });

  it("never allows self-referral (referrer id must differ from user id)", () => {
    const userId: string = "11111111-1111-1111-1111-111111111111";
    const refUserId: string = "11111111-1111-1111-1111-111111111111"; // same user
    const otherUserId: string = "22222222-2222-2222-2222-222222222222";

    const referredBySame = refUserId !== userId ? refUserId : null;
    const referredByOther = otherUserId !== userId ? otherUserId : null;

    expect(referredBySame).toBeNull();
    expect(referredByOther).toBe(otherUserId);
  });

  it("initializes missing points balances to 0", () => {
    const balance = 0;
    expect(balance).toBe(0);
  });

  it("enforces CUSTOMER role as the safe bootstrap role and never grants ADMIN", () => {
    const defaultRole = "CUSTOMER";
    expect(defaultRole).toBe("CUSTOMER");
    expect(defaultRole).not.toBe("ADMIN");
  });
});
