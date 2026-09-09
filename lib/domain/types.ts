/**
 * The domain model. See docs/ARCHITECTURE.md §2 for why each field exists.
 *
 * The short version: `grams` is the pivot. Macros, scaling, grocery lists and
 * pantry matching are all arithmetic once an ingredient knows its mass.
 */

/** How confident we are in an ingredient's `grams`. Ordered best to worst. */
export type GramsSource = "explicit" | "portion" | "density" | "estimate";

export type SourceType = "photo" | "instagram" | "url" | "manual";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/** Per-100g nutrient panel. The unit of exchange with any nutrition source. */
export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  sugar: number; // g
  sodium: number; // mg
}

export interface Ingredient {
  id: string;
  recipeId: string;
  position: number;
  /** Verbatim source line. Never discarded — parsing is probabilistic. */
  raw: string;
  quantity: number | null;
  /** Canonical unit key from lib/domain/units.ts, not free text. */
  unit: string | null;
  /** Display name: "yellow onion". */
  item: string;
  /** Join key for grocery merging and pantry matching: "onion". */
  canonical: string;
  prep: string | null;
  grams: number | null;
  gramsSource: GramsSource | null;
  fdcId: number | null;
  /** Excluded from grocery lists, macros, and the pantry-match denominator. */
  optional: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceRef: string | null;
  imagePath: string | null;
  /** The serving count that the stored ingredient quantities describe. */
  baseServings: number;
  totalTimeMin: number | null;
  steps: string[];
  tags: string[];
  notes: string | null;
  createdAt: string;
  ingredients: Ingredient[];
}

export interface PantryItem {
  id: string;
  canonical: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  updatedAt: string;
}

export interface MealPlanEntry {
  id: string;
  planId: string;
  date: string;
  slot: MealSlot;
  recipeId: string;
  servings: number;
}

export interface MealPlan {
  id: string;
  weekStart: string;
  entries: MealPlanEntry[];
}

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
};
