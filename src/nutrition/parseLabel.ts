/** A piece of text from the label, with its box in 0-1 coordinates from the top-left. */
export type LabelText = { text: string; x?: number; y?: number; width?: number; height?: number };

/** What could be read off the label, per serving. Anything not found is left out. */
export type LabelReading = {
  c?: number;
  p?: number;
  f?: number;
  kcal?: number;
  servingSize?: string;
};

/**
 * Put Vision's pieces back into the label's printed rows. Vision often splits
 * a row ("Total Fat" on the left, "8g" further right, "10%" at the edge), so
 * pieces whose vertical centres sit within about half a line of each other
 * are one row, read left to right. Pieces without boxes are taken as rows in
 * the order given.
 */
export function toRows(pieces: LabelText[]): string[] {
  const boxed = pieces.filter(
    (p) => p.y !== undefined && p.height !== undefined && p.x !== undefined,
  ) as Required<LabelText>[];
  if (boxed.length !== pieces.length) return pieces.map((p) => p.text);

  const sorted = [...boxed].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const rows: { centre: number; height: number; items: Required<LabelText>[] }[] = [];
  for (const piece of sorted) {
    const centre = piece.y + piece.height / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(centre - row.centre) <= Math.min(row.height, piece.height) / 2) {
      row.items.push(piece);
      // Keep the row's centre and height those of its smallest text, so one big
      // "Calories 230" can't swallow the rows above and below it.
      if (piece.height < row.height) {
        row.centre = centre;
        row.height = piece.height;
      }
    } else {
      rows.push({ centre, height: piece.height, items: [piece] });
    }
  }
  return rows.map((r) =>
    r.items
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text)
      .join(' '),
  );
}

/**
 * Undo the misreadings that matter for numbers: a zero read as the letter O
 * ("Og"), a one read as l or I ("lg"), and a decimal comma ("0,5g").
 */
function normalise(row: string): string {
  return row
    .toLowerCase()
    .replace(/less\s+than/g, '<')
    // Only before a unit, so "2,000 calories" in the footnote stays a thousand.
    .replace(/(\d),(\d{1,2})(?=\s*g\b)/g, '$1.$2')
    .replace(/(^|[\s<(])[o](?=\s?g\b)/g, '$10')
    .replace(/(^|[\s<(])[li|](?=\s?g\b)/g, '$11');
}

/**
 * The first gram amount in `text`: "8g", "8 g", "8.5g", "<1g" ("less than" is
 * already "<" by now). Milligrams and percentages don't count. "<" halves the
 * number — the label is saying somewhere between nothing and that.
 */
function grams(text: string): number | undefined {
  const match = /(<)?\s*(\d+(?:\.\d+)?)\s*(mg|g)\b/g;
  let m: RegExpExecArray | null;
  while ((m = match.exec(text))) {
    if (m[3] !== 'g') continue;
    const n = parseFloat(m[2]);
    if (!Number.isFinite(n)) continue;
    return m[1] ? n / 2 : n;
  }
  return undefined;
}

/** A row that's only an amount, as when Vision sees the number apart from its name. */
const amountOnly = (row: string) => /^[<\s]*\d+(?:\.\d+)?\s*g\b[\s\d%]*$/.test(row);

type Nutrient = {
  /** How the label names it. Earlier patterns are preferred over later ones. */
  names: RegExp[];
  /**
   * Words just before a match that make it a different line ("Saturated Fat",
   * "Calories from Fat", "Net Carbs"). Checked only right before the name, so
   * a one-line label like "Total Fat 8g (Sat. Fat 3g)" still reads as 8g.
   */
  not?: RegExp;
};

const FAT: Nutrient = {
  names: [/total\s*fat/g, /\bfat\b/g],
  not: /(satur\w*|\bsat\.?|trans|poly\w*|mono\w*|from)\s*$/,
};
const CARBS: Nutrient = {
  names: [/total\s*carb/g, /carbohydrate/g, /\bcarbs?\b/g],
  not: /net\s*$/,
};
const PROTEIN: Nutrient = { names: [/prot[ei]{1,2}n/g] };

/** Where the next nutrient starts on a row that holds more than one. */
const NEXT_NUTRIENT =
  /satur|\bsat\b|trans|chol|sodium|carb|fib|sugar|prot[ei]|\bfat\b|potass|calcium|iron|vitamin|calories/;

function find(rows: string[], nutrient: Nutrient): number | undefined {
  for (const name of nutrient.names) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      name.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = name.exec(row))) {
        const before = row.slice(Math.max(0, m.index - 14), m.index);
        if (nutrient.not?.test(before)) continue;
        // The amount up to the next nutrient's name, so a row holding two
        // nutrients can't hand one of them the other's grams.
        // Skip the rest of the name's own word first ("total carb|ohydrate").
        const after = row.slice(m.index + m[0].length).replace(/^[a-z.]*/, '');
        const same = grams(after.split(NEXT_NUTRIENT)[0] ?? '');
        if (same !== undefined) return same;
        // Or on a row of its own just below the name.
        const below = rows.slice(i + 1, i + 3).find(amountOnly);
        if (below) return grams(below);
      }
    }
  }
  return undefined;
}

