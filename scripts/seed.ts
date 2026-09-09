/**
 * Seeds a sample recipe without calling Claude.
 *
 * Exercises the real path from a parsed recipe through normalization, the gram
 * ladder, nutrition lookup, and persistence — so the pipeline can be verified
 * without an API key.
 *
 * Run: npx tsx scripts/seed.ts
 */

import { buildDraft } from "@/lib/ai/ingest";
import { createRecipe } from "@/lib/db/recipes";
import { computeRecipeMacros, roundNutrients } from "@/lib/domain/macros";
import { nutrientsForIngredients } from "@/lib/nutrition/resolve";
import type { ParsedRecipe } from "@/lib/ai/schema";

const SAMPLE: ParsedRecipe = {
  title: "Weeknight Garlic Chicken & Rice",
  servings: 4,
  totalTimeMin: 35,
  confidence: "high",
  notes: "Handwritten card, back of an envelope.",
  tags: ["dinner", "one-pot"],
  steps: [
    "Season the chicken and sear in the olive oil over medium-high heat, 4 minutes a side.",
    "Add the onion and garlic; cook until soft, about 5 minutes.",
    "Stir in the rice, then the stock. Cover and simmer 18 minutes.",
    "Finish with the butter and scallions off the heat.",
  ],
  ingredients: [
    { raw: "2 tbsp olive oil", quantity: "2", unit: "tbsp", item: "olive oil", canonical: "olive oil", prep: null, estimatedGrams: null, optional: false },
    { raw: "1 1/2 lb boneless skinless chicken breast", quantity: "1 1/2", unit: "lb", item: "chicken breast", canonical: "chicken breast", prep: null, estimatedGrams: null, optional: false },
    { raw: "1 large yellow onion, finely diced", quantity: "1", unit: null, item: "yellow onion", canonical: "onion", prep: "finely diced", estimatedGrams: 150, optional: false },
    { raw: "4 cloves garlic, minced", quantity: "4", unit: "cloves", item: "garlic", canonical: "garlic", prep: "minced", estimatedGrams: 12, optional: false },
    { raw: "1 1/2 cups jasmine rice", quantity: "1 1/2", unit: "cups", item: "jasmine rice", canonical: "rice", prep: null, estimatedGrams: null, optional: false },
    { raw: "2 tbsp butter", quantity: "2", unit: "tbsp", item: "butter", canonical: "butter", prep: null, estimatedGrams: null, optional: false },
    { raw: "3 scallions, sliced", quantity: "3", unit: null, item: "scallion", canonical: "scallion", prep: "sliced", estimatedGrams: 45, optional: true },
    { raw: "salt and pepper to taste", quantity: null, unit: null, item: "salt and pepper", canonical: "salt", prep: null, estimatedGrams: 4, optional: true },
  ],
};

async function main() {
  const draft = await buildDraft(SAMPLE, { sourceType: "photo", sourceRef: null, imagePath: null });

  console.log(`\n${draft.title}  (serves ${draft.baseServings})\n`);
  console.log("  gram resolution");
  console.log("  " + "-".repeat(62));
  for (const ing of draft.ingredients) {
    const grams = ing.grams == null ? "  —  " : `${Math.round(ing.grams)} g`.padStart(6);
    const src = (ing.gramsSource ?? "none").padEnd(9);
    const food = ing.provider ? ing.provider.padEnd(6) : "MISS  ";
    console.log(`  ${grams}  ${src} ${food} ${ing.raw}`);
  }

  const recipe = createRecipe({
    title: draft.title,
    sourceType: draft.sourceType,
    sourceRef: draft.sourceRef,
    imagePath: draft.imagePath,
    baseServings: draft.baseServings,
    totalTimeMin: draft.totalTimeMin,
    steps: draft.steps,
    tags: draft.tags,
    notes: draft.notes,
    ingredients: draft.ingredients.map(({ nutrients, provider, ...rest }) => rest),
  });

  const facts = await nutrientsForIngredients(recipe.ingredients);
  const macros = computeRecipeMacros(recipe, facts);

  const per = roundNutrients(macros.perServing);
  console.log("\n  per serving");
  console.log("  " + "-".repeat(62));
  console.log(`  ${per.kcal} kcal · ${per.protein} g protein · ${per.carbs} g carbs · ${per.fat} g fat`);
  console.log(`  ${per.fiber} g fiber · ${per.sugar} g sugar · ${per.sodium} mg sodium`);
  console.log(`\n  confidence: ${macros.confidence}`);
  console.log(`  coverage:   ${Math.round(macros.coverage * 100)}% of mass`);
  console.log(`  unresolved: ${macros.unresolvedLabels.join(", ") || "none"}`);
  console.log(`\n  saved as ${recipe.id}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
