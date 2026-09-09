/**
 * Unit registry. Recipes are written by humans, so the same unit arrives as
 * "tbsp", "Tablespoons", "T." and "tbs" — every one of those has to collapse to
 * a single key before any arithmetic happens.
 */

export type UnitKind = "mass" | "volume" | "count";

export interface UnitDef {
  key: string;
  kind: UnitKind;
  /** Grams per unit (mass) or millilitres per unit (volume). Null for counts. */
  factor: number | null;
  /** Display form, singular. */
  label: string;
  /**
   * Display form for quantities other than 1. Omitted for abbreviations, which
   * don't pluralise in recipe shorthand ("2 tbsp", not "2 tbsps").
   */
  pluralLabel?: string;
  aliases: string[];
}

const DEFS: UnitDef[] = [
  // ---- mass -------------------------------------------------------------
  { key: "g", kind: "mass", factor: 1, label: "g", aliases: ["g", "gram", "grams", "gr", "gm", "gms"] },
  { key: "kg", kind: "mass", factor: 1000, label: "kg", aliases: ["kg", "kilo", "kilos", "kilogram", "kilograms"] },
  { key: "oz", kind: "mass", factor: 28.3495, label: "oz", aliases: ["oz", "ounce", "ounces"] },
  { key: "lb", kind: "mass", factor: 453.592, label: "lb", aliases: ["lb", "lbs", "pound", "pounds", "#"] },

  // ---- volume (US customary) --------------------------------------------
  { key: "ml", kind: "volume", factor: 1, label: "ml", aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "cc"] },
  { key: "l", kind: "volume", factor: 1000, label: "L", aliases: ["l", "liter", "liters", "litre", "litres"] },
  { key: "tsp", kind: "volume", factor: 4.92892, label: "tsp", aliases: ["tsp", "tsps", "t", "teaspoon", "teaspoons"] },
  { key: "tbsp", kind: "volume", factor: 14.7868, label: "tbsp", aliases: ["tbsp", "tbsps", "tbs", "tb", "T", "tablespoon", "tablespoons"] },
  { key: "floz", kind: "volume", factor: 29.5735, label: "fl oz", aliases: ["floz", "fl oz", "fluid ounce", "fluid ounces"] },
  { key: "cup", kind: "volume", factor: 236.588, label: "cup", pluralLabel: "cups", aliases: ["cup", "cups", "c"] },
  { key: "pint", kind: "volume", factor: 473.176, label: "pint", pluralLabel: "pints", aliases: ["pint", "pints", "pt"] },
  { key: "quart", kind: "volume", factor: 946.353, label: "quart", pluralLabel: "quarts", aliases: ["quart", "quarts", "qt"] },
  { key: "gallon", kind: "volume", factor: 3785.41, label: "gallon", pluralLabel: "gallons", aliases: ["gallon", "gallons", "gal"] },

  // ---- counts -----------------------------------------------------------
  // No factor: these convert to grams via the per-item table, never by volume.
  { key: "piece", kind: "count", factor: null, label: "", aliases: ["piece", "pieces", "whole", "each", "ea"] },
  { key: "clove", kind: "count", factor: null, label: "clove", pluralLabel: "cloves", aliases: ["clove", "cloves"] },
  { key: "slice", kind: "count", factor: null, label: "slice", pluralLabel: "slices", aliases: ["slice", "slices"] },
  { key: "can", kind: "count", factor: null, label: "can", pluralLabel: "cans", aliases: ["can", "cans", "tin", "tins"] },
  { key: "bunch", kind: "count", factor: null, label: "bunch", pluralLabel: "bunches", aliases: ["bunch", "bunches"] },
  { key: "head", kind: "count", factor: null, label: "head", pluralLabel: "heads", aliases: ["head", "heads"] },
  { key: "stalk", kind: "count", factor: null, label: "stalk", pluralLabel: "stalks", aliases: ["stalk", "stalks", "rib", "ribs"] },
  { key: "sprig", kind: "count", factor: null, label: "sprig", pluralLabel: "sprigs", aliases: ["sprig", "sprigs"] },
  { key: "package", kind: "count", factor: null, label: "package", pluralLabel: "packages", aliases: ["package", "packages", "pkg", "packet", "packets"] },
  { key: "pinch", kind: "count", factor: null, label: "pinch", pluralLabel: "pinches", aliases: ["pinch", "pinches"] },
  { key: "dash", kind: "count", factor: null, label: "dash", pluralLabel: "dashes", aliases: ["dash", "dashes"] },
];

const BY_KEY = new Map(DEFS.map((d) => [d.key, d]));

/**
 * Alias lookup. Case-sensitive entries are checked before the lowercased map so
 * that "T" (tablespoon) and "t" (teaspoon) stay distinct — a genuine ambiguity
 * in handwritten recipes that costs a 3x error if collapsed.
 */
const CASE_SENSITIVE = new Map<string, string>([
  ["T", "tbsp"],
  ["t", "tsp"],
]);

const BY_ALIAS = new Map<string, string>();
for (const def of DEFS) {
  for (const alias of def.aliases) {
    const lowered = alias.toLowerCase();
    // First registration wins, so each unit's canonical alias takes precedence.
    if (!BY_ALIAS.has(lowered)) BY_ALIAS.set(lowered, def.key);
  }
}

export function getUnit(key: string | null): UnitDef | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/** Resolve free-text unit ("Tablespoons", "fl. oz.") to a canonical key. */
export function normalizeUnit(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const exact = CASE_SENSITIVE.get(trimmed);
  if (exact) return exact;

  // Strip trailing periods and collapse internal whitespace: "fl. oz." -> "fl oz"
  const cleaned = trimmed
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  return BY_ALIAS.get(cleaned) ?? null;
}

export function unitKind(key: string | null): UnitKind | null {
  return getUnit(key)?.kind ?? null;
}

/** Convert a mass quantity to grams. Returns null for non-mass units. */
export function massToGrams(quantity: number, unitKey: string): number | null {
  const def = getUnit(unitKey);
  if (!def || def.kind !== "mass" || def.factor === null) return null;
  return quantity * def.factor;
}

/** Convert a volume quantity to millilitres. Returns null for non-volume units. */
export function volumeToMl(quantity: number, unitKey: string): number | null {
  const def = getUnit(unitKey);
  if (!def || def.kind !== "volume" || def.factor === null) return null;
  return quantity * def.factor;
}

export const ALL_UNITS: readonly UnitDef[] = DEFS;

/**
 * Display label for a unit at a given quantity.
 * Abbreviations stay invariant; spelled-out and count units pluralise.
 */
export function unitLabel(key: string | null, quantity: number | null): string {
  const def = getUnit(key);
  if (!def) return "";
  if (quantity === null || Math.abs(quantity - 1) < 1e-9) return def.label;
  return def.pluralLabel ?? def.label;
}
