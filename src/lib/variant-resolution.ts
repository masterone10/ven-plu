import type { CatalogVariant } from "@/lib/catalog.functions";

export type AttributeDimension = {
  name: string; // e.g. "اللون" or "المقاس" or "الخاصية"
  values: string[];
};

export type ParsedVariant = {
  variant: CatalogVariant;
  attributes: Record<string, string>;
};

/** Common Arabic and English dimension labels */
const DIMENSION_NAMES_AR = [
  "اللون",
  "المقاس",
  "النوع",
  "المادة",
  "السعة",
  "الحجم",
  "الوزن",
  "الموديل",
  "الخاصية",
];
const DIMENSION_NAMES_EN = [
  "Color",
  "Size",
  "Type",
  "Material",
  "Capacity",
  "Volume",
  "Weight",
  "Model",
  "Option",
];

const KNOWN_COLORS = new Set([
  "أحمر",
  "أزرق",
  "أسود",
  "أبيض",
  "أخضر",
  "أصفر",
  "وردي",
  "كحلي",
  "رمادي",
  "بيج",
  "بني",
  "بنفسجي",
  "برتقالي",
  "سماوي",
  "ذهبي",
  "فضي",
  "red",
  "blue",
  "black",
  "white",
  "green",
  "yellow",
  "pink",
  "navy",
  "gray",
  "grey",
  "beige",
  "brown",
  "purple",
  "gold",
  "silver",
]);

const KNOWN_SIZES = new Set([
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "2xl",
  "3xl",
  "4xl",
  "xs",
  "xxs",
  "صغير",
  "وسط",
  "كبير",
  "سمول",
  "ميديوم",
  "لارج",
  "إكس لارج",
]);

/**
 * Parses variant names like "أحمر / XL" or "Red / XL" or "Black - 128GB"
 * into a set of named attribute dimensions and maps each variant to its values.
 */
export function extractVariantAttributes(
  variants: CatalogVariant[],
  locale: "ar" | "en" = "ar",
): {
  dimensions: AttributeDimension[];
  parsedVariants: ParsedVariant[];
} {
  if (!variants || variants.length === 0) {
    return { dimensions: [], parsedVariants: [] };
  }

  // Check if variants have multi-part names split by "/", "-", "|", or ","
  const parsedVariants: ParsedVariant[] = [];
  const dimensionValuesMap: Map<string, Set<string>> = new Map();

  // Inspect all variants
  const splitSamples = variants.map((v) => {
    const rawName = locale === "ar" ? v.nameAr || v.nameEn : v.nameEn || v.nameAr;
    const parts = rawName
      .split(/[/|,\-—]/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { variant: v, parts: parts.length > 0 ? parts : [rawName.trim()] };
  });

  const maxParts = Math.max(...splitSamples.map((s) => s.parts.length), 1);

  if (maxParts === 1) {
    // Single attribute dimension: determine if it's Color, Size, or general Option
    const firstValLower = (splitSamples[0]?.parts[0] || "").toLowerCase();
    let dimName = locale === "ar" ? "النوع / الخيار" : "Option";
    if (KNOWN_COLORS.has(firstValLower)) {
      dimName = locale === "ar" ? "اللون" : "Color";
    } else if (KNOWN_SIZES.has(firstValLower)) {
      dimName = locale === "ar" ? "المقاس" : "Size";
    }

    const values = new Set<string>();

    for (const item of splitSamples) {
      const val = item.parts[0] || (locale === "ar" ? item.variant.nameAr : item.variant.nameEn);
      values.add(val);
      parsedVariants.push({
        variant: item.variant,
        attributes: { [dimName]: val },
      });
    }

    return {
      dimensions: [{ name: dimName, values: Array.from(values) }],
      parsedVariants,
    };
  }

  // Multi-part dimensions: assign dimension names based on part index
  const dimNames: string[] = [];
  for (let i = 0; i < maxParts; i++) {
    const defaultName =
      locale === "ar"
        ? DIMENSION_NAMES_AR[i] || `الخاصية ${i + 1}`
        : DIMENSION_NAMES_EN[i] || `Attribute ${i + 1}`;
    dimNames.push(defaultName);
    dimensionValuesMap.set(defaultName, new Set());
  }

  for (const item of splitSamples) {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < maxParts; i++) {
      const dimName = dimNames[i];
      if (dimName) {
        const val = item.parts[i] || item.parts[item.parts.length - 1] || "";
        attributes[dimName] = val;
        if (val) {
          dimensionValuesMap.get(dimName)?.add(val);
        }
      }
    }
    parsedVariants.push({
      variant: item.variant,
      attributes,
    });
  }

  const dimensions: AttributeDimension[] = dimNames
    .map((name) => ({
      name,
      values: Array.from(dimensionValuesMap.get(name) || []),
    }))
    .filter((dim) => dim.values.length > 0);

  return { dimensions, parsedVariants };
}

/**
 * Resolves the exact variant from the current attribute selection.
 * Returns null if no exact match exists unless fallbackToFirst is true.
 */
export function resolveVariant(
  parsedVariants: ParsedVariant[],
  selectedAttributes: Record<string, string>,
  fallbackToFirst = true,
): CatalogVariant | null {
  if (parsedVariants.length === 0) return null;

  // Try exact match
  const match = parsedVariants.find((pv) => {
    return Object.entries(selectedAttributes).every(([dim, val]) => pv.attributes[dim] === val);
  });

  if (match) return match.variant;

  // Fallback to first variant if none matched and fallbackToFirst is true
  return fallbackToFirst ? parsedVariants[0]?.variant || null : null;
}

/**
 * Returns the exact matching variant for the selected attributes without fallback.
 * If the attribute combination does not exist, returns null.
 */
export function findExactVariant(
  parsedVariants: ParsedVariant[],
  selectedAttributes: Record<string, string>,
): CatalogVariant | null {
  if (parsedVariants.length === 0) return null;
  const match = parsedVariants.find((pv) => {
    return Object.entries(selectedAttributes).every(([dim, val]) => pv.attributes[dim] === val);
  });
  return match ? match.variant : null;
}

/**
 * Returns the attribute dictionary for a specific variant ID.
 */
export function getAttributesForVariant(
  parsedVariants: ParsedVariant[],
  variantId: string,
): Record<string, string> {
  const match = parsedVariants.find((pv) => pv.variant.id === variantId);
  return match ? { ...match.attributes } : {};
}

/**
 * Checks if a specific attribute value can be selected given the currently selected other attributes.
 */
export function isAttributeAvailable(
  parsedVariants: ParsedVariant[],
  targetDim: string,
  targetValue: string,
  currentSelections: Record<string, string>,
): { available: boolean; inStock: boolean } {
  // Candidate variants that have this target value for targetDim
  const candidates = parsedVariants.filter((pv) => {
    if (pv.attributes[targetDim] !== targetValue) return false;

    // Must also match all other currently selected attributes (excluding targetDim)
    return Object.entries(currentSelections).every(([dim, val]) => {
      if (dim === targetDim) return true;
      return pv.attributes[dim] === val;
    });
  });

  if (candidates.length === 0) {
    return { available: false, inStock: false };
  }

  const hasStock = candidates.some((c) => c.variant.stock > 0);
  return { available: true, inStock: hasStock };
}
