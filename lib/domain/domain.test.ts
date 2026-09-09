import { describe, expect, it } from "vitest";

import { normalizeUnit, massToGrams, volumeToMl, unitKind, unitLabel } from "./units";
import { parseQuantity, formatQuantity } from "./quantity";
import { resolveGrams, weakestSource } from "./grams";
import {
  computeRecipeMacros,
  nutrientsForGrams,
  scaleRecipe,
  addNutrients,
} from "./macros";
import type { Ingredient, Nutrients } from "./types";
import { lookupFood } from "@/lib/nutrition/foods";

describe("normalizeUnit", () => {
  it("collapses spelling and pluralisation variants", () => {
    for (const input of ["tbsp", "Tablespoons", "tbs", "TBSP.", "tablespoon"]) {
      expect(normalizeUnit(input)).toBe("tbsp");
    }
  });

  it("keeps T and t distinct — a 3x error if collapsed", () => {
    expect(normalizeUnit("T")).toBe("tbsp");
    expect(normalizeUnit("t")).toBe("tsp");
  });

  it("handles punctuation and internal spacing", () => {
    expect(normalizeUnit("fl. oz.")).toBe("floz");
    expect(normalizeUnit("  Cups  ")).toBe("cup");
  });

  it("returns null for things that are not units", () => {
    expect(normalizeUnit("handful")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });
});

describe("unit conversion", () => {
  it("converts mass units to grams", () => {
    expect(massToGrams(1, "kg")).toBe(1000);
    expect(massToGrams(1, "lb")).toBeCloseTo(453.592, 3);
    expect(massToGrams(8, "oz")).toBeCloseTo(226.796, 2);
  });

  it("converts volume units to millilitres", () => {
    expect(volumeToMl(1, "cup")).toBeCloseTo(236.588, 3);
    expect(volumeToMl(3, "tsp")).toBeCloseTo(volumeToMl(1, "tbsp")!, 4);
  });

  it("refuses cross-kind conversion", () => {
    expect(massToGrams(1, "cup")).toBeNull();
    expect(volumeToMl(1, "lb")).toBeNull();
    expect(unitKind("clove")).toBe("count");
  });
});

describe("parseQuantity", () => {
  it("parses mixed numbers, fractions and decimals", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("3/4")).toBe(0.75);
    expect(parseQuantity("0.25")).toBe(0.25);
    expect(parseQuantity("2")).toBe(2);
  });

  it("expands vulgar fraction glyphs", () => {
    expect(parseQuantity("½")).toBe(0.5);
    expect(parseQuantity("1½")).toBe(1.5);
    expect(parseQuantity("⅔")).toBeCloseTo(2 / 3, 5);
  });

  it("takes the midpoint of a range", () => {
    expect(parseQuantity("1-2")).toBe(1.5);
    expect(parseQuantity("2 to 4")).toBe(3);
  });

  it("returns null for unparseable input", () => {
    expect(parseQuantity("a pinch")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });

  it("does not divide by zero", () => {
    expect(parseQuantity("1/0")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("renders kitchen-friendly fractions", () => {
    expect(formatQuantity(1.5)).toBe("1½");
    expect(formatQuantity(0.75)).toBe("¾");
    expect(formatQuantity(2)).toBe("2");
  });

  it("never shows a repeating decimal for a clean fraction", () => {
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(4 / 3)).toBe("1⅓");
  });

  it("round-trips through parseQuantity", () => {
    for (const v of [0.25, 0.5, 0.75, 1.5, 2.25, 3]) {
      expect(parseQuantity(formatQuantity(v))).toBeCloseTo(v, 2);
    }
  });

  it("drops fractions for large amounts", () => {
    expect(formatQuantity(12.4)).toBe("12");
  });
});

describe("resolveGrams — the ladder", () => {
  it("1. prefers explicit mass from the recipe", () => {
    const r = resolveGrams(250, "g", { densityGPerMl: 0.5 });
    expect(r).toEqual({ grams: 250, source: "explicit" });
  });

  it("2. prefers a USDA portion row over a generic density", () => {
    const r = resolveGrams(2, "cup", {
      densityGPerMl: 0.5,
      portions: { cup: 160, "cup, sliced": 110 },
    });
    expect(r?.source).toBe("portion");
    expect(r?.grams).toBe(320);
  });

  it("2b. picks the least-qualified portion row", () => {
    const r = resolveGrams(1, "cup", {
      portions: { "cup, chopped": 160, cup: 125 },
    });
    expect(r?.grams).toBe(125);
  });

  it("3. falls back to density for volume", () => {
    const r = resolveGrams(1, "cup", { densityGPerMl: 0.528 });
    expect(r?.source).toBe("density");
    expect(r?.grams).toBeCloseTo(124.9, 1); // 1 cup flour ~= 125 g
  });

  it("4. uses per-count mass for counts, never volume", () => {
    const clove = resolveGrams(3, "clove", { gramsPerCountUnit: { clove: 3 } });
    expect(clove?.grams).toBe(9);

    const eggs = resolveGrams(2, null, { gramsPerItem: 50 });
    expect(eggs?.grams).toBe(100);
  });

  it("marks a guessed density as an estimate, not a measurement", () => {
    const r = resolveGrams(1, "cup", {});
    expect(r?.source).toBe("estimate");
  });

  it("uses the model estimate when nothing else resolves", () => {
    const r = resolveGrams(1, null, { estimatedGrams: 196 });
    expect(r).toEqual({ grams: 196, source: "estimate" });
  });

  it("returns null when there is nothing to go on", () => {
    expect(resolveGrams(null, null, {})).toBeNull();
    expect(resolveGrams(1, "bunch", {})).toBeNull();
  });

  it("reports the weakest source across a recipe", () => {
    expect(weakestSource(["explicit", "density", "estimate"])).toBe("estimate");
    expect(weakestSource(["explicit", "portion"])).toBe("explicit");
    expect(weakestSource([null, null])).toBeNull();
  });
});

// --- macro fixtures --------------------------------------------------------

function ing(over: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    recipeId: "r1",
    position: 0,
    raw: "",
    quantity: 1,
    unit: null,
    item: over.id,
    canonical: over.id,
    prep: null,
    grams: 100,
    gramsSource: "explicit",
    fdcId: null,
    optional: false,
    ...over,
  };
}

const CHICKEN: Nutrients = { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, sodium: 45 };
const OIL: Nutrients = { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, sodium: 2 };

describe("macros", () => {
  it("scales a per-100g panel to an arbitrary mass", () => {
    const half = nutrientsForGrams(CHICKEN, 50);
    expect(half.kcal).toBe(60);
    expect(half.protein).toBeCloseTo(11.25, 4);
  });

  it("sums ingredients and divides by base servings", () => {
    const recipe = {
      baseServings: 2,
      ingredients: [
        ing({ id: "chicken", grams: 400 }),
        ing({ id: "oil", grams: 14 }),
      ],
    };
    const m = computeRecipeMacros(recipe, { chicken: CHICKEN, oil: OIL });

    // 400g chicken = 480 kcal; 14g oil = 123.76 kcal
    expect(m.total.kcal).toBeCloseTo(603.76, 2);
    expect(m.perServing.kcal).toBeCloseTo(301.88, 2);
    expect(m.perServing.protein).toBeCloseTo(45, 4);
  });

  it("excludes optional ingredients from the total", () => {
    const recipe = {
      baseServings: 1,
      ingredients: [
        ing({ id: "chicken", grams: 100 }),
        ing({ id: "oil", grams: 100, optional: true }),
      ],
    };
    const m = computeRecipeMacros(recipe, { chicken: CHICKEN, oil: OIL });
    expect(m.total.kcal).toBe(120);
    expect(m.unresolvedLabels).toEqual([]);
  });

  it("reports unmatched ingredients instead of silently counting them as zero", () => {
    const recipe = {
      baseServings: 1,
      ingredients: [
        ing({ id: "chicken", grams: 100 }),
        ing({ id: "mystery", item: "grandma's spice mix", grams: 20 }),
      ],
    };
    const m = computeRecipeMacros(recipe, { chicken: CHICKEN });

    expect(m.unresolvedLabels).toEqual(["grandma's spice mix"]);
    expect(m.coverage).toBeCloseTo(100 / 120, 4);
    expect(m.total.kcal).toBe(120);
  });

  it("surfaces the weakest confidence in the recipe", () => {
    const recipe = {
      baseServings: 1,
      ingredients: [
        ing({ id: "chicken", grams: 100, gramsSource: "explicit" }),
        ing({ id: "oil", grams: 10, gramsSource: "estimate" }),
      ],
    };
    const m = computeRecipeMacros(recipe, { chicken: CHICKEN, oil: OIL });
    expect(m.confidence).toBe("estimate");
  });

  it("does not divide by zero on a malformed serving count", () => {
    const recipe = { baseServings: 0, ingredients: [ing({ id: "chicken", grams: 100 })] };
    const m = computeRecipeMacros(recipe, { chicken: CHICKEN });
    expect(Number.isFinite(m.perServing.kcal)).toBe(true);
    expect(m.perServing.kcal).toBe(120);
  });
});

describe("scaleRecipe", () => {
  const recipe = {
    baseServings: 4,
    ingredients: [
      ing({ id: "flour", quantity: 2, unit: "cup", grams: 250 }),
      ing({ id: "egg", quantity: 3, unit: null, grams: 150 }),
    ],
  };

  it("scales quantities and grams by the serving factor", () => {
    const doubled = scaleRecipe(recipe, 8);
    expect(doubled.baseServings).toBe(8);
    expect(doubled.ingredients[0].quantity).toBe(4);
    expect(doubled.ingredients[0].grams).toBe(500);
    expect(doubled.ingredients[1].quantity).toBe(6);
  });

  it("halves cleanly", () => {
    const half = scaleRecipe(recipe, 2);
    expect(half.ingredients[0].quantity).toBe(1);
    expect(half.ingredients[1].quantity).toBe(1.5);
    expect(formatQuantity(half.ingredients[1].quantity!)).toBe("1½");
  });

  it("keeps per-serving macros invariant under scaling", () => {
    const facts = { flour: OIL, egg: CHICKEN };
    const before = computeRecipeMacros(recipe, facts).perServing;
    const after = computeRecipeMacros(scaleRecipe(recipe, 7), facts).perServing;
    expect(after.kcal).toBeCloseTo(before.kcal, 6);
    expect(after.protein).toBeCloseTo(before.protein, 6);
  });

  it("leaves the raw source line untouched", () => {
    const withRaw = {
      baseServings: 2,
      ingredients: [ing({ id: "flour", raw: "2 cups flour", quantity: 2, unit: "cup" })],
    };
    expect(scaleRecipe(withRaw, 4).ingredients[0].raw).toBe("2 cups flour");
  });
});

describe("seed food table", () => {
  it("resolves foods by canonical name and by alias", () => {
    expect(lookupFood("onion")?.canonical).toBe("onion");
    expect(lookupFood("Yellow Onion")?.canonical).toBe("onion");
    expect(lookupFood("EVOO")?.canonical).toBe("olive oil");
  });

  it("gives 1 cup of flour a believable mass", () => {
    const flour = lookupFood("flour")!;
    const r = resolveGrams(1, "cup", { densityGPerMl: flour.densityGPerMl });
    expect(r!.grams).toBeGreaterThan(115);
    expect(r!.grams).toBeLessThan(135);
  });

  it("has no NaN or negative values anywhere in the table", () => {
    for (const food of [lookupFood("salt")!, lookupFood("butter")!, lookupFood("egg")!]) {
      for (const v of Object.values(food.nutrients)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("adds nutrient panels componentwise", () => {
    const sum = addNutrients(CHICKEN, OIL);
    expect(sum.kcal).toBe(1004);
    expect(sum.fat).toBeCloseTo(102.6, 4);
  });
});

describe("unitLabel", () => {
  it("pluralises spelled-out and count units", () => {
    expect(unitLabel("clove", 4)).toBe("cloves");
    expect(unitLabel("cup", 2)).toBe("cups");
    expect(unitLabel("clove", 1)).toBe("clove");
  });

  it("leaves abbreviations invariant", () => {
    expect(unitLabel("tbsp", 2)).toBe("tbsp");
    expect(unitLabel("g", 250)).toBe("g");
    expect(unitLabel("lb", 1.5)).toBe("lb");
  });

  it("returns empty for a bare count", () => {
    expect(unitLabel(null, 3)).toBe("");
    expect(unitLabel("piece", 2)).toBe("");
  });
});
