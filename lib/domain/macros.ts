/**
 * Macro aggregation and serving scaling.
 *
 * All of this is arithmetic once ingredients have grams — which is the whole
 * point of the gram ladder. See docs/ARCHITECTURE.md §3.3.
 */

import type { GramsSource, Ingredient, Nutrients, Recipe } from "./types";
import { EMPTY_NUTRIENTS } from "./types";
import { weakestSource } from "./grams";

/** Nutrition facts a caller supplies per ingredient, keyed by ingredient id. */
export type NutrientsById = Record<string, Nutrients | undefined>;

export interface MacroBreakdown {
  ingredientId: string;
  label: string;
  grams: number | null;
  nutrients: Nutrients;
  /** True when this ingredient contributed nothing (unmatched or optional). */
  unresolved: boolean;
}

export interface RecipeMacros {
  /** Totals for the recipe as written (i.e. for `baseServings`). */
  total: Nutrients;
  /** Totals divided by `baseServings`. */
  perServing: Nutrients;
  breakdown: MacroBreakdown[];
  /** Weakest gram source among contributing ingredients. */
  confidence: GramsSource | null;
  /** Ingredients we could not price nutritionally — shown to the user. */
  unresolvedLabels: string[];
  /** Share of total mass we have nutrition data for, 0..1. */
  coverage: number;
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  };
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
    fiber: n.fiber * factor,
    sugar: n.sugar * factor,
    sodium: n.sodium * factor,
  };
}

/** Nutrients for `grams` of a food whose panel is quoted per 100 g. */
export function nutrientsForGrams(per100g: Nutrients, grams: number): Nutrients {
  return scaleNutrients(per100g, grams / 100);
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    protein: round1(n.protein),
    carbs: round1(n.carbs),
    fat: round1(n.fat),
    fiber: round1(n.fiber),
    sugar: round1(n.sugar),
    sodium: Math.round(n.sodium),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Compute macros for a recipe.
 *
 * @param per100gById  per-100g panel for each ingredient id. Missing entries are
 *                     reported as unresolved rather than silently treated as 0,
 *                     because a zero would quietly understate the whole recipe.
 */
export function computeRecipeMacros(
  recipe: Pick<Recipe, "baseServings"> & { ingredients: Ingredient[] },
  per100gById: NutrientsById,
): RecipeMacros {
  let total: Nutrients = { ...EMPTY_NUTRIENTS };
  const breakdown: MacroBreakdown[] = [];
  const unresolvedLabels: string[] = [];
  const sources: (GramsSource | null)[] = [];

  let coveredGrams = 0;
  let totalGrams = 0;

  for (const ing of recipe.ingredients) {
    // Optional items ("garnish with cilantro") don't belong in a macro total.
    if (ing.optional) {
      breakdown.push({
        ingredientId: ing.id,
        label: ing.item,
        grams: ing.grams,
        nutrients: { ...EMPTY_NUTRIENTS },
        unresolved: false,
      });
      continue;
    }

    const per100g = per100gById[ing.id];
    const grams = ing.grams;

    if (grams != null && grams > 0) totalGrams += grams;

    if (!per100g || grams == null || grams <= 0) {
      breakdown.push({
        ingredientId: ing.id,
        label: ing.item,
        grams,
        nutrients: { ...EMPTY_NUTRIENTS },
        unresolved: true,
      });
      unresolvedLabels.push(ing.item);
      continue;
    }

    const contribution = nutrientsForGrams(per100g, grams);
    total = addNutrients(total, contribution);
    coveredGrams += grams;
    sources.push(ing.gramsSource);

    breakdown.push({
      ingredientId: ing.id,
      label: ing.item,
      grams,
      nutrients: contribution,
      unresolved: false,
    });
  }

  const servings = recipe.baseServings > 0 ? recipe.baseServings : 1;

  return {
    total,
    perServing: scaleNutrients(total, 1 / servings),
    breakdown,
    confidence: weakestSource(sources),
    unresolvedLabels,
    coverage: totalGrams > 0 ? coveredGrams / totalGrams : 0,
  };
}

/**
 * Scale a recipe to a different serving count.
 *
 * Scales `quantity` and `grams` — never the `raw` display string, which stays
 * as the source wrote it. The scale factor is exact; rendering rounds to
 * kitchen fractions at display time (lib/domain/quantity.ts).
 */
export function scaleRecipe<T extends Pick<Recipe, "baseServings" | "ingredients">>(
  recipe: T,
  targetServings: number,
): T {
  const base = recipe.baseServings > 0 ? recipe.baseServings : 1;
  const factor = targetServings / base;

  return {
    ...recipe,
    baseServings: targetServings,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: ing.quantity == null ? null : ing.quantity * factor,
      grams: ing.grams == null ? null : ing.grams * factor,
    })),
  };
}

/** Scale factor between a recipe's base servings and a target. */
export function servingFactor(baseServings: number, targetServings: number): number {
  const base = baseServings > 0 ? baseServings : 1;
  return targetServings / base;
}
