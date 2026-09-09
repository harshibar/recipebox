/**
 * The ingestion pipeline: raw input -> Claude -> normalized -> gram-resolved.
 *
 * Everything that reaches the review screen has already been through the gram
 * ladder, so the user sees real macros while they're still correcting typos.
 */

import { normalizeUnit } from "@/lib/domain/units";
import { parseQuantity } from "@/lib/domain/quantity";
import type { Ingredient, Nutrients, SourceType } from "@/lib/domain/types";
import { resolveIngredients } from "@/lib/nutrition/resolve";
import { parseRecipe, type ParseOptions } from "./parse";
import type { ParsedRecipe } from "./schema";

export type DraftIngredient = Omit<Ingredient, "id" | "recipeId"> & {
  /** Per-100g panel, carried alongside so the review screen can show macros. */
  nutrients: Nutrients | null;
  provider: "cache" | "usda" | "seed" | null;
};

export interface RecipeDraft {
  title: string;
  sourceType: SourceType;
  sourceRef: string | null;
  imagePath: string | null;
  baseServings: number;
  totalTimeMin: number | null;
  steps: string[];
  tags: string[];
  notes: string | null;
  ingredients: DraftIngredient[];
  /** The model's self-reported transcription confidence. */
  parseConfidence: ParsedRecipe["confidence"];
}

export interface IngestOptions extends ParseOptions {
  sourceType: SourceType;
  sourceRef?: string | null;
  imagePath?: string | null;
}

export async function ingestRecipe(options: IngestOptions): Promise<RecipeDraft> {
  const parsed = await parseRecipe(options);
  return buildDraft(parsed, options);
}

/**
 * Normalize a parsed recipe and resolve grams. Exported separately from
 * `ingestRecipe` so it can be tested without calling the model.
 */
export async function buildDraft(
  parsed: ParsedRecipe,
  meta: Pick<IngestOptions, "sourceType" | "sourceRef" | "imagePath">,
): Promise<RecipeDraft> {
  const normalized = parsed.ingredients.map((ing) => ({
    raw: ing.raw,
    quantity: parseQuantity(ing.quantity),
    unit: normalizeUnit(ing.unit),
    item: ing.item.trim(),
    canonical: ing.canonical.trim().toLowerCase(),
    prep: ing.prep?.trim() || null,
    optional: ing.optional,
    estimatedGrams: ing.estimatedGrams,
  }));

  const resolved = await resolveIngredients(normalized);

  const ingredients: DraftIngredient[] = normalized.map((ing, i) => ({
    position: i,
    raw: ing.raw,
    quantity: ing.quantity,
    unit: ing.unit,
    item: ing.item,
    canonical: ing.canonical,
    prep: ing.prep,
    optional: ing.optional,
    grams: resolved[i].grams,
    gramsSource: resolved[i].gramsSource,
    fdcId: resolved[i].fdcId,
    nutrients: resolved[i].nutrients,
    provider: resolved[i].provider,
  }));

  return {
    title: parsed.title.trim() || "Untitled recipe",
    sourceType: meta.sourceType,
    sourceRef: meta.sourceRef ?? null,
    imagePath: meta.imagePath ?? null,
    // A zero or negative serving count would make every per-serving macro
    // infinite, so clamp it here rather than at every read site.
    baseServings: parsed.servings > 0 ? parsed.servings : 1,
    totalTimeMin: parsed.totalTimeMin,
    steps: parsed.steps,
    tags: parsed.tags,
    notes: parsed.notes,
    ingredients,
    parseConfidence: parsed.confidence,
  };
}

/** Per-100g panels keyed by ingredient id, for computeRecipeMacros. */
export function nutrientsByPosition(
  ingredients: DraftIngredient[],
): Record<string, Nutrients | undefined> {
  const out: Record<string, Nutrients | undefined> = {};
  ingredients.forEach((ing, i) => {
    if (ing.nutrients) out[String(i)] = ing.nutrients;
  });
  return out;
}
