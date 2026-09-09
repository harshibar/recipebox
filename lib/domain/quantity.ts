/**
 * Quantity parsing and display.
 *
 * Recipes write quantities as "1 1/2", "1½", "0.5", or "1-2". Scaling has to
 * happen in decimal, but display has to go back to fractions — nobody wants to
 * read "1.3333333 cups".
 */

const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Parse a human quantity string to a number.
 * Ranges ("1-2 onions") resolve to their midpoint, which is the honest reading
 * of "1 to 2" for macro purposes.
 */
export function parseQuantity(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (!s) return null;

  // Expand vulgar fractions, inserting a space so "1½" becomes "1 1/2".
  for (const [glyph, value] of Object.entries(VULGAR)) {
    if (s.includes(glyph)) {
      const asFraction = fractionFor(value);
      s = s.split(glyph).join(` ${asFraction} `);
    }
  }
  s = s.replace(/\s+/g, " ").trim();

  // Range: take the midpoint. Guard against matching a negative sign.
  const range = s.match(/^([\d./\s]+?)\s*(?:-|–|—|to)\s*([\d./\s]+)$/);
  if (range) {
    const lo = parseQuantity(range[1]);
    const hi = parseQuantity(range[2]);
    if (lo !== null && hi !== null) return (lo + hi) / 2;
  }

  // Mixed number: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denom = Number(mixed[3]);
    if (denom === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denom;
  }

  // Simple fraction: "3/4"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    if (denom === 0) return null;
    return Number(frac[1]) / denom;
  }

  // Plain decimal or integer
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

/** Nearest kitchen-friendly fraction string for a value in (0, 1). */
function fractionFor(value: number): string {
  const denominators = [2, 3, 4, 6, 8];
  let best = { text: "", error: Infinity };
  for (const d of denominators) {
    const n = Math.round(value * d);
    if (n <= 0 || n >= d) continue;
    const error = Math.abs(value - n / d);
    if (error < best.error) best = { text: `${n}/${d}`, error };
  }
  return best.text || String(Number(value.toFixed(2)));
}

const GLYPH_FOR: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
  "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

/**
 * Render a number as a kitchen-readable quantity.
 * Snaps to a nearby fraction when close (within ~2%), otherwise rounds sensibly
 * — a scaled recipe should read "1½ cups", not "1.4999 cups".
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";

  const abs = Math.abs(value);

  // Large amounts don't want fractions at all.
  if (abs >= 10) return String(Math.round(value));

  const whole = Math.floor(abs);
  const remainder = abs - whole;
  const sign = value < 0 ? "-" : "";

  // Close enough to a whole number.
  if (remainder < 0.02) return `${sign}${whole}`;
  if (remainder > 0.98) return `${sign}${whole + 1}`;

  const frac = fractionFor(remainder);
  const [n, d] = frac.split("/").map(Number);
  const snapped = d ? n / d : NaN;

  // Only use the fraction if it is genuinely close; otherwise show a decimal.
  if (!Number.isFinite(snapped) || Math.abs(snapped - remainder) > 0.021) {
    return `${sign}${Number(abs.toFixed(2))}`;
  }

  const glyph = GLYPH_FOR[frac] ?? frac;
  return whole > 0 ? `${sign}${whole}${glyph}` : `${sign}${glyph}`;
}
