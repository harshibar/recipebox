/**
 * POST /api/share — Android Web Share Target endpoint.
 *
 * On Android, sharing an Instagram reel to the installed PWA lands here. What
 * actually arrives is usually just the permalink (see docs/ARCHITECTURE.md §4),
 * so this hands off to the import screen with whatever it got rather than
 * pretending it can fetch the recipe from a link alone.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);

  const parts = ["title", "text", "url"]
    .map((key) => (form?.get(key) as string | null)?.trim())
    .filter((v): v is string => Boolean(v));

  const shared = parts.join("\n");
  const target = new URL("/import", request.url);
  if (shared) target.searchParams.set("shared", shared);
  target.searchParams.set("source", "instagram");

  // 303 so the browser follows with GET rather than replaying the POST.
  return NextResponse.redirect(target, 303);
}
