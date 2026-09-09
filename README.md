# 🍝 recipeBox

Store the recipes that don't come with structured data — handwritten cards,
cookbook photos, Instagram screenshots — and get real macros, scalable servings,
meal plans and grocery lists out of them.

A rewrite of the 2020 Flutter prototype (kept in [`legacy/`](legacy/)) as a
Next.js PWA.

---

## The idea

Every feature reduces to one thing: **ingredients that know their weight in
grams**. Once an ingredient line has a canonical name and a mass, macros,
scaling, grocery merging and pantry matching are all arithmetic. So ingestion's
job isn't "OCR the photo" — it's "produce normalized ingredients." Photo import
and Instagram import are two doors into the same room.

The full design, including the gram-resolution ladder and the phase plan, is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What works today

- **Import from photos** — handwriting, cookbook pages, screenshots. Claude
  Opus 5 does OCR and structuring in one call, returning normalized ingredients
  rather than a wall of text.
- **Import from text or an Instagram caption** — paste it, or share to the app
  on Android (see below).
- **Macros** — per ingredient, per recipe, per serving, from USDA FoodData
  Central with a seeded local table as fallback.
- **Serving scaler** — drag to rescale; quantities re-render as kitchen
  fractions (`1½ cups`, not `1.4999 cups`) and per-serving macros stay put.
- **Honest confidence** — every weight records how it was derived, and the UI
  says when a number leans on estimates or when an ingredient had no match.

Phases 2–4 (pantry matching, meal plan + grocery list, native share) are
specified in the architecture doc and not yet built.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your keys
npm run dev
```

| Variable | Required | What for |
|---|---|---|
| `ANTHROPIC_API_KEY` | for importing | Recipe transcription. [console.anthropic.com](https://console.anthropic.com) |
| `USDA_API_KEY` | optional | Better nutrition + per-food portion tables. [Free key](https://fdc.nal.usda.gov/api-key-signup.html) |
| `RECIPEBOX_DATA_DIR` | optional | Where the SQLite file lives. Defaults to `./data`. |

Without `USDA_API_KEY` the app falls back to a seeded table of ~75 common foods,
so macros still work offline. Without `ANTHROPIC_API_KEY` you can browse saved
recipes but not import new ones.

Try it without any keys at all:

```bash
npx tsx scripts/seed.ts   # inserts a sample recipe, prints the gram ladder
npm run dev
```

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm test           # domain unit tests
npm run typecheck  # tsc --noEmit
```

## Sharing from Instagram — how it actually works

There's no API that returns someone else's reel, so the app uses the OS share
sheet instead. On the reel: **Share → recipeBox**.

- **Android** — works today. The PWA declares a Web Share Target in
  `public/manifest.json`; shares POST to `/api/share`. Install to home screen
  first.
- **iOS** — Safari doesn't support share targets. Use an iOS Shortcut that POSTs
  to `/api/share`, or wrap the app with Capacitor for a native share extension.

What a share actually delivers is usually **just the permalink** — the recipe
lives in the caption or the video. So the import screen takes a link *and*
screenshots together and parses them as one recipe. That's a platform
limitation, not something the UI pretends away.

## Deploying

`better-sqlite3` needs a persistent filesystem, so this runs on Fly, Railway, a
Raspberry Pi, or your laptop — **not** on Vercel's serverless functions, where
the filesystem is ephemeral. All database access is behind `lib/db/*`, so
swapping to libSQL/Turso or Postgres is a one-module change.

## Layout

```
app/            routes and API handlers
components/     React components
lib/domain/     units, quantities, gram ladder, macro math  (pure, tested)
lib/nutrition/  USDA client, seeded food table, resolution
lib/ai/         Claude parsing schema and ingestion pipeline
lib/db/         SQLite schema and queries
docs/           architecture and schema design
legacy/         the original 2020 Flutter app
scripts/seed.ts sample recipe, no API key needed
```

The domain layer is pure and fully unit-tested; the two network edges (Claude,
USDA) sit behind adapters so the math can be verified without keys or network.
