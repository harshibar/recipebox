/**
 * Recipe ingestion via Claude.
 *
 * One model call does OCR *and* structuring. That is deliberate: classic OCR
 * (what the 2020 Flutter version used) returns a flat string that still needs
 * parsing, and it is markedly worse on handwriting than a vision model that can
 * use recipe context to disambiguate — it reads an ambiguous "1 tsp" correctly
 * because the surrounding lines are a spice list.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { ParsedRecipeSchema, type ParsedRecipe } from "./schema";
import { foodAliases } from "@/lib/nutrition/foods";
import { ALL_UNITS } from "@/lib/domain/units";

const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * The prompt is static so it caches cleanly — the variable part (the image or
 * caption) goes in the user turn, never in the system prompt.
 */
const SYSTEM_PROMPT = `You transcribe recipes into structured data for a personal recipe app.

Sources are messy on purpose: handwritten index cards, photos of cookbook pages,
screenshots of Instagram captions, half-remembered notes. Your job is to get the
structure right so the app can compute macros and build grocery lists.

Rules:

1. TRANSCRIBE, DO NOT INVENT. If a quantity is illegible, set quantity to null
   and say so in notes. A missing value is recoverable; a fabricated one is not.
   Never add ingredients that are not in the source.

2. \`canonical\` is the join key for grocery lists and pantry matching, so it must
   be the generic form: singular, lowercase, no brand, no prep, no adjectives
   that don't change what you buy.
     "1 1/2 cups finely chopped yellow onions" -> canonical "onion"
     "2 tbsp extra-virgin olive oil"           -> canonical "olive oil"
     "3 boneless skinless chicken breasts"     -> canonical "chicken breast"
   Keep the specific wording in \`item\`; only \`canonical\` is generalised.

3. \`unit\` is the unit as written. Do not convert between units — the app does
   that. Preserve the distinction between tablespoon and teaspoon carefully;
   in handwriting, capital T means tablespoon and lowercase t means teaspoon.

4. \`estimatedGrams\` is a fallback for things the app cannot convert, like
   "1 medium zucchini" or "1 bunch cilantro". Give your best estimate of the
   edible mass. For anything with a standard unit (cups, grams, oz), the app
   converts it properly, so an estimate there is unnecessary — but harmless.

5. \`optional\` is true for garnishes, "to taste", and "for serving" items. These
   are excluded from macros and grocery lists, so getting this right keeps
   "salt to taste" from dominating the sodium total.

6. \`servings\` must describe the quantities you transcribed. If the source says
   nothing, estimate from the amounts and note the assumption.

7. Set \`confidence\` to "low" whenever handwriting was genuinely hard to read.
   The app shows the user a review screen and flags low-confidence imports.`;

function referenceBlock(): string {
  const units = ALL_UNITS.map((u) => u.key).join(", ");
  // Nudging canonical names toward the seeded table raises the nutrition
  // hit rate substantially — an unmatched canonical means no macros.
  const known = foodAliases().slice(0, 400).join(", ");
  return `Canonical unit keys the app understands: ${units}.

Canonical food names the app already has nutrition data for — prefer these exact
strings when the ingredient is one of them, otherwise use your own generic name:
${known}`;
}

export interface ImageInput {
  /** Base64-encoded image data, no data: prefix. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export interface ParseOptions {
  images?: ImageInput[];
  /** Caption, pasted text, or an Instagram permalink. */
  text?: string;
  /** Extra context, e.g. "This came from an Instagram reel". */
  hint?: string;
}

/**
 * Parse a recipe from images and/or text.
 *
 * Both inputs go into a single call so that an Instagram share (a link plus a
 * caption screenshot) is read as one recipe rather than two half-recipes.
 */
export async function parseRecipe(options: ParseOptions): Promise<ParsedRecipe> {
  const { images = [], text, hint } = options;

  if (images.length === 0 && !text?.trim()) {
    throw new Error("Nothing to parse: provide an image or some text.");
  }

  const content: Anthropic.ContentBlockParam[] = [];

  for (const image of images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }

  const parts: string[] = [referenceBlock()];
  if (hint) parts.push(`Context: ${hint}`);
  if (text?.trim()) parts.push(`Source text:\n\n${text.trim()}`);
  parts.push(
    images.length > 0
      ? "Transcribe the recipe from the image(s) above into the required structure."
      : "Transcribe the recipe from the text above into the required structure.",
  );
  content.push({ type: "text", text: parts.join("\n\n") });

  // Streamed because images plus a long ingredient list can run past the
  // non-streaming HTTP timeout.
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ParsedRecipeSchema) },
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to transcribe this image.");
  }

  const parsed = extractJson(message);
  if (!parsed) {
    throw new Error("Could not read a recipe from that. Try a clearer photo.");
  }
  return parsed;
}

/** Pull the structured payload out of the response. */
function extractJson(message: Anthropic.Message): ParsedRecipe | null {
  for (const block of message.content) {
    if (block.type !== "text") continue;
    try {
      return ParsedRecipeSchema.parse(JSON.parse(block.text));
    } catch {
      // Fall through to the next block.
    }
  }
  return null;
}
