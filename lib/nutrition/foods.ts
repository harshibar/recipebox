/**
 * Seeded food table.
 *
 * Two jobs. First, it lets the app compute macros with no USDA key and no
 * network — a personal app that breaks without an API key is a personal app you
 * stop opening. Second, it makes the macro math testable, since USDA lookups
 * can't run in CI.
 *
 * Nutrients are per 100 g, raw unless noted, sourced from USDA SR Legacy /
 * FoodData Central Foundation Foods. When a USDA lookup succeeds at runtime it
 * takes precedence over this table (see lib/nutrition/resolve.ts).
 */

import type { Nutrients } from "@/lib/domain/types";

export interface FoodEntry {
  canonical: string;
  label: string;
  /** Per 100 g. */
  nutrients: Nutrients;
  /** Grams per millilitre, for volume -> mass. */
  densityGPerMl: number | null;
  /** Grams for one unqualified item ("1 onion"). */
  gramsPerItem: number | null;
  /** Grams for specific count units ("1 clove", "1 slice"). */
  gramsPerCountUnit?: Record<string, number>;
  aisle: string;
  /** Extra strings that should resolve to this canonical name. */
  aliases?: string[];
}

/** Terse constructor so the table stays readable. */
function n(
  kcal: number, protein: number, carbs: number, fat: number,
  fiber = 0, sugar = 0, sodium = 0,
): Nutrients {
  return { kcal, protein, carbs, fat, fiber, sugar, sodium };
}

