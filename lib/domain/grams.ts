/**
 * Gram resolution — the ladder described in docs/ARCHITECTURE.md §3.2.
 *
 * Every ingredient has to end up with a mass in grams, because that is the only
 * form in which "2 cups flour" and "250 g flour" can be added together. We try
 * four strategies in descending order of trustworthiness and record which one
 * won, so the UI can be honest about how solid a macro number is.
 */

import { getUnit, massToGrams, volumeToMl } from "./units";
import type { GramsSource } from "./types";

export interface GramResolution {
  grams: number;
  source: GramsSource;
}

/** Per-food facts needed to resolve mass. Satisfied by the seed table or USDA. */
export interface GramContext {
  densityGPerMl?: number | null;
  gramsPerItem?: number | null;
  gramsPerCountUnit?: Record<string, number> | null;
  /** USDA foodPortions, e.g. { "cup, chopped": 160 }. Best volume source. */
  portions?: Record<string, number> | null;
  /** Model's own gram guess. Last resort. */
  estimatedGrams?: number | null;
}

/** Fallback density for unknown foods, roughly that of water-heavy produce. */
const DEFAULT_DENSITY = 1.0;

/**
 * Resolve an ingredient's mass.
 *
 * @param quantity  parsed numeric amount, or null if the recipe gave none
 * @param unitKey   canonical unit key, or null for a bare count ("2 eggs")
 * @param ctx       per-food conversion facts
 */
export function resolveGrams(
  quantity: number | null,
  unitKey: string | null,
  ctx: GramContext = {},
): GramResolution | null {
  // No quantity at all ("salt to taste"). An estimate is all we can offer.
  if (quantity === null || !Number.isFinite(quantity)) {
    return ctx.estimatedGrams != null && ctx.estimatedGrams > 0
      ? { grams: ctx.estimatedGrams, source: "estimate" }
      : null;
  }

  const unit = getUnit(unitKey);

  // 1. explicit — the recipe already stated mass.
  if (unit?.kind === "mass") {
    const grams = massToGrams(quantity, unit.key);
    if (grams !== null) return { grams, source: "explicit" };
  }

  // 2. portion — a per-food, per-prep gram weight (USDA foodPortions).
  if (unit?.kind === "volume" && ctx.portions) {
    const portionGrams = matchPortion(unit.key, ctx.portions);
    if (portionGrams !== null) {
      const unitDef = getUnit(unit.key);
      // Portions are quoted per 1 unit, so scale by the recipe's quantity.
      if (unitDef) return { grams: portionGrams * quantity, source: "portion" };
    }
  }

  // 3. density — volume converted through g/ml.
  if (unit?.kind === "volume") {
    const ml = volumeToMl(quantity, unit.key);
    if (ml !== null) {
      const density = ctx.densityGPerMl ?? DEFAULT_DENSITY;
      const source: GramsSource = ctx.densityGPerMl != null ? "density" : "estimate";
      return { grams: ml * density, source };
    }
  }

  // 4. counts — "3 cloves garlic", "2 eggs". Never routed through volume.
  if (unit === null || unit.kind === "count") {
    const perUnit = countUnitGrams(unitKey, ctx);
    if (perUnit !== null) {
      // A per-item mass is a real measurement; a guessed one is not.
      const source: GramsSource = ctx.gramsPerCountUnit?.[unitKey ?? ""] != null || ctx.gramsPerItem != null
        ? "density"
        : "estimate";
      return { grams: perUnit * quantity, source };
    }
  }

  // Nothing matched — fall back to whatever the model estimated.
  if (ctx.estimatedGrams != null && ctx.estimatedGrams > 0) {
    return { grams: ctx.estimatedGrams, source: "estimate" };
  }

  return null;
}

/** Grams for one of a count unit ("clove", "slice") or one bare item. */
function countUnitGrams(unitKey: string | null, ctx: GramContext): number | null {
  if (unitKey && ctx.gramsPerCountUnit) {
    const specific = ctx.gramsPerCountUnit[unitKey];
    if (specific != null && specific > 0) return specific;
  }
  // "piece"/"whole" and a bare count both mean one of the thing.
  if (unitKey === null || unitKey === "piece") {
    if (ctx.gramsPerItem != null && ctx.gramsPerItem > 0) return ctx.gramsPerItem;
  }
  // Tiny seasoning units have conventional masses.
  if (unitKey === "pinch") return 0.36;
  if (unitKey === "dash") return 0.6;
  return null;
}

/**
 * Find a USDA portion row matching a unit.
 *
 * USDA keys look like "cup, chopped" or "tbsp". We want the plainest match for
 * the unit — a bare "cup" beats "cup, sliced" when we don't know the prep,
 * because the plain row is the general case.
 */
function matchPortion(unitKey: string, portions: Record<string, number>): number | null {
  const unit = getUnit(unitKey);
  if (!unit) return null;

  const candidates = [unit.key, unit.label.toLowerCase(), ...unit.aliases.map((a) => a.toLowerCase())];

  let best: { grams: number; specificity: number } | null = null;
  for (const [rawKey, grams] of Object.entries(portions)) {
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const key = rawKey.toLowerCase().trim();
    const head = key.split(",")[0].trim();
    if (!candidates.includes(head)) continue;
    // Fewer comma-separated qualifiers = more general = preferred.
    const specificity = key.split(",").length;
    if (!best || specificity < best.specificity) best = { grams, specificity };
  }

  return best?.grams ?? null;
}

/** Ordering used to describe overall confidence in a recipe's macros. */
const CONFIDENCE_RANK: Record<GramsSource, number> = {
  explicit: 3,
  portion: 3,
  density: 2,
  estimate: 1,
};

export function weakestSource(sources: (GramsSource | null)[]): GramsSource | null {
  let weakest: GramsSource | null = null;
  for (const s of sources) {
    if (!s) continue;
    if (!weakest || CONFIDENCE_RANK[s] < CONFIDENCE_RANK[weakest]) weakest = s;
  }
  return weakest;
}
