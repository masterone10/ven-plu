import * as XLSX from "xlsx";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders-rules";

export const ORDER_EXCEL_HEADERS = [
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
] as const;

export const ORDER_ITEMS_SHEET_HEADERS = [
  "Order Number",
  "Product SKU",
  "Variant SKU",
  "Product Name",
  "Color",
  "Size",
  "Variant Name",
  "Quantity",
  "Unit Cash Price",
  "Unit Points Price",
  "Payment Method",
] as const;

export interface OrderItemForExcel {
  id?: string;
  productId?: string;
  variantId?: string | null;
  productNameAr: string;
  productNameEn?: string | null;
  variantNameAr?: string | null;
  variantNameEn?: string | null;
  sku?: string | null;
  productSku?: string | null;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unitCashPrice?: number;
  unitPointsPrice?: number;
  productPaymentMethod?: "CASH" | "POINTS";
  lineCashTotal?: number;
  linePointsTotal?: number;
}

export interface OrderForExcel {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  fundingMode: "CASH_ONLY" | "POINTS_ONLY" | "MIXED";
  customerName?: string | null;
  customerPhone: string;
  secondPhone?: string | null;
  shippingAddress?:
    | {
        address?: string;
        street?: string;
        city?: string;
        state?: string;
        secondaryPhone?: string;
        secondPhone?: string;
        notes?: string;
      }
    | string
    | null;
  cashTotal: number;
  pointsTotal: number;
  shippingCashPrice: number;
  shippingPointsPrice: number;
  items: OrderItemForExcel[];
}

/**
 * Extracts and cleans Egyptian phone number ensuring leading 0 is preserved
 */
export function cleanPhoneNumber(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  let str = String(raw).trim();
  // Remove leading single quotes often used in Excel for text formatting
  if (str.startsWith("'")) {
    str = str.slice(1).trim();
  }
  // Remove non-digit characters
  str = str.replace(/[^\d+]/g, "");

  // If starts with +20 or 20, convert to local 01xxxxxxxxx
  if (str.startsWith("+20")) {
    str = "0" + str.slice(3);
  } else if (str.startsWith("20") && str.length === 12) {
    str = "0" + str.slice(2);
  } else if (str.length === 10 && str.startsWith("1")) {
    str = "0" + str;
  }

  return str;
}

/**
 * Formats address object into a single line string for Excel
 */
export function formatAddressForExcel(addr?: unknown): string {
  if (!addr) return "";
  if (typeof addr === "string") return addr;

  if (typeof addr === "object" && addr !== null) {
    const obj = addr as Record<string, unknown>;
    const parts = [obj["address"], obj["street"], obj["city"], obj["state"], obj["notes"]].filter(
      (p): p is string => Boolean(p && typeof p === "string" && p.trim().length > 0),
    );
    return parts.join(" - ");
  }

  return "";
}

/**
 * Extracts second phone from shippingAddress JSON if not on root
 */
export function extractSecondPhone(shippingAddress?: unknown, rootSecondPhone?: unknown): string {
  if (rootSecondPhone && typeof rootSecondPhone === "string" && rootSecondPhone.trim()) {
    return cleanPhoneNumber(rootSecondPhone);
  }
  if (typeof shippingAddress === "object" && shippingAddress !== null) {
    const obj = shippingAddress as Record<string, unknown>;
    const sec = (obj["secondaryPhone"] as string) || (obj["secondPhone"] as string) || "";
    return cleanPhoneNumber(sec);
  }
  return "";
}

/**
 * Calculates total piece count (العدد) across all items in an order
 */
export function calculateOrderTotalPieces(items: Array<{ quantity: number }>): number {
  return (items || []).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
}

/**
 * Formats variant breakdown string according to specification:
 * - Products with Color & Size: "بنطلون (أسود - M) x2"
 * - Products with single dimension: "مج سيراميك (350 مل) x1"
 * - Multiple items joined by " | "
 */
