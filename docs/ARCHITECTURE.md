# recipeBox — Architecture

A rebuild of the 2020 Flutter prototype as a personal recipe app that ingests
messy recipes (handwriting, screenshots, Instagram), computes macros, scales
servings, plans meals, and matches against what's already in the pantry.

---

## 1. The load-bearing idea

Every feature on the list reduces to one thing: **a recipe whose ingredients are
normalized**. Once an ingredient line knows its canonical name, its quantity, and
— critically — **its mass in grams**, the rest is arithmetic:

| Feature | What it needs |
|---|---|
| Macros | grams × per-100g nutrients, summed |
| Serving scaling | multiply grams by `target / base` |
| Grocery list | group by `canonical`, sum grams, convert to shop units |
| Pantry match | set-compare `canonical` against pantry `canonical` |
| Meal plan | pick recipes, then the three above fall out |

So ingestion is not "OCR then store text." Ingestion's job is to produce
normalized ingredients. Everything downstream is cheap if that job is done well
and expensive-to-impossible if it isn't. Photo import and Instagram import are
two doors into the same room.

The corollary: `grams` is the pivot, not `quantity + unit`. "2 cups flour" and
"250 g flour" must become the same kind of thing before macros can be summed.

---

## 2. Domain model

```ts
Recipe {
  id            string
  title         string
  sourceType    'photo' | 'instagram' | 'url' | 'manual'
  sourceRef     string | null      // instagram permalink, original filename
  imagePath     string | null      // the original photo, kept verbatim
  baseServings  number             // what the ingredient quantities describe
  totalTimeMin  number | null
  steps         string[]
  tags          string[]
  notes         string | null
  createdAt     string
  ingredients   Ingredient[]
}

Ingredient {
  id          string
  recipeId    string
  position    number
  raw         string          // "1 1/2 cups chopped yellow onion" — never discarded
  quantity    number | null   // 1.5
  unit        string | null   // 'cup'  (canonical unit key, not free text)
  item        string          // "yellow onion"      — display
  canonical   string          // "onion"             — the join key
  prep        string | null   // "chopped"
  grams       number | null   // 240   — the pivot
  gramsSource 'explicit' | 'portion' | 'density' | 'estimate' | null
  fdcId       number | null   // USDA FoodData Central match
  optional    boolean
}
```

### Why each field earns its place

- **`raw` is never thrown away.** Parsing is probabilistic. When the model
  mis-reads handwriting, the user needs to see what the line actually said.
  It's also what we re-parse against when the pipeline improves.
- **`canonical` is separate from `item`.** "yellow onion", "red onion", and
  "1 large onion, diced" all shop and match as `onion`. Display keeps the
  specificity; joins need the generality. Collapsing these into one field
  breaks either the grocery list or the recipe display.
- **`gramsSource` records how confident we are.** `explicit` (the recipe said
  grams) is trustworthy; `estimate` (the model guessed) is not. The UI dims
  macros derived mostly from estimates rather than presenting a fake-precise
  number. This is the difference between a tool you trust and one you stop using.
- **`optional`** keeps "salt to taste" and garnishes out of the grocery list and
  out of the pantry-match denominator.

### Later-phase entities

```ts
PantryItem   { id, canonical, label, quantity?, unit?, grams?, updatedAt }
MealPlan     { id, weekStart, entries: MealPlanEntry[] }
MealPlanEntry{ id, planId, date, slot: 'breakfast'|'lunch'|'dinner'|'snack',
               recipeId, servings }
GroceryItem  { canonical, label, grams, displayQty, aisle, haveInPantry }
```

Grocery lists are **derived, not stored** — a stored list drifts from the plan
the moment a meal changes. Compute from the plan; persist only manual additions
and check-off state.

---

## 3. Pipelines

### 3.1 Ingestion

```
photo / screenshot ─┐
instagram caption ──┼─► Claude Opus 5 (vision + text)
pasted text ────────┘        │  structured outputs, Zod schema
                             ▼
                    RecipeDraft (quantity, unit, item, canonical, prep)
                             │
                             ▼
                    gram resolution (§3.2)
                             │
                             ▼
                    user review screen ──► saved Recipe
```

