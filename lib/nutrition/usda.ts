/**
 * USDA FoodData Central client.
 *
 * Why USDA rather than a generic density table: FDC publishes a `foodPortions`
 * table per food ("1 cup, chopped -> 160 g"), which is per-food AND per-prep.
 * That is the difference between a real volume->mass conversion and a guess.
 *
 * Free API key: https://fdc.nal.usda.gov/api-key-signup.html  (set USDA_API_KEY)
 * The app works without one — see lib/nutrition/resolve.ts for the fallback.
 */

import type { Nutrients } from "@/lib/domain/types";

const BASE = "https://api.nal.usda.gov/fdc/v1";

/** FDC nutrient ids for the panel we care about. */
const NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
} as const;

export interface UsdaFood {
  fdcId: number;
  description: string;
  /** Per 100 g. */
  nutrients: Nutrients;
  /** Portion label -> grams, e.g. { "cup, chopped": 160 }. */
  portions: Record<string, number>;
}

interface FdcNutrientRow {
  nutrientId?: number;
  nutrient?: { id?: number };
  value?: number;
  amount?: number;
}

interface FdcPortionRow {
  gramWeight?: number;
  modifier?: string;
  measureUnit?: { name?: string };
  portionDescription?: string;
}

interface FdcFood {
  fdcId: number;
  description: string;
  foodNutrients?: FdcNutrientRow[];
  foodPortions?: FdcPortionRow[];
}

export function usdaConfigured(): boolean {
  return Boolean(process.env.USDA_API_KEY);
}

/**
 * Search FDC and return the best match.
 *
 * Data types are requested in quality order: Foundation and SR Legacy are
 * lab-analysed generic foods, which is what a recipe ingredient usually means.
 * Branded entries are excluded — "onion" should not match "Onion Rings, frozen".
 */
export async function searchFood(
  query: string,
  signal?: AbortSignal,
): Promise<UsdaFood | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${BASE}/foods/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("dataType", "Foundation,SR Legacy");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`USDA search failed (${res.status}) for "${query}"`);
  }

  const body = (await res.json()) as { foods?: FdcFood[] };
  const hit = body.foods?.[0];
  if (!hit) return null;

  // The search payload omits foodPortions, so fetch the detail record for the
  // portion table — that table is the entire reason we prefer USDA.
  return getFood(hit.fdcId, signal);
}

export async function getFood(
  fdcId: number,
  signal?: AbortSignal,
): Promise<UsdaFood | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${BASE}/food/${fdcId}`);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`USDA lookup failed (${res.status}) for fdcId ${fdcId}`);
  }

  return toUsdaFood((await res.json()) as FdcFood);
}

function toUsdaFood(food: FdcFood): UsdaFood {
  return {
    fdcId: food.fdcId,
    description: food.description,
    nutrients: extractNutrients(food.foodNutrients ?? []),
    portions: extractPortions(food.foodPortions ?? []),
  };
}

function extractNutrients(rows: FdcNutrientRow[]): Nutrients {
  const byId = new Map<number, number>();
  for (const row of rows) {
    const id = row.nutrientId ?? row.nutrient?.id;
    const value = row.value ?? row.amount;
    if (id != null && typeof value === "number" && Number.isFinite(value)) {
      byId.set(id, value);
    }
  }
  const get = (id: number) => byId.get(id) ?? 0;
  return {
    kcal: get(NUTRIENT_IDS.kcal),
    protein: get(NUTRIENT_IDS.protein),
    carbs: get(NUTRIENT_IDS.carbs),
    fat: get(NUTRIENT_IDS.fat),
    fiber: get(NUTRIENT_IDS.fiber),
    sugar: get(NUTRIENT_IDS.sugar),
    sodium: get(NUTRIENT_IDS.sodium),
  };
}

/**
 * Flatten FDC portion rows into `{ "cup, chopped": 160 }`.
 *
 * Keys are built as "<unit>, <modifier>" so that lib/domain/grams.ts can prefer
 * the least-qualified row for a unit when it doesn't know the prep.
 */
function extractPortions(rows: FdcPortionRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const grams = row.gramWeight;
    if (typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0) continue;

    const unit = (row.measureUnit?.name ?? "").trim().toLowerCase();
    const modifier = (row.modifier ?? "").trim().toLowerCase();

    // "undetermined" is FDC's placeholder for rows with no usable unit.
    const base = unit && unit !== "undetermined" ? unit : modifier;
    if (!base) continue;

    const key = unit && unit !== "undetermined" && modifier ? `${unit}, ${modifier}` : base;
    // Keep the first (most general) row for a given key.
    if (!(key in out)) out[key] = grams;
  }
  return out;
}
