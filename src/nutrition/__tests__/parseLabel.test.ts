import { describe, expect, it } from '@jest/globals';

import { caloriesDisagree, parseLabel, scale, toRows, type LabelText } from '../parseLabel';

const lines = (...text: string[]): LabelText[] => text.map((t) => ({ text: t }));

/** A piece at a given row, for building boxed input. */
const at = (text: string, x: number, y: number, height = 0.03): LabelText => ({
  text,
  x,
  y,
  width: 0.2,
  height,
});

// The FDA's sample label, the way Vision tends to return it: amounts and
// %DV split from their names more often than not.
const STANDARD = lines(
  'Nutrition Facts',
  '8 servings per container',
  'Serving size',
  '2/3 cup (55g)',
  'Amount per serving',
  'Calories',
  '230',
  '% Daily Value*',
  'Total Fat 8g',
  '10%',
  'Saturated Fat 1g',
  '5%',
  'Trans Fat 0g',
  'Cholesterol 0mg',
  '0%',
  'Sodium 160mg',
  '7%',
  'Total Carbohydrate 37g',
  '13%',
  'Dietary Fiber 4g',
  '14%',
  'Total Sugars 12g',
  'Includes 10g Added Sugars',
  '20%',
  'Protein 3g',
  'Vitamin D 2mcg',
  '10%',
  'Calcium 260mg',
  '* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.',
);

describe('parseLabel', () => {
  it('reads the standard label', () => {
    expect(parseLabel(STANDARD)).toEqual({
      c: 37,
      p: 3,
      f: 8,
      kcal: 230,
      servingSize: '2/3 cup (55g)',
    });
  });

  it('puts split pieces back into rows by position', () => {
    const pieces = [
      at('Serving size', 0.05, 0.1),
      at('1 bar (68g)', 0.6, 0.1),
      at('Calories', 0.05, 0.16, 0.05),
      at('250', 0.7, 0.15, 0.07),
      at('Total Fat', 0.05, 0.25),
      at('9g', 0.3, 0.251),
      at('12%', 0.85, 0.249),
      at('Saturated Fat', 0.1, 0.29),
      at('3.5g', 0.4, 0.29),
      at('Total Carbohydrate', 0.05, 0.33),
      at('30g', 0.45, 0.33),
      at('Protein', 0.05, 0.41),
      at('10g', 0.3, 0.41),
    ];
    expect(toRows(pieces).slice(0, 3)).toEqual([
      'Serving size 1 bar (68g)',
      'Calories 250',
      'Total Fat 9g 12%',
    ]);
    expect(parseLabel(pieces)).toEqual({
      c: 30,
      p: 10,
      f: 9,
      kcal: 250,
      servingSize: '1 bar (68g)',
    });
  });

  it('takes the amount from the row below when Vision splits it off the name', () => {
    expect(parseLabel(lines('Protein', '12g', '24%'))).toEqual({ p: 12 });
  });

  it('never takes a saturated or trans fat amount for total fat', () => {
    expect(parseLabel(lines('Saturated Fat 4g', 'Trans Fat 0g', 'Total Fat 10g')).f).toBe(10);
    expect(parseLabel(lines('Saturated Fat 4g', 'Trans Fat 0g')).f).toBeUndefined();
  });

  it('never takes fibre, sugar or net carbs for total carbohydrate', () => {
    expect(parseLabel(lines('Net Carbs 5g', 'Dietary Fiber 9g', 'Total Carbs 14g')).c).toBe(14);
  });

  it('ignores milligrams and percentages', () => {
    expect(parseLabel(lines('Total Fat 450mg 3%')).f).toBeUndefined();
  });

  it('fixes zeros and ones misread as letters, and decimal commas', () => {
    expect(parseLabel(lines('Total Fat Og', 'Protein lg', 'Total Carbohydrate 0,5g'))).toEqual({
      f: 0,
      p: 1,
      c: 0.5,
    });
  });

  it('reads "less than" as half the amount', () => {
    expect(parseLabel(lines('Protein less than 1g')).p).toBe(0.5);
    expect(parseLabel(lines('Protein <1g')).p).toBe(0.5);
  });

  it('reads the per-serving column of a two-column label', () => {
    expect(parseLabel(lines('Total Fat 8g 10% 16g 20%')).f).toBe(8);
  });

  it('reads a one-line label', () => {
    const linear = lines(
      'Nutrition Facts Serving Size 1 bar (40g) Calories 190 Total Fat 7g (Sat. Fat 2.5g, Trans Fat 0g) Sodium 95mg Total Carb. 29g (Fiber 2g, Total Sugars 12g (Incl. 11g Added Sugars)) Protein 3g',
    );
    expect(parseLabel(linear)).toEqual({
      c: 29,
      p: 3,
      f: 7,
      kcal: 190,
      servingSize: '1 bar (40g)',
    });
  });

  it('reads a bilingual Canadian label', () => {
    expect(
      parseLabel(lines('Calories 110', 'Fat / Lipides 2 g 3 %', 'Carbohydrate / Glucides 20 g', 'Protein / Protéines 3 g')),
    ).toEqual({ c: 20, p: 3, f: 2, kcal: 110 });
  });

  it('skips calories from fat on older labels', () => {
    expect(parseLabel(lines('Calories 250 Calories from Fat 110')).kcal).toBe(250);
    expect(parseLabel(lines('Calories from Fat 110', 'Calories 250')).kcal).toBe(250);
  });

  it("leaves out what isn't there", () => {
    expect(parseLabel(lines('Ingredients: oats, honey'))).toEqual({});
  });
});

describe('scale', () => {
  it('multiplies by the servings, to a tenth of a gram', () => {
    expect(scale({ c: 37, p: 3, f: 8 }, 2)).toEqual({ c: 74, p: 6, f: 16 });
    expect(scale({ c: 12.5, p: 3.3, f: 0.5 }, 1.5)).toEqual({ c: 18.8, p: 5, f: 0.8 });
  });
});

describe('caloriesDisagree', () => {
  it('lets ordinary label rounding through', () => {
    expect(caloriesDisagree(230, 232)).toBe(false); // the standard label: 37*4 + 3*4 + 8*9
    expect(caloriesDisagree(100, 130)).toBe(false); // 30%, but only 30 kcal
  });

  it('flags a gap that points to a misread number', () => {
    // 8g of fat read as 89g.
    expect(caloriesDisagree(230, 37 * 4 + 3 * 4 + 89 * 9)).toBe(true);
  });
});
