import Link from "next/link";

import { listRecipes } from "@/lib/db/recipes";
import { formatQuantity } from "@/lib/domain/quantity";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const recipes = listRecipes();

  if (recipes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 bg-white/50 p-10 text-center">
        <h1 className="text-lg font-semibold">No recipes yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-black/60">
          Photograph a handwritten card, paste an Instagram caption, or type one
          in. Everything gets normalized into ingredients with real weights, so
          macros and grocery lists come for free.
        </p>
        <Link
          href="/import"
          className="mt-5 inline-block rounded-full bg-crust px-4 py-2 text-sm font-medium text-white hover:bg-crust/90"
        >
          Add your first recipe
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">
        {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
      </h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <Link
              href={`/recipes/${recipe.id}`}
              className="block rounded-xl border border-black/10 bg-white p-4 transition hover:border-crust/40 hover:shadow-sm"
            >
              <h2 className="font-medium">{recipe.title}</h2>
              <p className="mt-1 text-xs text-black/50">
                {recipe.ingredients.length} ingredients · makes{" "}
                {formatQuantity(recipe.baseServings)}
                {recipe.totalTimeMin ? ` · ${recipe.totalTimeMin} min` : ""}
              </p>
              {recipe.tags.length > 0 && (
                <p className="mt-2 text-xs text-black/40">
                  {recipe.tags.slice(0, 4).join(" · ")}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
