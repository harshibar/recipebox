"use client";

import { useMemo, useState } from "react";

import { computeRecipeMacros } from "@/lib/domain/macros";
import { formatQuantity } from "@/lib/domain/quantity";
import { unitLabel } from "@/lib/domain/units";
import type { Ingredient, Nutrients, Recipe } from "@/lib/domain/types";
import { MacroPanel } from "./MacroPanel";

/**
 * Recipe detail with a live serving scaler.
 *
 * Scaling recomputes from `grams`, never from the display string — that is why
 * halving a recipe gives "1½ tsp" instead of "1.4999999 tsp".
 */
export function RecipeView({
  recipe,
  nutrientsById,
}: {
  recipe: Recipe;
  nutrientsById: Record<string, Nutrients | undefined>;
}) {
  const [servings, setServings] = useState(recipe.baseServings);

  const factor = recipe.baseServings > 0 ? servings / recipe.baseServings : 1;

  const macros = useMemo(
    () => computeRecipeMacros(recipe, nutrientsById),
    [recipe, nutrientsById],
  );

  // Per-serving macros are invariant under scaling, so the panel only needs
  // the total multiplied by the new serving count.
  const shown = useMemo(
    () => ({
      kcal: macros.perServing.kcal,
      protein: macros.perServing.protein,
      carbs: macros.perServing.carbs,
      fat: macros.perServing.fat,
      fiber: macros.perServing.fiber,
      sugar: macros.perServing.sugar,
      sodium: macros.perServing.sodium,
    }),
    [macros],
  );

  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
        <p className="mt-1 text-sm text-black/50">
          {recipe.totalTimeMin ? `${recipe.totalTimeMin} min · ` : ""}
          makes {formatQuantity(recipe.baseServings)} as written
          {recipe.sourceType === "instagram" && recipe.sourceRef ? (
            <>
              {" · "}
              <a
                href={recipe.sourceRef}
                className="underline hover:text-crust"
                target="_blank"
                rel="noreferrer noopener"
              >
                source
              </a>
            </>
          ) : null}
        </p>
        {recipe.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <MacroPanel
        nutrients={shown}
        label="Per serving"
        confidence={macros.confidence}
        unresolved={macros.unresolvedLabels}
        coverage={macros.coverage}
      />

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="servings" className="text-sm font-medium">
            Scale to
          </label>
          <div className="flex items-center gap-3">
            <input
              id="servings"
              type="range"
              min={1}
              max={Math.max(16, recipe.baseServings * 3)}
              step={1}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-40 accent-crust"
            />
            <span className="w-20 text-right text-sm tabular-nums">
              {servings} serving{servings === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {factor !== 1 && (
          <p className="mt-2 text-xs text-black/50">
            Ingredients below are scaled {formatQuantity(factor)}× from the original.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/50">
          Ingredients
        </h2>
        <ul className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
          {recipe.ingredients.map((ing) => (
            <IngredientRow key={ing.id} ingredient={ing} factor={factor} />
          ))}
        </ul>
      </section>

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-black/50">
            Method
          </h2>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-crust/10 text-xs font-semibold text-crust">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-black/50">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm text-black/70">{recipe.notes}</p>
        </section>
      )}
    </article>
  );
}

function IngredientRow({ ingredient, factor }: { ingredient: Ingredient; factor: number }) {
  const quantity = ingredient.quantity == null ? null : ingredient.quantity * factor;
  const unit = unitLabel(ingredient.unit, quantity);
  const grams = ingredient.grams == null ? null : ingredient.grams * factor;

  const amount = [quantity == null ? null : formatQuantity(quantity), unit]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
      <span className="w-24 shrink-0 font-medium tabular-nums">{amount || "—"}</span>
      <span className="flex-1">
        {ingredient.item}
        {ingredient.prep && <span className="text-black/50">, {ingredient.prep}</span>}
        {ingredient.optional && (
          <span className="ml-1.5 text-xs text-black/40">(optional)</span>
        )}
      </span>
      {grams != null && (
        <span
          className="shrink-0 text-xs tabular-nums text-black/40"
          title={
            ingredient.gramsSource === "estimate"
              ? "Estimated weight"
              : "Converted weight"
          }
        >
          {Math.round(grams)} g{ingredient.gramsSource === "estimate" ? "*" : ""}
        </span>
      )}
    </li>
  );
}
