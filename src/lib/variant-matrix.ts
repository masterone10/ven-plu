/**
 * VEN+ Color × Size Variant Matrix Engine.
 *
 * Provides deterministic SKU generation, bidirectional matrix mapping,
 * row/column/grand totals calculation, bulk stock application, and
 * decomposition of existing product variants into Color × Size matrix grids.
 */

export interface MatrixCell {
  id?: string | undefined;
  color: string;
  size: string;
  sku: string;
  stock: number;
  isActive: boolean;
  cashPriceOverride: number | null;
  pointsPriceOverride: number | null;
  variantNameAr: string;
  variantNameEn: string;
  imageUrl?: string | null;
}

export interface MatrixDimensions {
  colors: string[];
  sizes: string[];
  cells: MatrixCell[];
}

/** Dictionary for deterministic color code generation */
const COLOR_CODE_MAP: Record<string, string> = {
  أسود: "BLK",
  black: "BLK",
  أبيض: "WHT",
  white: "WHT",
  رمادي: "GRY",
  رصاصي: "GRY",
  grey: "GRY",
  gray: "GRY",
  أزرق: "BLU",
  blue: "BLU",
  أحمر: "RED",
  red: "RED",
  أخضر: "GRN",
  green: "GRN",
  أصفر: "YLW",
  yellow: "YLW",
  بني: "BRN",
  brown: "BRN",
  كحلي: "NVY",
  navy: "NVY",
  بيج: "BEG",
  beige: "BEG",
  وردي: "PNK",
  بينك: "PNK",
  pink: "PNK",
  بنفسجي: "PRP",
  موف: "PRP",
  purple: "PRP",
  برتقالي: "ORG",
  orange: "ORG",
  سماوي: "SKY",
  sky: "SKY",
  ذهبي: "GLD",
  gold: "GLD",
  فضي: "SLV",
  silver: "SLV",
  زيتي: "OLV",
  olive: "OLV",
  عنابي: "BUR",
  مارون: "MAR",
  خمري: "BUR",
  نبيتي: "BUR",
  تركواز: "TRQ",
  فيروزي: "TRQ",
  خردلي: "MST",
  هافان: "HVN",
  طوبي: "BRK",
  جينز: "DNM",
  كشمير: "CSH",
};

/** Dictionary for deterministic size code generation */
const SIZE_CODE_MAP: Record<string, string> = {
  xs: "XS",
  "إكس سمول": "XS",
  "اكس سمول": "XS",
  "extra small": "XS",
  s: "S",
  سمول: "S",
  صغير: "S",
  small: "S",
  m: "M",
  ميديوم: "M",
  وسط: "M",
  medium: "M",
  l: "L",
  لارج: "L",
  كبير: "L",
  large: "L",
  xl: "XL",
  "إكس لارج": "XL",
  "اكس لارج": "XL",
  "extra large": "XL",
  xxl: "2XL",
  "2xl": "2XL",
  "2 إكس لارج": "2XL",
  "2 اكس لارج": "2XL",
  xxxl: "3XL",
  "3xl": "3XL",
  "3 إكس لارج": "3XL",
  "3 اكس لارج": "3XL",
  xxxxl: "4XL",
  "4xl": "4XL",
  "4 إكس لارج": "4XL",
  "4 اكس لارج": "4XL",
  xxxxxl: "5XL",
  "5xl": "5XL",
  "5 إكس لارج": "5XL",
  "5 اكس لارج": "5XL",
  "one size": "OS",
  "مقاس موحد": "OS",
  "free size": "FS",
  فري: "FS",
};

/**
 * Normalizes and produces a clean 2-4 letter uppercase code for a color.
 */