export function formatItemsBreakdown(items: OrderItemForExcel[]): string {
  if (!items || items.length === 0) return "";

  return items
    .map((item) => {
      const pName = item.productNameAr || "منتج";
      const vName = item.variantNameAr || "";
      const qty = item.quantity || 1;

      if (!vName || vName.trim() === "Default" || vName.trim() === "افتراضي") {
        return `${pName} x${qty}`;
      }

      // If variantName has " / ", replace with " - " for cleaner Excel representation
      const formattedVName = vName.replace(/\s*\/\s*/g, " - ");
      return `${pName} (${formattedVName}) x${qty}`;
    })
    .join(" | ");
}

/**
 * Formats a Date to DD/MM/YYYY
 */
export function formatDateForExcel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Extracts Color and Size from variant string like "أسود / M" or "Black - Large"
 */
export function parseColorAndSizeFromVariant(variantStr?: string | null): {
  color: string;
  size: string;
} {
  if (!variantStr) return { color: "", size: "" };
  const cleaned = variantStr.replace(/\s*-\s*/g, " / ").trim();
  const parts = cleaned.split("/").map((p) => p.trim());

  if (parts.length >= 2) {
    return {
      color: parts[0] || "",
      size: parts[1] || "",
    };
  }
  return {
    color: parts[0] || "",
    size: "",
  };
}

/**
 * Builds the official 2-sheet Excel workbook for Orders
 */
export function buildOrderExcelWorkbook(orders: OrderForExcel[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ==========================================
  // Sheet 1: Orders (Master Sheet - EXACT 14 COLUMNS)
  // ==========================================
  const orderRows: (string | number)[][] = [[...ORDER_EXCEL_HEADERS]];

  for (const order of orders) {
    const formattedDate = formatDateForExcel(order.createdAt);
    const secPhone = extractSecondPhone(order.shippingAddress, order.secondPhone);
    const addressStr = formatAddressForExcel(order.shippingAddress);
    const itemsBreakdownStr = formatItemsBreakdown(order.items);
    const totalPieces = calculateOrderTotalPieces(order.items);

    orderRows.push([
      order.orderNumber,
      formattedDate,
      order.status,
      order.fundingMode,
      order.customerName || "",
      order.customerPhone ? String(cleanPhoneNumber(order.customerPhone)) : "",
      secPhone ? String(secPhone) : "",
      addressStr,
      Number(order.cashTotal) || 0,
      Number(order.pointsTotal) || 0,
      Number(order.shippingCashPrice) || 0,
      Number(order.shippingPointsPrice) || 0,
      itemsBreakdownStr,
      totalPieces,
    ]);
  }

  const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);

  // Set explicit column widths for Orders Sheet
  wsOrders["!cols"] = [
    { wch: 14 }, // Order Number
    { wch: 12 }, // Date
    { wch: 18 }, // Status
    { wch: 14 }, // Funding Mode
    { wch: 22 }, // Customer Name
    { wch: 16 }, // Customer Phone
    { wch: 16 }, // second phone
    { wch: 35 }, // Address
    { wch: 16 }, // Cash Total (EGP)
    { wch: 14 }, // Points Total
    { wch: 14 }, // Shipping Cash
    { wch: 14 }, // Shipping Points
    { wch: 50 }, // Items Breakdown
    { wch: 10 }, // العدد
  ];

  // Set phone cells as explicit string types to preserve leading zeros
  for (let r = 1; r < orderRows.length; r++) {
    const phoneCellRef = XLSX.utils.encode_cell({ r, c: 5 }); // Customer Phone
    if (wsOrders[phoneCellRef]) {
      wsOrders[phoneCellRef].t = "s";
    }
    const secPhoneCellRef = XLSX.utils.encode_cell({ r, c: 6 }); // second phone
    if (wsOrders[secPhoneCellRef]) {
      wsOrders[secPhoneCellRef].t = "s";
    }
    const orderNumCellRef = XLSX.utils.encode_cell({ r, c: 0 }); // Order Number
    if (wsOrders[orderNumCellRef]) {
      wsOrders[orderNumCellRef].t = "s";
    }
  }

  XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");

  // ==========================================
  // Sheet 2: Order Items (Granular Variant Breakdown)
  // ==========================================
  const itemRows: (string | number)[][] = [[...ORDER_ITEMS_SHEET_HEADERS]];

  for (const order of orders) {
    for (const item of order.items) {
      const { color, size } = parseColorAndSizeFromVariant(item.variantNameAr);

      itemRows.push([
        order.orderNumber,
        item.productSku || item.sku || "",
        item.sku || "",
        item.productNameAr || "",
        item.color || color || "",
        item.size || size || "",
        item.variantNameAr || "",
        item.quantity || 1,
        item.unitCashPrice || 0,
        item.unitPointsPrice || 0,
        item.productPaymentMethod || "CASH",
      ]);
    }
  }

  const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
  wsItems["!cols"] = [
    { wch: 14 }, // Order Number
    { wch: 14 }, // Product SKU
    { wch: 16 }, // Variant SKU
    { wch: 24 }, // Product Name
    { wch: 12 }, // Color
    { wch: 10 }, // Size
    { wch: 20 }, // Variant Name
    { wch: 10 }, // Quantity
    { wch: 16 }, // Unit Cash Price
    { wch: 16 }, // Unit Points Price
    { wch: 16 }, // Payment Method
  ];

  XLSX.utils.book_append_sheet(wb, wsItems, "Order Items");

  return wb;
}

