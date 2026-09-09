/**
 * Turns a parsed ingredient into { grams, nutrients } — the bridge between
 * ingestion and every downstream feature.
 *
 * Sources, in order:
 *   1. the SQLite cache (a food's facts don't change; never look it up twice)
 *   2. USDA FoodData Central, when USDA_API_KEY is set
 *   3. the seeded local table (lib/nutrition/foods.ts)
 *
 * Step 3 is what keeps the app working with no key, no network, and in CI.
 */

import { resolveGrams, type GramContext, type GramResolution } from "@/lib/domain/grams";
import type { Nutrients } from "@/lib/domain/types";
import { lookupFood, type FoodEntry } from "./foods";
import { searchFood, usdaConfigured, type UsdaFood } from "./usda";
import { getCachedFood, putCachedFood, type CachedFood } from "@/lib/db/foodCache";

export interface ResolvedIngredient {
  grams: number | null;
  gramsSource: GramResolution["source"] | null;
  /** Per 100 g. Null when no source knew this food. */
  nutrients: Nutrients | null;
  fdcId: number | null;
  /** Which source supplied the nutrients — surfaced in the review UI. */
  provider: "cache" | "usda" | "seed" | null;
}

export interface ResolveInput {
  canonical: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  /** The model's own gram guess, used as the last rung of the ladder. */
  estimatedGrams?: number | null;
}

/**
 * Resolve one ingredient. Never throws on a network failure — a USDA outage
 * degrades to seed data rather than failing the whole import.
 */
export async function resolveIngredient(input: ResolveInput): Promise<ResolvedIngredient> {
  const facts = await lookupFacts(input.canonical, input.item);

  const ctx: GramContext = {
    densityGPerMl: facts?.densityGPerMl ?? null,
    gramsPerItem: facts?.gramsPerItem ?? null,
    gramsPerCountUnit: facts?.gramsPerCountUnit ?? null,
    portions: facts?.portions ?? null,
    estimatedGrams: input.estimatedGrams ?? null,
  };

  const resolution = resolveGrams(input.quantity, input.unit, ctx);

  return {
    grams: resolution?.grams ?? null,
    gramsSource: resolution?.source ?? null,
    nutrients: facts?.nutrients ?? null,
    fdcId: facts?.fdcId ?? null,
    provider: facts?.provider ?? null,
  };
}

export async function resolveIngredients(
  inputs: ResolveInput[],
): Promise<ResolvedIngredient[]> {
  return Promise.all(inputs.map(resolveIngredient));
}

interface FoodFacts {
  nutrients: Nutrients;
  densityGPerMl: number | null;
  gramsPerItem: number | null;
  gramsPerCountUnit: Record<string, number> | null;
  portions: Record<string, number> | null;
  fdcId: number | null;
  provider: "cache" | "usda" | "seed";
}

async function lookupFacts(canonical: string, item: string): Promise<FoodFacts | null> {
  const key = canonical.trim().toLowerCase();
  if (!key) return null;

  // 1. cache
  const cached = safeGetCached(key);
  if (cached) return fromCache(cached);

  const seed = lookupFood(key) ?? lookupFood(item);

  // 2. USDA — merged with seed data, since USDA has no per-item masses
  //    ("1 medium onion") and the seed table does.
  if (usdaConfigured()) {
    try {
      const usda = await searchFood(canonical);
      if (usda) {
        const facts = fromUsda(usda, seed);
        safePutCached(key, facts);
        return facts;
      }
    } catch {
      // Network or quota failure. Fall through to seed data — a personal app
      // should not lose macros because a public API had a bad afternoon.
    }
  }

  // 3. seed
  if (seed) {
    const facts = fromSeed(seed);
    safePutCached(key, facts);
    return facts;
  }

  return null;
}

function fromSeed(seed: FoodEntry): FoodFacts {
  return {
    nutrients: seed.nutrients,
    densityGPerMl: seed.densityGPerMl,
    gramsPerItem: seed.gramsPerItem,
    gramsPerCountUnit: seed.gramsPerCountUnit ?? null,
    portions: null,
    fdcId: null,
    provider: "seed",
  };
}

function fromUsda(usda: UsdaFood, seed: FoodEntry | null): FoodFacts {
  return {
    nutrients: usda.nutrients,
    // USDA portions cover volume; the seed table still owns per-item masses.
    densityGPerMl: seed?.densityGPerMl ?? null,
    gramsPerItem: seed?.gramsPerItem ?? null,
    gramsPerCountUnit: seed?.gramsPerCountUnit ?? null,
    portions: usda.portions,
    fdcId: usda.fdcId,
    provider: "usda",
  };
}

function fromCache(cached: CachedFood): FoodFacts {
  return {
    nutrients: cached.nutrients,
    densityGPerMl: cached.densityGPerMl,
    gramsPerItem: cached.gramsPerItem,
    gramsPerCountUnit: cached.gramsPerCountUnit,
    portions: cached.portions,
    fdcId: cached.fdcId,
    provider: "cache",
  };
}

function safeGetCached(key: string): CachedFood | null {
  try {
    return getCachedFood(key);
  } catch {
    return null; // Cache is an optimisation; never let it break a lookup.
  }
}

function safePutCached(key: string, facts: FoodFacts): void {
  try {
    putCachedFood({
      canonical: key,
      nutrients: facts.nutrients,
      densityGPerMl: facts.densityGPerMl,
      gramsPerItem: facts.gramsPerItem,
      gramsPerCountUnit: facts.gramsPerCountUnit,
      portions: facts.portions,
      fdcId: facts.fdcId,
    });
  } catch {
    // Non-fatal.
  }
}

/**
 * Per-100g panels for a set of ingredients, keyed by ingredient id.
 * Feeds computeRecipeMacros when rendering a saved recipe.
 */
export async function nutrientsForIngredients(
  ingredients: { id: string; canonical: string; item: string }[],
): Promise<Record<string, Nutrients | undefined>> {
  const out: Record<string, Nutrients | undefined> = {};
  await Promise.all(
    ingredients.map(async (ing) => {
      const facts = await lookupFacts(ing.canonical, ing.item);
      if (facts) out[ing.id] = facts.nutrients;
    }),
  );
  return out;
}