export function getColorCode(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (COLOR_CODE_MAP[normalized]) {
    return COLOR_CODE_MAP[normalized];
  }

  // Check if color has latin letters
  const latinClean = color.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (latinClean.length >= 2) {
    return latinClean.slice(0, 3);
  }

  // Fallback hash/transliteration for unknown Arabic color names
  let hash = 0;
  for (let i = 0; i < color.length; i++) {
    hash = (hash << 5) - hash + color.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(36).toUpperCase().slice(0, 3);
  return `C${hex}`.slice(0, 3);
}

/**
 * Normalizes and produces a clean code for a size.
 */
export function getSizeCode(size: string): string {
  const normalized = size.trim().toLowerCase();
  if (SIZE_CODE_MAP[normalized]) {
    return SIZE_CODE_MAP[normalized];
  }

  // Check for numerical size (e.g. 38, 40, 42, 128)
  const numMatch = size.match(/\d+/);
  if (numMatch) {
    return numMatch[0];
  }

  const latinClean = size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (latinClean.length > 0) {
    return latinClean.slice(0, 4);
  }

  // Fallback
  return size.trim().slice(0, 2).toUpperCase();
}

/**
 * Generates a deterministic, unique, uppercase SKU based on product code, color, and size.
 * Example: PANT-BLK-M
 */
export function generateVariantSku(
  productSkuOrSlug: string,
  color: string,
  size: string,
  existingSkus?: Set<string>,
): string {
  const rawPrefix = (productSkuOrSlug || "PROD")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  const prefix = rawPrefix.length > 0 ? rawPrefix.slice(0, 10) : "PROD";
  const cCode = getColorCode(color);
  const sCode = getSizeCode(size);

  let candidate = `${prefix}-${cCode}-${sCode}`.toUpperCase();

  if (existingSkus && existingSkus.has(candidate)) {
    let suffix = 2;
    while (existingSkus.has(`${candidate}-${suffix}`)) {
      suffix++;
    }
    candidate = `${candidate}-${suffix}`;
  }

  return candidate;
}

/**
 * Splits a variant name like "أسود / M" or "Black - L" into color and size parts.
 */
export function parseVariantColorAndSize(
  nameAr: string,
  nameEn?: string | null,
): { color: string; size: string } | null {
  const target = nameAr || nameEn || "";
  const parts = target
    .split(/[/|,\-—]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      color: parts[0]!,
      size: parts[1]!,
    };
  }

  return null;
}

export type VariantInputLike = {
  id?: string | undefined;
  sku?: string | undefined;
  nameAr?: string | undefined;
  nameEn?: string | null | undefined;
  variantNameAr?: string | undefined;
  variantNameEn?: string | null | undefined;
  stock?: number | undefined;
  cashPrice?: number | null | undefined;
  pointsPrice?: number | null | undefined;
  cashPriceOverride?: number | null | undefined;
  pointsPriceOverride?: number | null | undefined;
  isActive?: boolean | undefined;
  color?: string | undefined;
  size?: string | undefined;
};

/**
 * Builds or restores a Matrix representation given lists of colors and sizes
 * and any existing persisted variants.
 */
export function buildMatrix(
  colors: string[],
  sizes: string[],
  existingVariants: VariantInputLike[] = [],
  baseSku = "PROD",
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  const assignedSkus = new Set<string>();

  // Index existing variants by color and size or SKU
  const existingMap = new Map<string, VariantInputLike>();
  for (const v of existingVariants) {
    if (v.color && v.size) {
      existingMap.set(`${v.color.trim()}__${v.size.trim()}`, v);
      continue;
    }
    const nameAr = v.nameAr || v.variantNameAr || "";
    const nameEn = v.nameEn || v.variantNameEn || "";
    const parsed = parseVariantColorAndSize(nameAr, nameEn);
    if (parsed) {
      existingMap.set(`${parsed.color.trim()}__${parsed.size.trim()}`, v);
    }
  }

  for (const color of colors) {
    for (const size of sizes) {
      const key = `${color.trim()}__${size.trim()}`;
      const found = existingMap.get(key);

      if (found) {
        const sku = found.sku || generateVariantSku(baseSku, color, size, assignedSkus);
        cells.push({
          id: found.id,
          color: color.trim(),
          size: size.trim(),
          sku,
          stock: Math.max(0, Math.floor(found.stock ?? 0)),
          isActive: found.isActive ?? true,
          cashPriceOverride: found.cashPriceOverride ?? found.cashPrice ?? null,
          pointsPriceOverride: found.pointsPriceOverride ?? found.pointsPrice ?? null,
          variantNameAr: `${color.trim()} / ${size.trim()}`,
          variantNameEn: `${color.trim()} / ${size.trim()}`,
        });
        assignedSkus.add(sku);
      } else {
        const sku = generateVariantSku(baseSku, color, size, assignedSkus);
        assignedSkus.add(sku);
        cells.push({
          color: color.trim(),
          size: size.trim(),
          sku,
          stock: 10,
          isActive: true,
          cashPriceOverride: null,
          pointsPriceOverride: null,
          variantNameAr: `${color.trim()} / ${size.trim()}`,
          variantNameEn: `${color.trim()} / ${size.trim()}`,
        });
      }
    }
  }

  return cells;
}

/**
 * Extracts distinct Colors and Sizes and existing Matrix cells from product variants.
 */
export function extractMatrixFromVariants(
  variants: VariantInputLike[],
  baseSku = "PROD",
): MatrixDimensions {
  const colorSet = new Set<string>();
  const sizeSet = new Set<string>();

  for (const v of variants) {
    if (v.color && v.size) {
      colorSet.add(v.color.trim());
      sizeSet.add(v.size.trim());
      continue;
    }
    const nameAr = v.nameAr || v.variantNameAr || "";
    const nameEn = v.nameEn || v.variantNameEn || "";
    const parsed = parseVariantColorAndSize(nameAr, nameEn);
    if (parsed) {
      colorSet.add(parsed.color.trim());
      sizeSet.add(parsed.size.trim());
    }
  }

  const colors = Array.from(colorSet);
  const sizes = Array.from(sizeSet);

  if (colors.length === 0 || sizes.length === 0) {
    // If no multi-part name, return default empty or single dimension
    return {
      colors: [],
      sizes: [],
      cells: [],
    };
  }

  const cells = buildMatrix(colors, sizes, variants, baseSku);
  return { colors, sizes, cells };
}