One model call does OCR *and* structuring. That's deliberate: classic OCR
(the old app's `firebase_ml_vision`) returns a flat string that still needs
parsing, and it is markedly worse on handwriting than a vision model that can
use recipe context to disambiguate — it reads "1 tsp" where the strokes are
ambiguous because the neighbouring lines are a spice list.

**A review screen is mandatory, not a nicety.** The model will misread
handwriting sometimes. Silent errors propagate into macros, groceries, and the
meal plan. Cheap correction at import beats expensive distrust later.

### 3.2 Gram resolution — the ladder

Tried in order, first hit wins, and the winner is recorded in `gramsSource`:

1. **explicit** — the recipe already gave mass ("250 g flour"). Convert and done.
2. **portion** — USDA FoodData Central publishes a `foodPortions` table per
   food: "1 cup, chopped → 160 g". This is the good path for volume→mass, and
   it's why USDA beats a generic density table: it's per-food *and* per-prep.
3. **density** — a built-in table (flour 0.53 g/ml, water 1.0, oil 0.92, …) for
   foods USDA didn't match or that lack a portion row.
4. **estimate** — the model's own gram guess for counts with no standard mass
   ("1 medium zucchini"). Marked as low confidence.

Count units ("2 eggs", "3 cloves garlic") skip volume conversion entirely and go
straight to a per-item mass table.

### 3.3 Macros

```
per-ingredient:  grams / 100 × nutrientsPer100g
per-recipe:      Σ ingredients (excluding optional)
per-serving:     recipeTotal / baseServings
scaled:          per-serving × targetServings
```

Serving scaling multiplies **grams**, then re-renders display quantities as
kitchen-friendly fractions (1.5 → "1½", 0.33 cup → "⅓ cup"). Scaling the
display string directly is how you end up with "1.3333333 cups".

### 3.4 Pantry match (phase 3)

Score each recipe against the pantry:

```
required = ingredients where !optional
have     = required ∩ pantry (by canonical)
score    = |have| / |required|,  weighted so a missing staple (salt, oil)
                                 costs far less than a missing protein
```

Surface as "you have 7 of 9 — missing scallions, sesame oil", ranked by score
then by fewest missing. The weighting matters: unweighted, every recipe is
blocked by pepper.

---

## 4. Stack

| Concern | Choice | Why |
|---|---|---|
| App | Next.js 15 (App Router), TypeScript | One codebase for UI + API routes; installable PWA |
| UI | Tailwind | No design system to maintain on a personal app |
| DB | SQLite (`better-sqlite3`) | Single-user app; zero-ops; real SQL |
| Parsing | `claude-opus-5`, structured outputs | Vision + structuring in one call |
| Nutrition | USDA FoodData Central | Free, public-domain, has the portion tables |
| Tests | Vitest | The domain math is pure and worth testing |

### Deploy tradeoff (know this before you host it)

`better-sqlite3` needs a real filesystem. It runs fine locally and on any
persistent host (Fly, Railway, a Pi), but **not on Vercel's serverless
functions**, where the filesystem is ephemeral. All DB access is behind
`lib/db/*` so swapping to libSQL/Turso or Postgres is a single-module change if
you later want serverless hosting.

### Instagram, honestly

There is no API that returns someone else's reel. What works is the OS share
sheet: on the reel, Share → recipeBox.

- **Android:** PWAs are real share targets via the Web Share Target API. Declared
  in `manifest.json`; shares POST to `/api/share`. This works today.
- **iOS:** Safari does not support share targets. Two options: an iOS Shortcut
  that POSTs to the app, or wrapping in Capacitor for a native share extension.

What actually arrives is usually **just the permalink**, sometimes the caption.
The recipe text lives in the caption or burned into the video, neither of which
a link fetch reliably yields. So the import flow accepts link *and* screenshots
together and parses them as one unit. This is a real limitation of the platform,
not something to paper over in the UI.

---

## 5. Build order

- **Phase 1 — core (this pass).** Schema, gram ladder, macro math, scaling,
  Claude ingestion (photo + text/caption), USDA client with offline fallback,
  import → review → recipe detail with a live serving scaler.
- **Phase 2 — pantry.** Pantry CRUD, weighted match scoring, "cook from what I
  have" ranking. Cheap once §2 exists.
- **Phase 3 — planning.** Week grid, drag recipes into slots, derived grocery
  list grouped by aisle with pantry subtraction.
- **Phase 4 — sharing.** Android share target end-to-end; iOS Shortcut; optional
  Capacitor wrap.

## 6. Testing note

The domain layer (`lib/domain/*`) is pure and fully unit-tested — conversions,
the gram ladder, scaling, macro aggregation. The two network edges (Claude,
USDA) are isolated behind adapters so the math can be verified without keys or
network, which is also what makes the app usable offline with the seeded food
table.
