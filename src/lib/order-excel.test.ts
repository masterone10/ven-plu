import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  ORDER_EXCEL_HEADERS,
  ORDER_ITEMS_SHEET_HEADERS,
  buildOrderExcelWorkbook,
  calculateOrderTotalPieces,
  cleanPhoneNumber,
  extractSecondPhone,
  formatAddressForExcel,
  formatDateForExcel,
  formatItemsBreakdown,
  isValidStatusTransition,
  parseAndValidateOrderExcel,
  parseItemsBreakdownString,
  type ExistingOrderSnapshot,
  type OrderForExcel,
} from "@/lib/order-excel";

describe("Order Excel Export & Import Domain Rules", () => {
  const sampleOrders: OrderForExcel[] = [
    {
      id: "ord-1111-2222-3333",
      orderNumber: "VP-1071",
      createdAt: "2026-08-29T12:00:00Z",
      status: "CONFIRMED",
      fundingMode: "CASH_ONLY",
      customerName: "maro six",
      customerPhone: "01200551014",
      secondPhone: "01200551015",
      shippingAddress: {
        address: "موقف السلام - موقف السلام",
        city: "Cairo",
        secondaryPhone: "01200551015",
      },
      cashTotal: 410,
      pointsTotal: 0,
      shippingCashPrice: 80,
      shippingPointsPrice: 0,
      items: [
        {
          id: "item-1",
          productId: "prod-pant",
          variantId: "var-blk-m",
          productNameAr: "بنطلون",
          variantNameAr: "أسود / M",
          sku: "PANT-BLK-M",
          productSku: "PANT",
          quantity: 2,
          unitCashPrice: 100,
          unitPointsPrice: 0,
          productPaymentMethod: "CASH",
        },
        {
          id: "item-2",
          productId: "prod-pant",
          variantId: "var-blk-l",
          productNameAr: "بنطلون",
          variantNameAr: "أسود / L",
          sku: "PANT-BLK-L",
          productSku: "PANT",
          quantity: 3,
          unitCashPrice: 100,
          unitPointsPrice: 0,
          productPaymentMethod: "CASH",
        },
        {
          id: "item-3",
          productId: "prod-pant",
          variantId: "var-wht-m",
          productNameAr: "بنطلون",
          variantNameAr: "أبيض / M",
          sku: "PANT-WHT-M",
          productSku: "PANT",
          quantity: 1,
          unitCashPrice: 100,
          unitPointsPrice: 0,
          productPaymentMethod: "CASH",
        },
      ],
    },
    {
      id: "ord-4444-5555-6666",
      orderNumber: "VP-1072",
      createdAt: "2026-08-29T14:30:00Z",
      status: "PENDING_CONFIRMATION",
      fundingMode: "CASH_ONLY",
      customerName: "Sara Ahmed",
      customerPhone: "01099887766",
      secondPhone: null,
      shippingAddress: "مدينة نصر - الحي السابع",
      cashTotal: 250,
      pointsTotal: 0,
      shippingCashPrice: 50,
      shippingPointsPrice: 0,
      items: [
        {
          id: "item-4",
          productId: "prod-mug",
          variantId: "var-mug-350",
          productNameAr: "مج سيراميك",
          variantNameAr: "350 مل",
          sku: "MUG-350ML",
          productSku: "MUG",
          quantity: 1,
          unitCashPrice: 200,
          unitPointsPrice: 0,
          productPaymentMethod: "CASH",
        },
      ],
    },
  ];

  it("preserves exact 14 columns in the main Orders sheet", () => {
    const expectedHeaders = [
      "Order Number",
      "Date",
      "Status",
      "Funding Mode",
      "Customer Name",
      "Customer Phone",
      "second phone",
      "Address",
      "Cash Total (EGP)",
      "Points Total",
      "Shipping Cash",
      "Shipping Points",
      "Items Breakdown",
      "العدد",
    ];
    expect(ORDER_EXCEL_HEADERS).toEqual(expectedHeaders);

    const wb = buildOrderExcelWorkbook(sampleOrders);
    expect(wb.SheetNames).toContain("Orders");
    expect(wb.SheetNames).toContain("Order Items");

    const ordersSheet = wb.Sheets["Orders"]!;
    const json = XLSX.utils.sheet_to_json<string[]>(ordersSheet, { header: 1 });
    expect(json[0]).toEqual(expectedHeaders);
  });

  it("calculates total pieces (العدد) as sum of all quantities, not line count", () => {
    // 2 + 3 + 1 = 6 pieces
    const totalPieces1 = calculateOrderTotalPieces(sampleOrders[0]!.items);
    expect(totalPieces1).toBe(6);

    const totalPieces2 = calculateOrderTotalPieces(sampleOrders[1]!.items);
    expect(totalPieces2).toBe(1);
  });

  it("formats Items Breakdown showing Product + Color + Size + Quantity clearly", () => {
    const breakdown1 = formatItemsBreakdown(sampleOrders[0]!.items);
    expect(breakdown1).toBe("بنطلون (أسود - M) x2 | بنطلون (أسود - L) x3 | بنطلون (أبيض - M) x1");

    const breakdown2 = formatItemsBreakdown(sampleOrders[1]!.items);
    expect(breakdown2).toBe("مج سيراميك (350 مل) x1");
  });

  it("preserves leading zero for Customer Phone and second phone as string", () => {
    expect(cleanPhoneNumber("01200551014")).toBe("01200551014");
    expect(cleanPhoneNumber("1200551014")).toBe("01200551014");
    expect(cleanPhoneNumber("'01200551015")).toBe("01200551015");

    const wb = buildOrderExcelWorkbook(sampleOrders);
    const ordersSheet = wb.Sheets["Orders"]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ordersSheet);

    expect(rows[0]?.["Customer Phone"]).toBe("01200551014");
    expect(rows[0]?.["second phone"]).toBe("01200551015");
  });

  it("builds the second sheet Order Items with exact detailed columns", () => {
    const wb = buildOrderExcelWorkbook(sampleOrders);
    const itemsSheet = wb.Sheets["Order Items"]!;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet);

    expect(json).toHaveLength(4);
    expect(json[0]?.["Order Number"]).toBe("VP-1071");
    expect(json[0]?.["Variant SKU"]).toBe("PANT-BLK-M");
    expect(json[0]?.["Color"]).toBe("أسود");
    expect(json[0]?.["Size"]).toBe("M");
    expect(Number(json[0]?.["Quantity"])).toBe(2);
  });

  it("validates allowed status transitions and rejects invalid ones", () => {
    expect(isValidStatusTransition("PENDING_CONFIRMATION", "CONFIRMED").valid).toBe(true);
    expect(isValidStatusTransition("CONFIRMED", "SHIPPED").valid).toBe(true);
    expect(isValidStatusTransition("SHIPPED", "DELIVERED").valid).toBe(true);
    expect(isValidStatusTransition("CONFIRMED", "CANCELLED").valid).toBe(true);

    // Terminal states cannot transition
    expect(isValidStatusTransition("DELIVERED", "PENDING_CONFIRMATION").valid).toBe(false);
    expect(isValidStatusTransition("CANCELLED", "CONFIRMED").valid).toBe(false);
  });

  it("parses and generates accurate preview when admin modifies quantities, phones, address", () => {
    const singleOrder = [sampleOrders[0]!];
    const existingOrdersSnapshot: ExistingOrderSnapshot[] = [
      {
        id: "ord-1111-2222-3333",
        orderNumber: "VP-1071",
        customerName: "maro six",
        customerPhone: "01200551014",
        status: "CONFIRMED",
        fundingMode: "CASH_ONLY",
        cashTotal: 680,
        pointsTotal: 0,
        shippingCashPrice: 80,
        shippingPointsPrice: 0,
        shippingAddress: {
          address: "موقف السلام - موقف السلام",
          city: "Cairo",
          secondaryPhone: "01200551015",
        },
        items: [
          {
            id: "item-1",
            variantId: "var-blk-m",
            productNameAr: "بنطلون",
            variantNameAr: "أسود / M",
            sku: "PANT-BLK-M",
            quantity: 2,
            unitCashPrice: 100,
            unitPointsPrice: 0,
            productPaymentMethod: "CASH",
          },
          {
            id: "item-2",
            variantId: "var-blk-l",
            productNameAr: "بنطلون",
            variantNameAr: "أسود / L",
            sku: "PANT-BLK-L",
            quantity: 3,
            unitCashPrice: 100,
            unitPointsPrice: 0,
            productPaymentMethod: "CASH",
          },
          {
            id: "item-3",
            variantId: "var-wht-m",
            productNameAr: "بنطلون",
            variantNameAr: "أبيض / M",
            sku: "PANT-WHT-M",
            quantity: 1,
            unitCashPrice: 100,
            unitPointsPrice: 0,
            productPaymentMethod: "CASH",
          },
        ],
      },
    ];

    // Simulate exporting the workbook for single order
    const wb = buildOrderExcelWorkbook(singleOrder);

    // Modify Sheet 2 (Order Items):
    // Black / M: 2 -> 4
    // Black / L: 3 -> 1
    // White / M: 1 -> 2
    // New total quantity = 4 + 1 + 2 = 7
    const itemsSheet = wb.Sheets["Order Items"]!;
    const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet);
    itemRows[0]!["Quantity"] = 4;
    itemRows[1]!["Quantity"] = 1;
    itemRows[2]!["Quantity"] = 2;
    const newItemsSheet = XLSX.utils.json_to_sheet(itemRows);
    wb.Sheets["Order Items"] = newItemsSheet;

    // Modify Sheet 1:
    // Customer Phone: 01200551014 -> 01200999999
    // second phone: 01200551015 -> 01200888888
    // Address: "مدينة نصر - الحي الثامن"
    const ordersSheet = wb.Sheets["Orders"]!;
    const orderRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ordersSheet);
    orderRows[0]!["Customer Phone"] = "01200999999";
    orderRows[0]!["second phone"] = "01200888888";
    orderRows[0]!["Address"] = "مدينة نصر - الحي الثامن";
    const newOrdersSheet = XLSX.utils.json_to_sheet(orderRows);
    wb.Sheets["Orders"] = newOrdersSheet;

    // Write to buffer
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    // Parse & Validate
    const preview = parseAndValidateOrderExcel(buffer, existingOrdersSnapshot);

    expect(preview.errors).toHaveLength(0);
    expect(preview.ordersCount).toBe(1);
    expect(preview.phoneUpdatesCount).toBe(1);
    expect(preview.secondaryPhoneUpdatesCount).toBe(1);
    expect(preview.addressUpdatesCount).toBe(1);
    expect(preview.quantityUpdatesCount).toBe(1);
    expect(preview.variantChangesCount).toBe(3);

    const change = preview.changes[0]!;
    expect(change.orderNumber).toBe("VP-1071");
    expect(change.customerPhone?.new).toBe("01200999999");
    expect(change.secondPhone?.new).toBe("01200888888");
    expect(change.address?.new).toBe("مدينة نصر - الحي الثامن");
    expect(change.totalQuantity?.old).toBe(6);
    expect(change.totalQuantity?.new).toBe(7);

    // Price integrity:
    // 7 items * 100 EGP + 80 shipping = 780 EGP
    expect(change.cashTotal?.new).toBe(780);
  });

  it("handles fallback parsing directly from Items Breakdown string in Sheet 1", () => {
    const existingOrdersSnapshot: ExistingOrderSnapshot[] = [
      {
        id: "ord-1111",
        orderNumber: "VP-1071",
        customerName: "maro six",
        customerPhone: "01200551014",
        status: "CONFIRMED",
        fundingMode: "CASH_ONLY",
        cashTotal: 680,
        pointsTotal: 0,
        shippingCashPrice: 80,
        shippingPointsPrice: 0,
        shippingAddress: "موقف السلام",
        items: [
          {
            id: "item-1",
            variantId: "var-blk-m",
            productNameAr: "بنطلون",
            variantNameAr: "أسود / M",
            sku: "PANT-BLK-M",
            quantity: 2,
            unitCashPrice: 100,
            unitPointsPrice: 0,
            productPaymentMethod: "CASH",
          },
          {
            id: "item-2",
            variantId: "var-blk-l",
            productNameAr: "بنطلون",
            variantNameAr: "أسود / L",
            sku: "PANT-BLK-L",
            quantity: 3,
            unitCashPrice: 100,
            unitPointsPrice: 0,
            productPaymentMethod: "CASH",
          },
        ],
      },
    ];

    const wb = XLSX.utils.book_new();
    const rows = [
      [...ORDER_EXCEL_HEADERS],
      [
        "VP-1071",
        "29/08/2026",
        "CONFIRMED",
        "CASH_ONLY",
        "maro six",
        "01200551014",
        "",
        "موقف السلام",
        410,
        0,
        80,
        0,
        "بنطلون (أسود - M) x4 | بنطلون (أسود - L) x1",
        5,
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, "Orders");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const preview = parseAndValidateOrderExcel(buffer, existingOrdersSnapshot);

    expect(preview.errors).toHaveLength(0);
    expect(preview.changes).toHaveLength(1);
    const change = preview.changes[0]!;
    expect(change.totalQuantity?.new).toBe(5);
    expect(change.variantChangesCount ?? change.itemChanges?.length).toBe(2);
  });

  it("rejects non-existent orders and invalid phone numbers", () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      [...ORDER_EXCEL_HEADERS],
      [
        "VP-9999", // non existent
        "29/08/2026",
        "CONFIRMED",
        "CASH_ONLY",
        "Test Name",
        "0312345678", // invalid Egyptian phone
        "",
        "Cairo",
        100,
        0,
        0,
        0,
        "Item x1",
        1,
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, "Orders");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const preview = parseAndValidateOrderExcel(buffer, []);

    expect(preview.errors.length).toBeGreaterThanOrEqual(1);
    expect(preview.errors[0]).toContain("VP-9999");
  });
});