export const FOODS: FoodEntry[] = [
  // ---- produce ----------------------------------------------------------
  { canonical: "onion", label: "Onion", nutrients: n(40, 1.1, 9.3, 0.1, 1.7, 4.2, 4), densityGPerMl: 0.676, gramsPerItem: 110, aisle: "Produce", aliases: ["yellow onion", "red onion", "white onion", "sweet onion"] },
  { canonical: "garlic", label: "Garlic", nutrients: n(149, 6.4, 33.1, 0.5, 2.1, 1.0, 17), densityGPerMl: 0.567, gramsPerItem: 45, gramsPerCountUnit: { clove: 3, head: 45 }, aisle: "Produce" },
  { canonical: "tomato", label: "Tomato", nutrients: n(18, 0.88, 3.9, 0.2, 1.2, 2.6, 5), densityGPerMl: 0.76, gramsPerItem: 123, aisle: "Produce", aliases: ["roma tomato", "cherry tomato", "plum tomato"] },
  { canonical: "potato", label: "Potato", nutrients: n(77, 2.0, 17.5, 0.09, 2.2, 0.8, 6), densityGPerMl: 0.63, gramsPerItem: 173, aisle: "Produce", aliases: ["russet potato", "yukon gold potato"] },
  { canonical: "sweet potato", label: "Sweet potato", nutrients: n(86, 1.6, 20.1, 0.05, 3.0, 4.2, 55), densityGPerMl: 0.6, gramsPerItem: 130, aisle: "Produce" },
  { canonical: "carrot", label: "Carrot", nutrients: n(41, 0.93, 9.6, 0.24, 2.8, 4.7, 69), densityGPerMl: 0.54, gramsPerItem: 61, aisle: "Produce" },
  { canonical: "bell pepper", label: "Bell pepper", nutrients: n(31, 1.0, 6.0, 0.3, 2.1, 4.2, 4), densityGPerMl: 0.63, gramsPerItem: 119, aisle: "Produce", aliases: ["red pepper", "green pepper", "capsicum"] },
  { canonical: "spinach", label: "Spinach", nutrients: n(23, 2.9, 3.6, 0.4, 2.2, 0.4, 79), densityGPerMl: 0.127, gramsPerItem: null, aisle: "Produce" },
  { canonical: "broccoli", label: "Broccoli", nutrients: n(34, 2.8, 6.6, 0.37, 2.6, 1.7, 33), densityGPerMl: 0.385, gramsPerItem: 148, aisle: "Produce", gramsPerCountUnit: { head: 548 } },
  { canonical: "mushroom", label: "Mushroom", nutrients: n(22, 3.1, 3.3, 0.34, 1.0, 2.0, 5), densityGPerMl: 0.296, gramsPerItem: 18, aisle: "Produce" },
  { canonical: "zucchini", label: "Zucchini", nutrients: n(17, 1.2, 3.1, 0.32, 1.0, 2.5, 8), densityGPerMl: 0.5, gramsPerItem: 196, aisle: "Produce", aliases: ["courgette"] },
  { canonical: "cucumber", label: "Cucumber", nutrients: n(15, 0.65, 3.6, 0.11, 0.5, 1.7, 2), densityGPerMl: 0.5, gramsPerItem: 300, aisle: "Produce" },
  { canonical: "celery", label: "Celery", nutrients: n(16, 0.69, 3.0, 0.17, 1.6, 1.3, 80), densityGPerMl: 0.427, gramsPerItem: 40, gramsPerCountUnit: { stalk: 40 }, aisle: "Produce" },
  { canonical: "cabbage", label: "Cabbage", nutrients: n(25, 1.3, 5.8, 0.1, 2.5, 3.2, 18), densityGPerMl: 0.38, gramsPerItem: 908, aisle: "Produce" },
  { canonical: "scallion", label: "Scallion", nutrients: n(32, 1.8, 7.3, 0.19, 2.6, 2.3, 16), densityGPerMl: 0.42, gramsPerItem: 15, aisle: "Produce", aliases: ["green onion", "spring onion"] },
  { canonical: "ginger", label: "Ginger", nutrients: n(80, 1.8, 17.8, 0.75, 2.0, 1.7, 13), densityGPerMl: 0.4, gramsPerItem: 30, aisle: "Produce" },
  { canonical: "cilantro", label: "Cilantro", nutrients: n(23, 2.1, 3.7, 0.52, 2.8, 0.9, 46), densityGPerMl: 0.06, gramsPerItem: null, gramsPerCountUnit: { bunch: 45 }, aisle: "Produce", aliases: ["coriander leaf", "fresh coriander"] },
  { canonical: "lemon", label: "Lemon", nutrients: n(29, 1.1, 9.3, 0.3, 2.8, 2.5, 2), densityGPerMl: 1.03, gramsPerItem: 84, aisle: "Produce" },
  { canonical: "lime", label: "Lime", nutrients: n(30, 0.7, 10.5, 0.2, 2.8, 1.7, 2), densityGPerMl: 1.03, gramsPerItem: 67, aisle: "Produce" },
  { canonical: "avocado", label: "Avocado", nutrients: n(160, 2.0, 8.5, 14.7, 6.7, 0.7, 7), densityGPerMl: 0.6, gramsPerItem: 150, aisle: "Produce" },
  { canonical: "banana", label: "Banana", nutrients: n(89, 1.1, 22.8, 0.33, 2.6, 12.2, 1), densityGPerMl: 0.6, gramsPerItem: 118, aisle: "Produce" },
  { canonical: "apple", label: "Apple", nutrients: n(52, 0.26, 13.8, 0.17, 2.4, 10.4, 1), densityGPerMl: 0.53, gramsPerItem: 182, aisle: "Produce" },
  { canonical: "corn", label: "Corn", nutrients: n(86, 3.3, 19.0, 1.35, 2.0, 3.2, 15), densityGPerMl: 0.66, gramsPerItem: 90, aisle: "Produce" },
  { canonical: "peas", label: "Peas", nutrients: n(81, 5.4, 14.5, 0.4, 5.7, 5.7, 5), densityGPerMl: 0.58, gramsPerItem: null, aisle: "Produce" },
  { canonical: "green beans", label: "Green beans", nutrients: n(31, 1.8, 7.0, 0.22, 3.4, 3.3, 6), densityGPerMl: 0.4, gramsPerItem: null, aisle: "Produce" },

  // ---- protein ----------------------------------------------------------
  { canonical: "chicken breast", label: "Chicken breast", nutrients: n(120, 22.5, 0, 2.6, 0, 0, 45), densityGPerMl: null, gramsPerItem: 174, aisle: "Meat & Seafood", aliases: ["boneless skinless chicken breast"] },
  { canonical: "chicken thigh", label: "Chicken thigh", nutrients: n(209, 17.9, 0, 14.9, 0, 0, 84), densityGPerMl: null, gramsPerItem: 82, aisle: "Meat & Seafood" },
  { canonical: "ground beef", label: "Ground beef (85/15)", nutrients: n(250, 26.0, 0, 17.0, 0, 0, 66), densityGPerMl: null, gramsPerItem: null, aisle: "Meat & Seafood", aliases: ["ground chuck", "minced beef"] },
  { canonical: "salmon", label: "Salmon", nutrients: n(208, 20.4, 0, 13.4, 0, 0, 59), densityGPerMl: null, gramsPerItem: 170, gramsPerCountUnit: { piece: 170 }, aisle: "Meat & Seafood" },
  { canonical: "shrimp", label: "Shrimp", nutrients: n(85, 20.1, 0.2, 0.5, 0, 0, 119), densityGPerMl: null, gramsPerItem: 15, aisle: "Meat & Seafood", aliases: ["prawn"] },
  { canonical: "egg", label: "Egg", nutrients: n(143, 12.6, 0.72, 9.5, 0, 0.37, 142), densityGPerMl: 1.03, gramsPerItem: 50, aisle: "Dairy & Eggs" },
  { canonical: "tofu", label: "Tofu (firm)", nutrients: n(144, 17.3, 2.8, 8.7, 2.3, 0.6, 14), densityGPerMl: 1.06, gramsPerItem: 400, aisle: "Refrigerated" },
  { canonical: "black beans", label: "Black beans (cooked)", nutrients: n(132, 8.9, 23.7, 0.54, 8.7, 0.3, 1), densityGPerMl: 0.7, gramsPerItem: null, gramsPerCountUnit: { can: 425 }, aisle: "Pantry" },
  { canonical: "chickpeas", label: "Chickpeas (cooked)", nutrients: n(164, 8.9, 27.4, 2.6, 7.6, 4.8, 7), densityGPerMl: 0.7, gramsPerItem: null, gramsPerCountUnit: { can: 425 }, aisle: "Pantry", aliases: ["garbanzo beans"] },

  // ---- dairy ------------------------------------------------------------
  { canonical: "milk", label: "Milk (whole)", nutrients: n(61, 3.2, 4.8, 3.3, 0, 5.1, 43), densityGPerMl: 1.03, gramsPerItem: null, aisle: "Dairy & Eggs" },
  { canonical: "butter", label: "Butter", nutrients: n(717, 0.85, 0.06, 81.1, 0, 0.06, 643), densityGPerMl: 0.96, gramsPerItem: 113, gramsPerCountUnit: { package: 113 }, aisle: "Dairy & Eggs" },
  { canonical: "cheddar cheese", label: "Cheddar cheese", nutrients: n(403, 24.9, 1.3, 33.1, 0, 0.5, 653), densityGPerMl: 0.478, gramsPerItem: null, gramsPerCountUnit: { slice: 28 }, aisle: "Dairy & Eggs" },
  { canonical: "parmesan", label: "Parmesan", nutrients: n(431, 38.5, 4.1, 28.6, 0, 0.9, 1804), densityGPerMl: 0.42, gramsPerItem: null, aisle: "Dairy & Eggs", aliases: ["parmigiano reggiano"] },
  { canonical: "greek yogurt", label: "Greek yogurt (plain)", nutrients: n(59, 10.3, 3.6, 0.4, 0, 3.2, 36), densityGPerMl: 1.03, gramsPerItem: null, aisle: "Dairy & Eggs" },
  { canonical: "heavy cream", label: "Heavy cream", nutrients: n(340, 2.8, 2.8, 36.1, 0, 2.9, 27), densityGPerMl: 0.994, gramsPerItem: null, aisle: "Dairy & Eggs", aliases: ["double cream", "whipping cream"] },
  { canonical: "sour cream", label: "Sour cream", nutrients: n(198, 2.4, 4.6, 19.4, 0, 3.5, 80), densityGPerMl: 1.0, gramsPerItem: null, aisle: "Dairy & Eggs" },
  { canonical: "cream cheese", label: "Cream cheese", nutrients: n(350, 6.2, 5.5, 34.2, 0, 3.8, 314), densityGPerMl: 1.0, gramsPerItem: 226, aisle: "Dairy & Eggs" },

  // ---- pantry staples ---------------------------------------------------
  { canonical: "flour", label: "All-purpose flour", nutrients: n(364, 10.3, 76.3, 0.98, 2.7, 0.27, 2), densityGPerMl: 0.528, gramsPerItem: null, aisle: "Pantry", aliases: ["all purpose flour", "plain flour", "ap flour"] },
  { canonical: "sugar", label: "Granulated sugar", nutrients: n(387, 0, 100, 0, 0, 100, 1), densityGPerMl: 0.845, gramsPerItem: null, aisle: "Pantry", aliases: ["white sugar", "caster sugar"] },
  { canonical: "brown sugar", label: "Brown sugar", nutrients: n(380, 0.12, 98.1, 0, 0, 97.0, 28), densityGPerMl: 0.93, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "rice", label: "White rice (dry)", nutrients: n(365, 7.1, 80.0, 0.66, 1.3, 0.12, 5), densityGPerMl: 0.78, gramsPerItem: null, aisle: "Pantry", aliases: ["jasmine rice", "basmati rice", "long grain rice"] },
  { canonical: "pasta", label: "Pasta (dry)", nutrients: n(371, 13.0, 74.7, 1.5, 3.2, 2.7, 6), densityGPerMl: 0.45, gramsPerItem: null, aisle: "Pantry", aliases: ["spaghetti", "penne", "linguine", "fusilli", "rigatoni"] },
  { canonical: "oats", label: "Rolled oats", nutrients: n(389, 16.9, 66.3, 6.9, 10.6, 0, 2), densityGPerMl: 0.342, gramsPerItem: null, aisle: "Pantry", aliases: ["rolled oats", "old fashioned oats"] },
  { canonical: "bread", label: "Bread", nutrients: n(265, 9.0, 49.0, 3.2, 2.7, 5.0, 491), densityGPerMl: null, gramsPerItem: 28, gramsPerCountUnit: { slice: 28 }, aisle: "Bakery" },
  { canonical: "olive oil", label: "Olive oil", nutrients: n(884, 0, 0, 100, 0, 0, 2), densityGPerMl: 0.913, gramsPerItem: null, aisle: "Pantry", aliases: ["extra virgin olive oil", "evoo"] },
  { canonical: "vegetable oil", label: "Vegetable oil", nutrients: n(884, 0, 0, 100, 0, 0, 0), densityGPerMl: 0.92, gramsPerItem: null, aisle: "Pantry", aliases: ["canola oil", "sunflower oil", "neutral oil"] },
  { canonical: "sesame oil", label: "Sesame oil", nutrients: n(884, 0, 0, 100, 0, 0, 0), densityGPerMl: 0.92, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "soy sauce", label: "Soy sauce", nutrients: n(53, 8.1, 4.9, 0.6, 0.8, 0.4, 5493), densityGPerMl: 1.2, gramsPerItem: null, aisle: "Pantry", aliases: ["shoyu", "tamari"] },
  { canonical: "vinegar", label: "Vinegar", nutrients: n(21, 0, 0.93, 0, 0, 0.4, 5), densityGPerMl: 1.01, gramsPerItem: null, aisle: "Pantry", aliases: ["rice vinegar", "white vinegar", "apple cider vinegar", "balsamic vinegar"] },
  { canonical: "honey", label: "Honey", nutrients: n(304, 0.3, 82.4, 0, 0.2, 82.1, 4), densityGPerMl: 1.42, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "maple syrup", label: "Maple syrup", nutrients: n(260, 0.04, 67.0, 0.06, 0, 60.4, 12), densityGPerMl: 1.32, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "peanut butter", label: "Peanut butter", nutrients: n(588, 25.1, 20.0, 50.4, 6.0, 9.2, 429), densityGPerMl: 1.08, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "almonds", label: "Almonds", nutrients: n(579, 21.2, 21.6, 49.9, 12.5, 4.4, 1), densityGPerMl: 0.6, gramsPerItem: null, aisle: "Pantry" },
  { canonical: "coconut milk", label: "Coconut milk", nutrients: n(230, 2.3, 5.5, 23.8, 2.2, 3.3, 15), densityGPerMl: 1.0, gramsPerItem: null, gramsPerCountUnit: { can: 400 }, aisle: "Pantry" },
  { canonical: "cocoa powder", label: "Cocoa powder", nutrients: n(228, 19.6, 57.9, 13.7, 37.0, 1.8, 21), densityGPerMl: 0.363, gramsPerItem: null, aisle: "Baking" },
  { canonical: "chocolate chips", label: "Chocolate chips", nutrients: n(480, 4.2, 63.9, 24.5, 5.9, 54.5, 11), densityGPerMl: 0.72, gramsPerItem: null, aisle: "Baking" },
  { canonical: "vanilla extract", label: "Vanilla extract", nutrients: n(288, 0.06, 12.7, 0.06, 0, 12.7, 9), densityGPerMl: 0.879, gramsPerItem: null, aisle: "Baking" },
  { canonical: "baking powder", label: "Baking powder", nutrients: n(53, 0, 27.7, 0, 0.2, 0, 10600), densityGPerMl: 0.93, gramsPerItem: null, aisle: "Baking" },
  { canonical: "baking soda", label: "Baking soda", nutrients: n(0, 0, 0, 0, 0, 0, 27360), densityGPerMl: 0.96, gramsPerItem: null, aisle: "Baking" },

  // ---- seasoning --------------------------------------------------------
  { canonical: "salt", label: "Salt", nutrients: n(0, 0, 0, 0, 0, 0, 38758), densityGPerMl: 1.217, gramsPerItem: null, aisle: "Spices" },
  { canonical: "black pepper", label: "Black pepper", nutrients: n(251, 10.4, 63.9, 3.3, 25.3, 0.6, 20), densityGPerMl: 0.47, gramsPerItem: null, aisle: "Spices", aliases: ["pepper", "ground black pepper"] },
  { canonical: "cumin", label: "Cumin", nutrients: n(375, 17.8, 44.2, 22.3, 10.5, 2.3, 168), densityGPerMl: 0.45, gramsPerItem: null, aisle: "Spices" },
  { canonical: "paprika", label: "Paprika", nutrients: n(282, 14.1, 53.9, 12.9, 34.9, 10.3, 68), densityGPerMl: 0.46, gramsPerItem: null, aisle: "Spices" },
  { canonical: "cinnamon", label: "Cinnamon", nutrients: n(247, 4.0, 80.6, 1.2, 53.1, 2.2, 10), densityGPerMl: 0.53, gramsPerItem: null, aisle: "Spices" },
  { canonical: "chili flakes", label: "Chili flakes", nutrients: n(282, 12.0, 49.7, 14.3, 27.2, 7.2, 30), densityGPerMl: 0.42, gramsPerItem: null, aisle: "Spices", aliases: ["red pepper flakes", "crushed red pepper"] },
  { canonical: "oregano", label: "Oregano", nutrients: n(265, 9.0, 68.9, 4.3, 42.5, 4.1, 25), densityGPerMl: 0.3, gramsPerItem: null, aisle: "Spices" },
  { canonical: "water", label: "Water", nutrients: n(0, 0, 0, 0, 0, 0, 0), densityGPerMl: 1.0, gramsPerItem: null, aisle: "—" },
];

const BY_CANONICAL = new Map<string, FoodEntry>();
const BY_ALIAS = new Map<string, FoodEntry>();

for (const food of FOODS) {
  BY_CANONICAL.set(food.canonical, food);
  BY_ALIAS.set(food.canonical, food);
  for (const alias of food.aliases ?? []) {
    if (!BY_ALIAS.has(alias)) BY_ALIAS.set(alias, food);
  }
}

export function lookupFood(name: string): FoodEntry | null {
  const key = name.trim().toLowerCase();
  return BY_CANONICAL.get(key) ?? BY_ALIAS.get(key) ?? null;
}

export function foodAliases(): string[] {
  return [...BY_ALIAS.keys()];
}
