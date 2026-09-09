/** Recipe persistence. */

import { randomUUID } from "node:crypto";
import type { Ingredient, Recipe, SourceType } from "@/lib/domain/types";
import { getDb } from "./client";

interface RecipeRow {
  id: string;
  title: string;
  source_type: string;
  source_ref: string | null;
  image_path: string | null;
  base_servings: number;
  total_time_min: number | null;
  steps: string;
  tags: string;
  notes: string | null;
  created_at: string;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  position: number;
  raw: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  canonical: string;
  prep: string | null;
  grams: number | null;
  grams_source: string | null;
  fdc_id: number | null;
  optional: number;
}

export type NewRecipe = Omit<Recipe, "id" | "createdAt" | "ingredients"> & {
  ingredients: Omit<Ingredient, "id" | "recipeId">[];
};

export function createRecipe(input: NewRecipe): Recipe {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO recipes
         (id, title, source_type, source_ref, image_path, base_servings,
          total_time_min, steps, tags, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.sourceType,
      input.sourceRef,
      input.imagePath,
      input.baseServings,
      input.totalTimeMin,
      JSON.stringify(input.steps),
      JSON.stringify(input.tags),
      input.notes,
      createdAt,
    );

    const stmt = db.prepare(
      `INSERT INTO ingredients
         (id, recipe_id, position, raw, quantity, unit, item, canonical,
          prep, grams, grams_source, fdc_id, optional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    input.ingredients.forEach((ing, index) => {
      stmt.run(
        randomUUID(),
        id,
        index,
        ing.raw,
        ing.quantity,
        ing.unit,
        ing.item,
        ing.canonical,
        ing.prep,
        ing.grams,
        ing.gramsSource,
        ing.fdcId,
        ing.optional ? 1 : 0,
      );
    });
  });

  insert();
  return getRecipe(id)!;
}

export function getRecipe(id: string): Recipe | null {
  const db = getDb();
  const row = db
    .prepare<[string], RecipeRow>("SELECT * FROM recipes WHERE id = ?")
    .get(id);
  if (!row) return null;

  const ingredients = db
    .prepare<[string], IngredientRow>(
      "SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position ASC",
    )
    .all(id);

  return toRecipe(row, ingredients);
}

export function listRecipes(): Recipe[] {
  const db = getDb();
  const rows = db
    .prepare<[], RecipeRow>("SELECT * FROM recipes ORDER BY created_at DESC")
    .all();
  if (rows.length === 0) return [];

  // One query for all ingredients rather than N+1.
  const ingredients = db
    .prepare<[], IngredientRow>("SELECT * FROM ingredients ORDER BY position ASC")
    .all();

  const byRecipe = new Map<string, IngredientRow[]>();
  for (const ing of ingredients) {
    const list = byRecipe.get(ing.recipe_id);
    if (list) list.push(ing);
    else byRecipe.set(ing.recipe_id, [ing]);
  }

  return rows.map((row) => toRecipe(row, byRecipe.get(row.id) ?? []));
}

export function deleteRecipe(id: string): void {
  getDb().prepare("DELETE FROM recipes WHERE id = ?").run(id);
}

function toRecipe(row: RecipeRow, ingredients: IngredientRow[]): Recipe {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type as SourceType,
    sourceRef: row.source_ref,
    imagePath: row.image_path,
    baseServings: row.base_servings,
    totalTimeMin: row.total_time_min,
    steps: safeArray(row.steps),
    tags: safeArray(row.tags),
    notes: row.notes,
    createdAt: row.created_at,
    ingredients: ingredients.map(toIngredient),
  };
}

function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    position: row.position,
    raw: row.raw,
    quantity: row.quantity,
    unit: row.unit,
    item: row.item,
    canonical: row.canonical,
    prep: row.prep,
    grams: row.grams,
    gramsSource: row.grams_source as Ingredient["gramsSource"],
    fdcId: row.fdc_id,
    optional: row.optional === 1,
  };
}

function safeArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
