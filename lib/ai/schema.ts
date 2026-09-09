/**
 * The contract between Claude and the rest of the app.
 *
 * This schema is the whole reason ingestion produces something usable: the
 * model is asked for normalized fields (canonical name, unit, gram estimate),
 * not for a blob of text we'd then have to parse ourselves.
 */

import { z } from "zod";

export const ParsedIngredientSchema = z.object({
  raw: z
    .string()
    .describe("The ingredient line exactly as it appears in the source, verbatim."),
  quantity: z
    .string()
    .nullable()
    .describe('Amount as written, e.g. "1 1/2", "2", "0.5". Null if none given.'),
  unit: z
    .string()
    .nullable()
    .describe(
      'Unit as written, e.g. "cups", "tbsp", "g", "cloves". Null for a bare count like "2 eggs".',
    ),
  item: z
    .string()
    .describe('The food itself, without quantity or prep. e.g. "yellow onion".'),
  canonical: z
    .string()
    .describe(
      'Generic lowercase name for shopping and pantry matching: "yellow onion" -> "onion", ' +
        '"extra virgin olive oil" -> "olive oil", "boneless skinless chicken breast" -> "chicken breast".',
    ),
  prep: z
    .string()
    .nullable()
    .describe('Preparation, e.g. "chopped", "finely diced", "at room temperature". Null if none.'),
  estimatedGrams: z
    .number()
    .nullable()
    .describe(
      "Your best estimate of this ingredient's mass in grams. Used only as a last resort when " +
        "the unit cannot be converted (e.g. '1 medium zucchini'). Null if you cannot estimate.",
    ),
  optional: z
    .boolean()
    .describe(
      'True for garnishes, "to taste" seasonings, and anything the recipe marks optional.',
    ),
});

export const ParsedRecipeSchema = z.object({
  title: z.string().describe("Recipe title. Invent a short descriptive one if the source has none."),
  servings: z
    .number()
    .describe("Number of servings the ingredient quantities produce. Estimate if not stated."),
  totalTimeMin: z.number().nullable().describe("Total time in minutes, or null if not stated."),
  ingredients: z.array(ParsedIngredientSchema),
  steps: z.array(z.string()).describe("Method steps in order. Empty array if the source has none."),
  tags: z
    .array(z.string())
    .describe('Short lowercase tags, e.g. ["dinner", "vegetarian", "one-pot"].'),
  notes: z
    .string()
    .nullable()
    .describe(
      "Anything that did not fit the fields above, plus any part of the source you could not read.",
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "How confident you are in this transcription. Use 'low' for hard-to-read handwriting.",
    ),
});

export type ParsedIngredient = z.infer<typeof ParsedIngredientSchema>;
export type ParsedRecipe = z.infer<typeof ParsedRecipeSchema>;
