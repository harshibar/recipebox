/** Cache of resolved food facts. A food's nutrients don't change; look up once. */

import type { Nutrients } from "@/lib/domain/types";
import { getDb } from "./client";

export interface CachedFood {
  canonical: string;
  nutrients: Nutrients;
  densityGPerMl: number | null;
  gramsPerItem: number | null;
  gramsPerCountUnit: Record<string, number> | null;
  portions: Record<string, number> | null;
  fdcId: number | null;
}

interface Row {
  canonical: string;
  nutrients: string;
  density_g_per_ml: number | null;
  grams_per_item: number | null;
  grams_per_count_unit: string | null;
  portions: string | null;
  fdc_id: number | null;
}

export function getCachedFood(canonical: string): CachedFood | null {
  const row = getDb()
    .prepare<[string], Row>("SELECT * FROM food_cache WHERE canonical = ?")
    .get(canonical);
  if (!row) return null;

  return {
    canonical: row.canonical,
    nutrients: JSON.parse(row.nutrients) as Nutrients,
    densityGPerMl: row.density_g_per_ml,
    gramsPerItem: row.grams_per_item,
    gramsPerCountUnit: parseJson<Record<string, number>>(row.grams_per_count_unit),
    portions: parseJson<Record<string, number>>(row.portions),
    fdcId: row.fdc_id,
  };
}

export function putCachedFood(food: CachedFood): void {
  getDb()
    .prepare(
      `INSERT INTO food_cache
         (canonical, nutrients, density_g_per_ml, grams_per_item,
          grams_per_count_unit, portions, fdc_id, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(canonical) DO UPDATE SET
         nutrients            = excluded.nutrients,
         density_g_per_ml     = excluded.density_g_per_ml,
         grams_per_item       = excluded.grams_per_item,
         grams_per_count_unit = excluded.grams_per_count_unit,
         portions             = excluded.portions,
         fdc_id               = excluded.fdc_id,
         cached_at            = excluded.cached_at`,
    )
    .run(
      food.canonical,
      JSON.stringify(food.nutrients),
      food.densityGPerMl,
      food.gramsPerItem,
      food.gramsPerCountUnit ? JSON.stringify(food.gramsPerCountUnit) : null,
      food.portions ? JSON.stringify(food.portions) : null,
      food.fdcId,
      new Date().toISOString(),
    );
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
