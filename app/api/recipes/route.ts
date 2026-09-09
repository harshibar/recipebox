/** GET /api/recipes — list all saved recipes. */

import { NextResponse } from "next/server";
import { listRecipes } from "@/lib/db/recipes";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ recipes: listRecipes() });
}