/**
 * Calculates the total stock for a given Color row.
 */
export function calculateRowTotal(cells: MatrixCell[], color: string): number {
  return cells
    .filter((c) => c.color === color && c.isActive)
    .reduce((sum, c) => sum + (c.stock || 0), 0);
}

/**
 * Calculates the total stock for a given Size column.
 */
export function calculateColumnTotal(cells: MatrixCell[], size: string): number {
  return cells
    .filter((c) => c.size === size && c.isActive)
    .reduce((sum, c) => sum + (c.stock || 0), 0);
}

/**
 * Calculates the grand total stock across all active cells in the matrix.
 */
export function calculateGrandTotal(cells: MatrixCell[]): number {
  return cells.filter((c) => c.isActive).reduce((sum, c) => sum + (c.stock || 0), 0);
}

/**
 * Bulk applies stock to all cells of a specific color.
 */
export function applyBulkStockToColor(
  cells: MatrixCell[],
  color: string,
  newStock: number,
): MatrixCell[] {
  const stockVal = Math.max(0, Math.floor(newStock));
  return cells.map((cell) => {
    if (cell.color === color) {
      return { ...cell, stock: stockVal };
    }
    return cell;
  });
}

/**
 * Bulk applies stock to all cells of a specific size.
 */
export function applyBulkStockToSize(
  cells: MatrixCell[],
  size: string,
  newStock: number,
): MatrixCell[] {
  const stockVal = Math.max(0, Math.floor(newStock));
  return cells.map((cell) => {
    if (cell.size === size) {
      return { ...cell, stock: stockVal };
    }
    return cell;
  });
}

/**
 * Bulk applies stock to all cells in the matrix.
 */
export function applyBulkStockToAll(cells: MatrixCell[], newStock: number): MatrixCell[] {
  const stockVal = Math.max(0, Math.floor(newStock));
  return cells.map((cell) => ({ ...cell, stock: stockVal }));
}

/**
 * Validates the matrix cells before saving to ensure strict consistency.
 */
export function validateMatrix(
  colors: string[],
  sizes: string[],
  cells: MatrixCell[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (colors.length === 0) {
    errors.push("يرجى إضافة لون واحد على الأقل");
  }
  if (sizes.length === 0) {
    errors.push("يرجى إضافة مقاس واحد على الأقل");
  }

  const skus = new Set<string>();
  let hasActive = false;

  for (const cell of cells) {
    if (!cell.sku || !cell.sku.trim()) {
      errors.push(`كود SKU مطلوب لمتغير ${cell.color} × ${cell.size}`);
    } else {
      const cleanSku = cell.sku.trim().toUpperCase();
      if (skus.has(cleanSku)) {
        errors.push(`كود SKU مكرر: ${cleanSku}`);
      }
      skus.add(cleanSku);
    }

    if (cell.stock < 0 || !Number.isInteger(cell.stock)) {
      errors.push(`المخزون لمتغير ${cell.color} × ${cell.size} يجب أن يكون رقماً صحيحاً موجباً`);
    }

    if (cell.cashPriceOverride !== null && cell.cashPriceOverride < 0) {
      errors.push(`السعر المخصص لمتغير ${cell.color} × ${cell.size} لا يمكن أن يكون سالباً`);
    }

    if (cell.isActive) {
      hasActive = true;
    }
  }

  if (!hasActive && cells.length > 0) {
    errors.push("يجب تفعيل متغير واحد على الأقل للبيع");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Finds a matching variant in a list for a specific color and size.
 */
export function findVariantForCell<
  T extends {
    nameAr: string;
    nameEn?: string | null;
    sku?: string;
    isActive?: boolean;
    stock?: number;
  },
>(variants: T[], color: string, size: string): T | undefined {
  const normColor = color.trim().toLowerCase();
  const normSize = size.trim().toLowerCase();

  return variants.find((v) => {
    const parsed = parseVariantColorAndSize(v.nameAr, v.nameEn);
    if (parsed) {
      return (
        parsed.color.trim().toLowerCase() === normColor &&
        parsed.size.trim().toLowerCase() === normSize
      );
    }
    const name = `${v.nameAr} ${v.nameEn || ""}`.toLowerCase();
    return name.includes(normColor) && name.includes(normSize);
  });
}

/**
 * Returns a summary of a matrix cell.
 */
export function getMatrixCellSummary(color: string, size: string, stock: number, sku: string) {
  return `${color} × ${size} (${sku}) - ${stock} in stock`;
}