/**
 * Generates an Excel binary buffer for downloading
 */
export function exportOrdersToExcelBuffer(orders: OrderForExcel[]): Uint8Array {
  const wb = buildOrderExcelWorkbook(orders);
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

export interface ExistingOrderSnapshot {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone: string;
  status: OrderStatus;
  fundingMode: "CASH_ONLY" | "POINTS_ONLY" | "MIXED";
  cashTotal: number;
  pointsTotal: number;
  shippingCashPrice: number;
  shippingPointsPrice: number;
  shippingAddress: unknown;
  items: Array<{
    id: string;
    variantId?: string | null;
    productId?: string | null;
    productNameAr: string;
    productNameEn?: string | null;
    variantNameAr?: string | null;
    variantNameEn?: string | null;
    sku: string;
    quantity: number;
    unitCashPrice?: number;
    unitPointsPrice?: number;
    productPaymentMethod?: "CASH" | "POINTS";
  }>;
}

export interface OrderUpdateDiff {
  orderNumber: string;
  orderId: string;
  customerName?: { old?: string | null | undefined; new: string } | undefined;
  customerPhone?: { old: string; new: string } | undefined;
  secondPhone?: { old?: string | null | undefined; new: string } | undefined;
  address?: { old: string; new: string } | undefined;
  status?: { old: OrderStatus; new: OrderStatus } | undefined;
  totalQuantity?: { old: number; new: number } | undefined;
  cashTotal?: { old: number; new: number } | undefined;
  pointsTotal?: { old: number; new: number } | undefined;
  itemChanges?:
    | Array<{
        itemId?: string | undefined;
        variantSku: string;
        name: string;
        oldQty: number;
        newQty: number;
      }>
    | undefined;
  variantChangesCount?: number | undefined;
}

export interface OrderExcelPreviewResult {
  ordersCount: number;
  phoneUpdatesCount: number;
  secondaryPhoneUpdatesCount: number;
  addressUpdatesCount: number;
  statusUpdatesCount: number;
  quantityUpdatesCount: number;
  variantChangesCount: number;
  changes: OrderUpdateDiff[];
  errors: string[];
  warnings: string[];
}

/**
 * Validates allowed status transitions
 */
export function isValidStatusTransition(
  oldStatus: OrderStatus,
  newStatus: OrderStatus,
): { valid: boolean; reason?: string } {
  if (oldStatus === newStatus) return { valid: true };

  // Terminal states cannot be transitioned out of
  if (oldStatus === "DELIVERED") {
    return {
      valid: false,
      reason: "Delivered orders cannot be moved back to any previous status.",
    };
  }
  if (oldStatus === "CANCELLED") {
    return {
      valid: false,
      reason: "Cancelled orders cannot be modified or re-activated.",
    };
  }

  // Allowed transitions
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  const allowedNext = allowed[oldStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return {
      valid: false,
      reason: `Status transition from ${oldStatus} to ${newStatus} is not allowed.`,
    };
  }

  return { valid: true };
}

/**
 * Parses Items Breakdown string like:
 * "بنطلون (أسود - M) x2 | بنطلون (أسود - L) x3"
 * or "مج سيراميك (350 مل) x1"
 */
export function parseItemsBreakdownString(
  breakdown: string,
): Array<{ productName: string; variantDesc: string; quantity: number }> {
  if (!breakdown || !breakdown.trim()) return [];

  const segments = breakdown
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const results: Array<{ productName: string; variantDesc: string; quantity: number }> = [];

  for (const seg of segments) {
    // Match: Name (Variant) xQty OR Name xQty
    const matchWithParen = seg.match(/^(.+?)\s*\((.+?)\)\s*[xX×](\d+)$/);
    if (matchWithParen) {
      results.push({
        productName: matchWithParen[1]?.trim() || "",
        variantDesc: matchWithParen[2]?.trim() || "",
        quantity: parseInt(matchWithParen[3] || "1", 10),
      });
      continue;
    }

    const matchNoParen = seg.match(/^(.+?)\s*[xX×](\d+)$/);
    if (matchNoParen) {
      results.push({
        productName: matchNoParen[1]?.trim() || "",
        variantDesc: "",
        quantity: parseInt(matchNoParen[2] || "1", 10),
      });
    }
  }

  return results;
}

function normalizeTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[/,\-()]+/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses and validates uploaded Excel file against existing order snapshots
 */
export function parseAndValidateOrderExcel(
  fileBuffer: ArrayBuffer | Uint8Array,
  existingOrders: ExistingOrderSnapshot[],
): OrderExcelPreviewResult {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const errors: string[] = [];
  const warnings: string[] = [];
  const changes: OrderUpdateDiff[] = [];

  const existingOrderMap = new Map<string, ExistingOrderSnapshot>();
  for (const o of existingOrders) {
    existingOrderMap.set(o.orderNumber.toUpperCase(), o);
  }

  // Find the primary Orders sheet
  const ordersSheetName =
    workbook.SheetNames.find(
      (n) =>
        n.toLowerCase() === "orders" ||
        n.toLowerCase().includes("order") ||
        n.includes("الطلبات") ||
        n.includes("اوردرات"),
    ) || workbook.SheetNames[0];

  if (!ordersSheetName || !workbook.Sheets[ordersSheetName]) {
    errors.push("No valid Orders sheet found in workbook.");
    return {
      ordersCount: 0,
      phoneUpdatesCount: 0,
      secondaryPhoneUpdatesCount: 0,
      addressUpdatesCount: 0,
      statusUpdatesCount: 0,
      quantityUpdatesCount: 0,
      variantChangesCount: 0,
      changes: [],
      errors,
      warnings,
    };
  }

  const orderRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[ordersSheetName]!,
    {
      raw: false,
      defval: "",
    },
  );

  // Check if Sheet 2 (Order Items) exists for granular variant editing
  const itemsSheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes("item"));

  const parsedItemChangesByOrder = new Map<string, Map<string, number>>();

  if (itemsSheetName && workbook.Sheets[itemsSheetName]) {
    const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[itemsSheetName]!,
      { raw: false, defval: "" },
    );

    for (const row of itemRows) {
      const orderNum = ((row["Order Number"] as string) || (row["order_number"] as string) || "")
        .toString()
        .trim()
        .toUpperCase();
      const variantSku = (
        (row["Variant SKU"] as string) ||
        (row["variant_sku"] as string) ||
        (row["SKU"] as string) ||
        ""
      )
        .toString()
        .trim();
      const qtyStr = (
        (row["Quantity"] as string) ||
        (row["quantity"] as string) ||
        (row["الكمية"] as string) ||
        "1"
      )
        .toString()
        .trim();
      const qty = parseInt(qtyStr, 10);

      if (orderNum && variantSku && !isNaN(qty) && qty >= 0) {
        if (!parsedItemChangesByOrder.has(orderNum)) {
          parsedItemChangesByOrder.set(orderNum, new Map<string, number>());
        }
        parsedItemChangesByOrder.get(orderNum)!.set(variantSku, qty);
      }
    }
  }

  let customerUpdatesCount = 0;
  let phoneUpdatesCount = 0;
  let secondaryPhoneUpdatesCount = 0;
  let addressUpdatesCount = 0;
  let statusUpdatesCount = 0;
  let quantityUpdatesCount = 0;
  let variantChangesCount = 0;

  for (let idx = 0; idx < orderRows.length; idx++) {
    const row = orderRows[idx]!;
    const rowNum = idx + 2;

    const orderNumber = (
      (row["Order Number"] as string) ||
      (row["order_number"] as string) ||
      (row["رقم الطلب"] as string) ||
      ""
    )
      .toString()
      .trim()
      .toUpperCase();

    if (!orderNumber) {
      continue;
    }

    const existing = existingOrderMap.get(orderNumber);
    if (!existing) {
      errors.push(`Row ${rowNum}: Order "${orderNumber}" not found in database.`);
      continue;
    }

    const diff: OrderUpdateDiff = {
      orderNumber,
      orderId: existing.id,
    };

    // 1. Customer Name
    const newCustomerName = (
      (row["Customer Name"] as string) ||
      (row["customer_name"] as string) ||
      (row["اسم العميل"] as string) ||
      ""
    )
      .toString()
      .trim();

    if (newCustomerName && newCustomerName !== existing.customerName) {
      diff.customerName = { old: existing.customerName, new: newCustomerName };
      customerUpdatesCount++;
    }

    // 2. Customer Phone
    const rawPhone = (
      (row["Customer Phone"] as string) ||
      (row["customer_phone"] as string) ||
      (row["رقم الهاتف"] as string) ||
      ""
    )
      .toString()
      .trim();
    const newCustomerPhone = cleanPhoneNumber(rawPhone);

    if (newCustomerPhone && newCustomerPhone !== existing.customerPhone) {
      if (!/^01\d{9}$/.test(newCustomerPhone)) {
        errors.push(
          `Row ${rowNum} (${orderNumber}): Invalid Customer Phone "${newCustomerPhone}". Egyptian mobile numbers must be 11 digits starting with 01.`,
        );
      } else {
        diff.customerPhone = { old: existing.customerPhone, new: newCustomerPhone };
        phoneUpdatesCount++;
      }
    }

    // 3. Second Phone
    const rawSecPhone = (
      (row["second phone"] as string) ||
      (row["Second Phone"] as string) ||
      (row["second_phone"] as string) ||
      (row["هاتف إضافي"] as string) ||
      ""
    )
      .toString()
      .trim();
    const newSecPhone = cleanPhoneNumber(rawSecPhone);
    const existingSecPhone = extractSecondPhone(existing.shippingAddress);

    if (newSecPhone !== existingSecPhone) {
      if (newSecPhone && !/^01\d{9}$/.test(newSecPhone)) {
        errors.push(
          `Row ${rowNum} (${orderNumber}): Invalid second phone "${newSecPhone}". Must be 11 digits starting with 01.`,
        );
      } else {
        diff.secondPhone = { old: existingSecPhone, new: newSecPhone };
        secondaryPhoneUpdatesCount++;
      }
    }

    // 4. Address
    const newAddressStr = (
      (row["Address"] as string) ||
      (row["address"] as string) ||
      (row["العنوان"] as string) ||
      ""
    )
      .toString()
      .trim();
    const existingAddressStr = formatAddressForExcel(existing.shippingAddress);

    if (newAddressStr && newAddressStr !== existingAddressStr) {
      diff.address = { old: existingAddressStr, new: newAddressStr };
      addressUpdatesCount++;
    }

    // 5. Status
    const newStatusStr = (
      (row["Status"] as string) ||
      (row["status"] as string) ||
      (row["الحالة"] as string) ||
      ""
    )
      .toString()
      .trim()
      .toUpperCase();

    if (newStatusStr && newStatusStr !== existing.status) {
      if (!ORDER_STATUSES.includes(newStatusStr as OrderStatus)) {
        errors.push(
          `Row ${rowNum} (${orderNumber}): Invalid status "${newStatusStr}". Allowed values: ${ORDER_STATUSES.join(", ")}.`,
        );
      } else {
        const transition = isValidStatusTransition(existing.status, newStatusStr as OrderStatus);
        if (!transition.valid) {
          errors.push(
            `Row ${rowNum} (${orderNumber}): Invalid status transition. ${transition.reason}`,
          );
        } else {
          diff.status = { old: existing.status, new: newStatusStr as OrderStatus };
          statusUpdatesCount++;
        }
      }
    }

    // 6. Items & Quantities
    // Check if we have Sheet 2 changes for this order
    const sheet2ItemsMap = parsedItemChangesByOrder.get(orderNumber);
    const itemChangesList: Array<{
      itemId?: string;
      variantSku: string;
      name: string;
      oldQty: number;
      newQty: number;
    }> = [];

    if (sheet2ItemsMap) {
      for (const item of existing.items) {
        const newQty = sheet2ItemsMap.get(item.sku);
        if (newQty !== undefined && newQty !== item.quantity) {
          itemChangesList.push({
            itemId: item.id,
            variantSku: item.sku,
            name: `${item.productNameAr} (${item.variantNameAr || item.sku})`,
            oldQty: item.quantity,
            newQty,
          });
        }
      }
    } else {
      // Fallback: Try parsing Items Breakdown from Sheet 1
      const breakdownStr = (
        (row["Items Breakdown"] as string) ||
        (row["items_breakdown"] as string) ||
        (row["تفاصيل المنتجات"] as string) ||
        ""
      )
        .toString()
        .trim();

      if (breakdownStr) {
        const parsedItems = parseItemsBreakdownString(breakdownStr);
        if (parsedItems.length > 0) {
          // Match against existing items
          for (const item of existing.items) {
            const itemTokens = [
              ...normalizeTokens(item.productNameAr),
              ...normalizeTokens(item.variantNameAr || ""),
            ];

            const parsedMatch = parsedItems.find((p) => {
              const pTokens = [
                ...normalizeTokens(p.productName),
                ...normalizeTokens(p.variantDesc),
              ];
              // Check if all parsed tokens exist in item tokens
              return pTokens.every((t) => itemTokens.includes(t));
            });

            if (parsedMatch && parsedMatch.quantity !== item.quantity) {
              itemChangesList.push({
                itemId: item.id,
                variantSku: item.sku,
                name: `${item.productNameAr} (${item.variantNameAr || item.sku})`,
                oldQty: item.quantity,
                newQty: parsedMatch.quantity,
              });
            }
          }
        }
      }
    }

    if (itemChangesList.length > 0) {
      diff.itemChanges = itemChangesList;
      variantChangesCount += itemChangesList.length;

      // Recalculate totals Server-Side
      let recalculatedCashTotal = 0;
      let recalculatedPointsTotal = 0;
      let newTotalPieces = 0;
      const oldTotalPieces = calculateOrderTotalPieces(existing.items);

      for (const item of existing.items) {
        const itemChange = itemChangesList.find((c) => c.variantSku === item.sku);
        const qty = itemChange !== undefined ? itemChange.newQty : item.quantity;
        newTotalPieces += qty;

        if (item.productPaymentMethod === "CASH") {
          recalculatedCashTotal += (item.unitCashPrice || 0) * qty;
        } else {
          recalculatedPointsTotal += (item.unitPointsPrice || 0) * qty;
        }
      }

      recalculatedCashTotal += existing.shippingCashPrice || 0;
      recalculatedPointsTotal += existing.shippingPointsPrice || 0;

      diff.totalQuantity = { old: oldTotalPieces, new: newTotalPieces };
      diff.cashTotal = { old: existing.cashTotal, new: recalculatedCashTotal };
      diff.pointsTotal = { old: existing.pointsTotal, new: recalculatedPointsTotal };
      quantityUpdatesCount++;
    }

    const hasChanges = Boolean(
      diff.customerName ||
      diff.customerPhone ||
      diff.secondPhone ||
      diff.address ||
      diff.status ||
      (diff.itemChanges && diff.itemChanges.length > 0),
    );

    if (hasChanges) {
      diff.variantChangesCount = diff.itemChanges?.length || 0;
      changes.push(diff);
    }
  }

  return {
    ordersCount: changes.length,
    phoneUpdatesCount,
    secondaryPhoneUpdatesCount,
    addressUpdatesCount,
    statusUpdatesCount,
    quantityUpdatesCount,
    variantChangesCount,
    changes,
    errors,
    warnings,
  };
}
