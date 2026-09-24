/**
 * Every number the fueling model uses, in one place, each with where it came
 * from. A threshold should be changeable — or defensible — without reading any
 * logic. Values marked `judgement` are product choices, not research findings,
 * and are labelled that way on purpose.
 */

export type DayType = 'rest' | 'easy' | 'workout' | 'long';

type Range = { min: number; max: number; pick: number };

export const SOURCES = {
  acsm2016:
    'Thomas, Erdman & Burke (2016). Nutrition and Athletic Performance — ACSM / AND / DC joint position statement. Med Sci Sports Exerc.',
  burke2011: 'Burke et al. (2011). Carbohydrates for training and competition. J Sports Sci.',
  hector2018:
    'Hector & Phillips (2018). Protein recommendations for weight loss in elite athletes. Int J Sport Nutr Exerc Metab.',
  ioc2023: 'Mountjoy et al. (2023). IOC consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med.',
  cat2:
    'Stellingwerff et al. (2023). Scientific rationale, development and validation of the IOC REDs Clinical Assessment Tool V.2 (CAT2). Br J Sports Med.',
  loucks2003:
    'Loucks & Thuma (2003). LH pulsatility is disrupted at a threshold of energy availability in regularly menstruating women. J Clin Endocrinol Metab.',
  cunningham1980:
    'Cunningham (1980). A reanalysis of the factors influencing basal metabolic rate in normal adults. Am J Clin Nutr.',
  margaria1963: 'Margaria et al. (1963). Energy cost of running. J Appl Physiol.',
} as const;

export const RULES = {
  /** Resting metabolic rate from fat-free mass: base + perKgFfm × FFM. [cunningham1980] */
  rmr: { base: 500, perKgFfm: 22 },

  /** Multiplier on RMR for everything that isn't training. judgement, conventional values */
  lifestyle: { desk: 1.4, onFeet: 1.6 },

  /**
   * Net energy cost of running, kcal per kg per km. Close to 1.0 gross and
   * nearly independent of pace; 0.9 approximates the part above resting.
   * [margaria1963]
   */
  runningKcalPerKgKm: 0.9,

  /**
   * Body fat assumed when none is entered — typical of trained distance
   * runners, and lean on purpose: a lower guess means more fat-free mass,
   * which makes energy availability come out *lower*, so a wrong guess errs
   * toward warning. judgement
   */
  defaultBodyFat: { male: 0.1, female: 0.16 },

  /** Protein, g/kg body mass. Range 1.2–2.0; 1.6–2.4 in a deficit. [acsm2016, hector2018] */
  protein: { maintain: 1.6, deficitOrRecomp: 2.0 },

  /** Carbohydrate, g/kg body mass, by day type. [acsm2016, burke2011] */
  carbs: {
    rest: { min: 3, max: 5, pick: 4 },
    easy: { min: 5, max: 7, pick: 6 },
    workout: { min: 6, max: 10, pick: 7 },
    long: { min: 8, max: 10, pick: 8 },
  } satisfies Record<DayType, Range>,

  /** Fat as a share of the day's energy. [acsm2016] */
  fatShare: { min: 0.2, max: 0.35 },

  /** Deficit when the goal is to lose, and the only days it applies to. judgement */
  deficit: { kcal: 300, days: ['rest', 'easy'] as DayType[] },

  /** Energy availability, kcal per kg fat-free mass per day. [loucks2003, ioc2023] */
  ea: { low: 30, adequate: 45 },

  /** Below this age a deficit is never set. judgement */
  minorAge: 18,

  /**
   * The logged-intake check needs a few days of data to mean anything.
   * judgement
   */
  loggedEa: { lookbackDays: 7, minDays: 3 },
} as const;
