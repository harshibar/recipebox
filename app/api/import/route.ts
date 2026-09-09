/** POST /api/import — parse images and/or text into a saved recipe. */

import { NextResponse } from "next/server";

import { ingestRecipe } from "@/lib/ai/ingest";
import { claudeConfigured } from "@/lib/ai/parse";
import { createRecipe } from "@/lib/db/recipes";
import type { SourceType } from "@/lib/domain/types";
import type { ImageInput } from "@/lib/ai/parse";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** Claude's per-image limit; larger images are rejected before the API call. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

export async function POST(request: Request) {
  if (!claudeConfigured()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. See README.md for setup." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const text = (form.get("text") as string | null)?.trim() || undefined;
  const sourceType = (form.get("sourceType") as SourceType | null) ?? "photo";
  const sourceRef = (form.get("sourceRef") as string | null) || null;

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Too many images (max ${MAX_IMAGES}).` },
      { status: 400 },
    );
  }

  const images: ImageInput[] = [];
  for (const file of files) {
    if (!ALLOWED_MEDIA.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type || "unknown"}.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" is over the 5 MB per-image limit.` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({
      data: buffer.toString("base64"),
      mediaType: file.type as ImageInput["mediaType"],
    });
  }

  if (images.length === 0 && !text) {
    return NextResponse.json(
      { error: "Add a photo or paste some recipe text." },
      { status: 400 },
    );
  }

  try {
    const draft = await ingestRecipe({
      images,
      text,
      sourceType,
      sourceRef,
      hint: sourceType === "instagram" ? "This came from an Instagram share." : undefined,
    });

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
      ingredients: draft.ingredients.map(({ nutrients, provider, ...ing }) => ing),
    });

    return NextResponse.json({
      recipe,
      parseConfidence: draft.parseConfidence,
      unresolved: draft.ingredients.filter((i) => !i.nutrients).map((i) => i.item),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
