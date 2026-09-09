import { notFound } from "next/navigation";

import { RecipeView } from "@/components/RecipeView";
import { getRecipe } from "@/lib/db/recipes";
import { nutrientsForIngredients } from "@/lib/nutrition/resolve";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) notFound();

  // Resolved server-side so the client can rescale without another round trip.
  const nutrientsById = await nutrientsForIngredients(recipe.ingredients);

  return <RecipeView recipe={recipe} nutrientsById={nutrientsById} />;
}
