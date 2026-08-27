import { describe, expect, it } from "vitest";
import { z } from "zod";

const adminOrderItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  productPaymentMethod: z.enum(["CASH", "POINTS"]),
});

const adminPlaceOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z
    .string()
    .trim()
    .regex(/^01\d{9}$/, "Egyptian mobile numbers must be 11 digits starting with 01"),
  customerSecondaryPhone: z.string().trim().max(20).optional().default(""),
  customerWhatsApp: z.string().trim().max(20).optional().default(""),
  shippingAddress: z.object({
    governorate: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    street: z.string().trim().min(3).max(200),
    notes: z.string().trim().max(300).optional().default(""),
  }),
  customerNotes: z.string().trim().max(500).optional().default(""),
  items: z.array(adminOrderItemSchema).min(1),
  shippingPaymentMethod: z.enum(["CASH", "POINTS"]),
  fingerprint: z.string().trim().min(1).max(2000),
});

describe("Admin Order Entry schema & validation rules", () => {
  it("accepts a valid admin order entry payload", () => {
    const payload = {
      idempotencyKey: "admin_test_12345678",
      customerName: "Ahmed Admin Client",
      customerPhone: "01012345678",
      customerSecondaryPhone: "01187654321",
      customerWhatsApp: "01012345678",
      shippingAddress: {
        governorate: "Cairo",
        city: "Maadi",
        street: "Road 9, Bldg 12",
        notes: "Ring bell twice",
      },
      customerNotes: "Deliver after 3 PM",
      items: [
        {
          variantId: "11111111-1111-1111-1111-111111111111",
          quantity: 2,
          productPaymentMethod: "CASH" as const,
        },
        {
          variantId: "22222222-2222-2222-2222-222222222222",
          quantity: 1,
          productPaymentMethod: "POINTS" as const,
        },
      ],
      shippingPaymentMethod: "CASH" as const,
      fingerprint: "admin-workstation-chrome",
    };

    const parsed = adminPlaceOrderSchema.parse(payload);
    expect(parsed.customerName).toBe("Ahmed Admin Client");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]?.productPaymentMethod).toBe("POINTS");
  });

  it("rejects invalid Egyptian customer phone numbers", () => {
    const invalidPayload = {
      idempotencyKey: "admin_test_12345678",
      customerName: "Ahmed Admin Client",
      customerPhone: "02012345678", // not 01
      shippingAddress: {
        governorate: "Cairo",
        city: "Maadi",
        street: "Road 9, Bldg 12",
      },
      items: [
        {
          variantId: "11111111-1111-1111-1111-111111111111",
          quantity: 1,
          productPaymentMethod: "CASH" as const,
        },
      ],
      shippingPaymentMethod: "CASH" as const,
      fingerprint: "admin-workstation-chrome",
    };

    expect(() => adminPlaceOrderSchema.parse(invalidPayload)).toThrow();
  });

  it("rejects orders without any items", () => {
    const emptyItemsPayload = {
      idempotencyKey: "admin_test_12345678",
      customerName: "Ahmed Admin Client",
      customerPhone: "01012345678",
      shippingAddress: {
        governorate: "Cairo",
        city: "Maadi",
        street: "Road 9, Bldg 12",
      },
      items: [],
      shippingPaymentMethod: "CASH" as const,
      fingerprint: "admin-workstation-chrome",
    };

    expect(() => adminPlaceOrderSchema.parse(emptyItemsPayload)).toThrow();
  });

  it("rejects zero or negative quantities", () => {
    const zeroQtyPayload = {
      idempotencyKey: "admin_test_12345678",
      customerName: "Ahmed Admin Client",
      customerPhone: "01012345678",
      shippingAddress: {
        governorate: "Cairo",
        city: "Maadi",
        street: "Road 9, Bldg 12",
      },
      items: [
        {
          variantId: "11111111-1111-1111-1111-111111111111",
          quantity: 0,
          productPaymentMethod: "CASH" as const,
        },
      ],
      shippingPaymentMethod: "CASH" as const,
      fingerprint: "admin-workstation-chrome",
    };

    expect(() => adminPlaceOrderSchema.parse(zeroQtyPayload)).toThrow();
  });
});
