# Runner fueling page — model sketch

Draft for discussion. Nothing here is built yet. Every number in this doc is
meant to live in one rules table in code, each with its source attached, so a
threshold can be changed or defended without hunting through logic.

---

## 1. Principles

1. **Deterministic rules, not an LLM.** The app makes no network requests and is
   declared "Data Not Collected". Recommendations come from published formulas
   and thresholds, computed on the device. Same inputs always give the same
   answer, and every number can be traced to a source — which is also what App
   Review will want to see.
2. **Recommend from energy balance, guard with energy availability.** Two
   separate calculations. One produces the target; the other checks the target
   (and the user's actual logged intake) can't put them into low energy
   availability. The guardrail doesn't trust the recommender.
3. **Guardrails override the goal, and say why.** If someone asks to lose weight
   and shouldn't, they get maintenance with a plain explanation — not an error,
   and not a lecture.
4. **Fuel the work.** Any deficit comes out of easy and rest days. Workout and
   long-run days are always fuelled at maintenance.
5. **Built for serious runners, guarded against injury.** Body size is not a
   reason to refuse a goal — elite distance runners routinely sit at BMIs of
   17–19 while healthy and performing. What the guardrails look for instead are
   the signs that under-fuelling is already doing damage: bone stress injuries,
   menstrual disruption, and low energy availability.

---

## 2. Inputs

| Input | Used for | Required |
|---|---|---|
| Sex | body-fat default, REDs guidance | yes |
| Age | under-18 guardrail | yes |
| Weight | everything (g/kg targets, running cost) | yes |
| Body fat % | fat-free mass | optional — conservative default if blank |
| Day job: desk / on feet | non-training activity factor | yes |
| Goal: maintain / lose / recomp | energy target | yes |
| Bone stress injuries in the last 2 years | injury guardrail | yes — see §4 for the options |
| Menstrual cycle | REDs guardrail | asked of female runners, can be skipped — see §4 |

Age isn't in the original idea, but the minor guardrail needs it. Height is no
longer asked for: it only existed to compute BMI, which isn't used.

**On the periods question.** Menstrual disruption is the most-studied early sign
of low energy availability in female athletes, so it's worth asking — but it's
sensitive, so it's optional and stays on the device like everything else.
Hormonal contraception can mask the signal (a withdrawal bleed isn't a natural
cycle), which the question's help text should say.

Mileage and day types are not profile inputs — they come from the training
weeks below, so they can change week to week.

### Training weeks

Each week (Sunday–Saturday, matching the calendar) gets its own entry:

| Field | Control | Notes |
|---|---|---|
| Weekly mileage | number field | mi or km, set once in the profile |
| Workout day(s) | multi-select, S M T W T F S | any number, including none |
| Long run day | single-select, S M T W T F S | optional |
| Long run distance | number field | required once a long run day is picked |
| Rest day(s) | multi-select, S M T W T F S | any number, including none |

Every other day is an easy day. Each day has exactly one type: picking a day as
rest, workout or long run clears it from the other two.

**Proposed control:** a row of seven day chips per field rather than dropdowns.
A multi-select dropdown is awkward on iOS — it's a picker you open and close
per day — whereas a row of toggle chips shows the whole week at once and takes
one tap per day.

**A week with nothing entered** copies the most recent entered week, shown as
"same as last week" so it's clear it was carried forward. A brand-new user with
no weeks at all is prompted for this week before any targets are shown.

### Spreading the week's mileage across days

```
running days  = 7 − rest days
long run km   = the entered long run distance
every other running day = (weekly km − long run km) ÷ remaining running days
rest days     = 0 km
```

The long run is entered, not derived. Its share of the week varies too much to
guess: a recreational runner's 10 of 30 miles is a third of the week, while an
elite's 25 of 140 is under a fifth. Any fixed percentage would be badly wrong
at one end or the other.

The entry is rejected if the long run is longer than the weekly total.

Workout days get the same distance as easy days. That's deliberate: running's
energy cost per km barely changes with pace, so what makes a workout day
different is how much of that energy has to come from carbohydrate — which the
day-type carb targets already handle — not how many calories it burns.

The even split across the remaining days is still an assumption. Workout days
often run longer than easy days once warm-up and cool-down are counted, so an
optional "workout day distance" field is worth considering if the error matters
in practice.

**Body fat default when blank:** 10% male, 16% female — typical for trained
distance runners, and deliberately on the lean side: a lower body-fat guess means a *higher* fat-free mass, which makes
calculated energy availability *lower*, so a bad guess errs toward warning
rather than toward reassurance.

---

## 3. The calculation

```
FFM  (kg)       = weight × (1 − bodyFat)
RMR  (kcal)     = 500 + 22 × FFM                      Cunningham
Base (kcal)     = RMR × lifestyle                     1.4 desk, 1.6 on feet
EEE  (kcal)     = 0.9 × weight × km that day          net cost; km from that week's entry
Maintenance     = Base + EEE
Target          = Maintenance − deficit               deficit only on rest/easy days
EA   (kcal/kg FFM) = (Target − EEE) / FFM             checked against guardrails
```

Running's energy cost is close to 1 kcal per kg per km regardless of pace
(gross); ~0.9 is used as the net figure above resting. It's an approximation and
should be labelled as an estimate in the UI.

### Macros, in this order

1. **Protein** — 1.6 g/kg at maintenance, 2.0 g/kg in a deficit or recomp.
   (Consensus range 1.2–2.0 g/kg; 1.6–2.4 g/kg during energy restriction.)
2. **Carbohydrate by day type:**

   | Day | g/kg | Picks |
   |---|---|---|
   | Rest | 3–5 | 4 |
   | Easy | 5–7 | 6 |
   | Workout | 6–10 | 7 |
   | Long run | 8–10 | 8 |

3. **Fat** — whatever energy remains, bounded to 20–35% of the target.
   - Below 20%: lower carbs toward the bottom of that day's range, never below it.
     If fat is still under 20% at the carb floor, the target is too low for this
     person and the guardrail fires.
   - Above 35%: the excess moves to carbs. On a high-energy rest day (an
     on-your-feet job, say) that can lift carbs a little above the day's range —
     about 5.8 g/kg against a 3–5 rest-day range for a 50 kg runner. Accepted:
     the alternative is fat above 35%.

### Goals

- **Maintain** — deficit 0.
- **Lose** — 300 kcal/day on rest and easy days, 0 on workout and long-run days.
  So the real weekly deficit is well under 2,100 kcal — roughly 0.1–0.2 kg/week.
  Slow by design; the page says so.
- **Recomp** — maintenance energy, 2.0 g/kg protein, and a note that strength
  training is what drives it. Honest caveat on the page: body-composition change
  at maintenance is modest for trained endurance runners.

---

## 4. Guardrails

### Hard — a "lose" goal is replaced with maintenance

| Rule | Proposed threshold | Status |
|---|---|---|
| Minor | age < 18 | proposal |
| Bone stress injury history | ≥1 high-risk or ≥2 low-risk BSIs in the last 2 years, or ≥6 months out of training from one | IOC REDs CAT2 primary indicator |
| Missed periods | 3 or more consecutive cycles missed | IOC REDs CAT2 primary indicator |
| Already under-fuelling | 7-day logged EA < 30 | from REDs literature |
| Plan would under-fuel | a day's planned EA < 30 → no deficit that day | from REDs literature |

The last row is a safety net that can't currently trip: a planned day's energy
availability is at least 1.4 × 22 = 30.8 plus a positive term, whatever the
runner's size or mileage, so a capped 300 kcal deficit never reaches 30. It
stays so that editing a number in the rules table can never silently produce a
day below the threshold. The guardrail that actually catches under-fuelling is
the logged-intake one.

The injury and period rules are taken from the IOC's 2023 REDs Clinical
Assessment Tool (CAT2), which grades each sign as a primary or secondary
indicator. Primary indicators block a deficit here; secondary ones warn.
Verbatim, the CAT2 primary indicator for bone is:

> History of ≥1 high-risk (femoral neck, sacrum, pelvis) or ≥2 low-risk BSI
> (all other BSI locations) within the previous 2 years or absence of ≥6 months
> from training due to BSI in the previous 2 years

and for menstrual function, secondary amenorrhoea — "absence of 3–11
consecutive menstrual cycles" — is a primary indicator, 12 or more is a severe
one, and oligomenorrhoea (">35 days between periods for a maximum of 8
periods/year") is secondary.

**What the questions look like, so the answers map straight onto those rules:**

*Bone stress injuries (stress fractures or stress reactions) in the last 2 years*
- None
- One, somewhere other than the hip, sacrum or pelvis → warn
- One in the hip (femoral neck), sacrum or pelvis → block
- Two or more, anywhere → block
- plus: "Did one keep you out of training for 6 months or more?" → block

*Your cycle*
- Regular
- Usually more than 35 days apart (8 or fewer periods a year) → warn
- Missed 3 or more in a row → block
- Not applicable / on hormonal contraception / prefer not to say

**A limit worth being honest about.** The CAT2 is a clinical tool for a
physician-led assessment, and its menstrual criteria specify disruption *caused
by functional hypothalamic amenorrhoea* — something only a doctor can establish.
The app can't diagnose that, and shouldn't claim to. It uses the criteria as
triggers to hold off on a deficit and to suggest seeing a doctor, and the copy
should say exactly that.

No body-size rule — no BMI floor and no body-fat floor. Both would misfire on
exactly the runners this app is for. A lean runner with no injury history,
normal cycles, and adequate logged energy availability can have a deficit; the
300 kcal cap and fuelled workout days still apply.

The injury and menstrual rules are what "avoid injury" means in practice: bone
stress injuries and menstrual disruption are both strongly associated with low
energy availability, and a runner showing either shouldn't be put further into
deficit whatever their goal says.

### Soft — warn, don't override

- Planned EA between 30 and 45 on any day: "reduced energy availability" note.
- Logged carbs below the day-type floor on 3 or more of the last 7 days.
- One low-risk bone stress injury in the last 2 years, or periods usually more
  than 35 days apart — both CAT2 secondary indicators.
- A standing REDs card, always visible, listing the signs: missed or irregular
  periods, recurring bone stress injuries, frequent illness, persistent fatigue,
  low libido. Says to see a doctor, not to adjust the numbers.

EA thresholds are guides, not bright lines. The 2023 IOC consensus moved away
from treating 30 kcal/kg FFM as a universal cut-off, and the response differs
between individuals and between sexes. The UI should say "may", not "will".

---

## 5. The one feature only this app can do

The page can read the log. A 7-day average of *logged* intake against estimated
running expenditure gives the user's **actual** energy availability — not what a
formula says they should eat, but what they have been eating. That's the most
useful REDs signal the app can offer, and it needs no extra input.

The training weeks make this much sharper. Without them, the expenditure side
is one average spread evenly across every day. With them, each past day uses
what that week's entry says was actually run that day — so a 1,800 kcal
long-run day reads as the problem it is, rather than being averaged away
against a rest day.

Caveat to show alongside it: only as accurate as what was logged. A day with
nothing logged is excluded, not counted as zero — same rule the monthly average
now follows.

---

## 6. What the page shows

- **This week** — the mileage field and the day chips, editable in place.
  Arrows step to previous weeks to fill in or correct history.
- **Today's targets** — kcal, and C / P / F in grams, same visual language as
  Daily Totals. Labelled with the day type the week says today is ("Workout
  day · 9.1 km").
- **Why these numbers** — two or three short lines. "Carbs are higher today
  because it's a workout day."
- **Guardrail message**, when one fires — plain and non-judgemental.
- **Last 7 days** — logged average vs target, and estimated energy availability.
- **Sources** — expandable list, one line per citation.
- **Profile** — edit the inputs.

Entry point: a button bottom-left, mirroring the calendar at bottom-right.

---

## 7. Code shape

```
src/fueling/rules.ts      every threshold + its citation, in one table   (done)
src/fueling/model.ts      pure functions: inputs + day → targets + guardrail results   (done)
src/fueling/profile.ts    load/save profile under its own storage key   (to do)
src/fueling/training.ts   weeks keyed by their Sunday; carry-forward; km per day   (done)
src/fueling/__tests__/    47 tests, from the worked examples and every guardrail  (done)
src/components/FuelingSheet.tsx   (to do)
```

`model.ts` is pure, so it's straightforward to unit-test the cases that matter
most — the light runner, the minor, the under-fuelled log — before any UI exists.

---

## 8. Worked examples (easy day, mileage spread evenly for simplicity)

**Female, 50 kg, body fat blank (16%), 40 mi/week, desk job**

- FFM 42 kg → RMR 1,424 → base 1,994
- 9.2 km/day → EEE 414 → maintenance **≈ 2,408 kcal**
- Protein 80 g · carbs 311 g · fat ≈ 94 g (35%, capped; the rest moved to carbs)
- EA at maintenance ≈ 47 — fine
- With "lose" on an easy day: 2,108 kcal, protein 100 g, carbs 300 g, fat ≈ 56 g
  (24%), EA ≈ 40 — **allowed**, with the reduced-EA note
- Same runner, but a sacral stress fracture last year → **"lose" is refused**,
  maintenance shown with the reason
- Same runner, one metatarsal stress fracture last year → allowed, with a warning

**Male, 75 kg, 15%, 50 mi/week, desk job**

- FFM 64 kg → RMR 1,903 → base 2,664
- 11.4 km/day → EEE 770 → maintenance **≈ 3,434 kcal**
- Protein 120 g · carbs 450 g · fat ≈ 128 g (34%)
- With "lose" on an easy day: 3,134 kcal, protein 150 g, EA ≈ 37 — allowed, with
  the reduced-EA note

The first example shows the design: being light doesn't block her goal, but a
recent bone stress injury does.

---

## 9. Sources

Verify each before shipping; these are the anchors the rules table would cite.

- Thomas, Erdman & Burke (2016). ACSM / Academy of Nutrition and Dietetics /
  Dietitians of Canada joint position statement: Nutrition and Athletic
  Performance. *Med Sci Sports Exerc.*
- Mountjoy et al. (2023). IOC consensus statement on Relative Energy Deficiency
  in Sport (REDs). *Br J Sports Med.*
- Burke et al. (2011). Carbohydrates for training and competition. *J Sports Sci.*
- Loucks & Thuma (2003). LH pulsatility is disrupted at a threshold of energy
  availability in regularly menstruating women. *J Clin Endocrinol Metab.*
- Hector & Phillips (2018). Protein recommendations for weight loss in elite
  athletes. *Int J Sport Nutr Exerc Metab.*
- Stellingwerff et al. (2023). Review of the scientific rationale, development
  and validation of the IOC REDs Clinical Assessment Tool V.2 (IOC REDs CAT2).
  *Br J Sports Med.* — source of the injury and menstrual criteria.
- Cunningham (1980). A reanalysis of the factors influencing basal metabolic rate
  in normal adults. *Am J Clin Nutr.*
- Margaria et al. (1963). Energy cost of running. *J Appl Physiol.*

---

## 10. Open decisions

1. Day chips instead of dropdowns?
2. Should today's targets also appear on the main screen under Daily Totals?
3. App Review notes section 7 needs rewriting before this ships — it currently
   says the app gives no recommendations or targets.
