"use client";

import type { GramsSource, Nutrients } from "@/lib/domain/types";
import { roundNutrients } from "@/lib/domain/macros";

const CONFIDENCE_NOTE: Record<GramsSource, string> = {
  explicit: "Weights came from the recipe itself.",
  portion: "Weights from USDA per-food portion data.",
  density: "Volumes converted using per-food densities.",
  estimate: "Some weights are estimates — treat these as approximate.",
};

export function MacroPanel({
  nutrients,
  label,
  confidence,
  unresolved = [],
  coverage = 1,
}: {
  nutrients: Nutrients;
  label: string;
  confidence?: GramsSource | null;
  unresolved?: string[];
  coverage?: number;
}) {
  const n = roundNutrients(nutrients);
  const shaky = confidence === "estimate" || coverage < 0.9;

  return (
    <section className="rounded-xl border border-black/10 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-black/50">
          {label}
        </h2>
        <span className="text-2xl font-semibold">{n.kcal} kcal</span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Macro label="Protein" value={`${n.protein} g`} accent="text-herb" />
        <Macro label="Carbs" value={`${n.carbs} g`} />
        <Macro label="Fat" value={`${n.fat} g`} />
      </dl>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-black/60">
        <Macro label="Fiber" value={`${n.fiber} g`} small />
        <Macro label="Sugar" value={`${n.sugar} g`} small />
        <Macro label="Sodium" value={`${n.sodium} mg`} small />
      </dl>

      {/*
        Being honest about confidence is what makes these numbers usable. A
        fake-precise figure the user later discovers was a guess costs more
        trust than an approximate one that said so.
      */}
      {(shaky || unresolved.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-xs text-black/60">
          {confidence && shaky && <p>{CONFIDENCE_NOTE[confidence]}</p>}
          {unresolved.length > 0 && (
            <p>
              No nutrition data for{" "}
              <span className="font-medium">{unresolved.join(", ")}</span> — not
              counted above.
            </p>
          )}
          {coverage < 1 && (
            <p>Covers {Math.round(coverage * 100)}% of the recipe by weight.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Macro({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "" : "rounded-lg bg-paper py-2"}>
      <dt className={small ? "" : "text-xs text-black/50"}>{label}</dt>
      <dd className={small ? "font-medium" : `text-lg font-semibold ${accent ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}