function findCalories(rows: string[]): number | undefined {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const word = /calories/g;
    let m: RegExpExecArray | null;
    while ((m = word.exec(row))) {
      const after = row.slice(m.index + m[0].length);
      if (/^\s*(from|per)\b/.test(after)) continue;
      const same = /^\D{0,12}?(\d{1,4})\b(?!\s*(%|g|mg|\.\d))/.exec(after);
      if (same) return parseInt(same[1], 10);
      // The big number printed on its own line under "Calories".
      const alone = rows[i + 1] && /^\s*(\d{1,4})\s*$/.exec(rows[i + 1]);
      if (alone && /^\s*$/.test(after)) return parseInt(alone[1], 10);
    }
  }
  return undefined;
}

function findServingSize(original: string[]): string | undefined {
  // On a one-line label the serving size runs straight into the calories.
  const tidy = (s: string) =>
    s
      .split(/calories|amount|servings?\s+per|nutrition/i)[0]
      .replace(/^[\s:]+/, '')
      .trim()
      .slice(0, 40);
  for (let i = 0; i < original.length; i++) {
    const m = /serv(?:ing)?\.?\s*size/i.exec(original[i]);
    if (!m) continue;
    const rest = tidy(original[i].slice(m.index + m[0].length));
    if (rest) return rest;
    const next = original[i + 1] ? tidy(original[i + 1]) : '';
    if (next) return next;
  }
  return undefined;
}

/**
 * Read carbs, protein and fat per serving off the text of a US-style nutrition
 * facts label. It reads the first amount after each nutrient's name, which on
 * a two-column label is the per-serving one. Anything it can't find stays
 * undefined so the page can ask for it rather than guess.
 */
export function parseLabel(pieces: LabelText[]): LabelReading {
  const original = toRows(pieces);
  const rows = original.map(normalise);
  const reading: LabelReading = {};
  const c = find(rows, CARBS);
  const p = find(rows, PROTEIN);
  const f = find(rows, FAT);
  const kcal = findCalories(rows);
  const servingSize = findServingSize(original);
  if (c !== undefined) reading.c = c;
  if (p !== undefined) reading.p = p;
  if (f !== undefined) reading.f = f;
  if (kcal !== undefined) reading.kcal = kcal;
  if (servingSize) reading.servingSize = servingSize;
  return reading;
}

/** Grams for `servings` servings, to the tenth of a gram the log keeps. */
export function scale(perServing: { c: number; p: number; f: number }, servings: number) {
  // The epsilon keeps halves rounding up: 3.3 x 1.5 is 4.9499999... in binary.
  const r = (n: number) => Math.round(n * servings * 10 + 1e-6) / 10;
  return { c: r(perServing.c), p: r(perServing.p), f: r(perServing.f) };
}

/**
 * Whether the label's own calorie figure disagrees with its macros enough to
 * suggest a misread number. Labels round, and fibre and sugar alcohols count
 * for less than 4 kcal/g, so small gaps are normal; this only flags a gap of
 * both 20% and 40 kcal.
 */
export function caloriesDisagree(labelKcal: number, macroKcal: number): boolean {
  const gap = Math.abs(labelKcal - macroKcal);
  return gap >= 40 && gap >= 0.2 * Math.max(labelKcal, macroKcal);
}
