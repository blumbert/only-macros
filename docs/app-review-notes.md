# App Review notes — Only Macros

Paste the body of this into **App Store Connect → App Review Information →
Notes** for every submission. Apple asked for it once under Guideline 2.1; a
standing copy in the Notes field prevents them asking again.

---

## 2. Devices and operating systems tested

Tested on a physical iPhone 14 running iOS 18.7.8 prior to submission, installed via TestFlight.

## 3. What the app does, and who it is for

Only Macros is a manual food-logging utility for people who track
macronutrients — for example anyone following a diet plan set by a coach,
dietitian or themselves.

The problem it solves is speed. Existing macro trackers require searching a food
database and navigating several screens per entry. People who already know their
numbers, because they weigh and prep their own food, only need to add three
values to a running daily total. That remains the main screen and the core of
the app.

Version 1.0.3 adds a second, optional feature for runners: a page that
calculates daily calorie and macronutrient targets from the runner's profile and
weekly training, using published sports-nutrition research. It is reached from a
button and never appears on the main screen.

The app has three screens:

- **Main screen** — three numeric fields, labelled C, P and F, for grams of
  carbohydrate, protein and fat; an "Add to today" button which adds those three
  numbers to the current day's running total; and the day's totals and total
  calories shown below (a fixed arithmetic conversion: (carbs x 4) + (protein x
  4) + (fat x 9)).
- **Calendar** — opened via the button in the bottom-right corner, presented as a
  modal sheet. Shows a month grid with the totals and calories recorded for each
  past day; tapping a day shows its full breakdown. The pencil button at the top
  right of that breakdown opens an editor for the selected day, where the day's
  total can be typed in directly, macros can be added to a day that was missed,
  and individual entries can be deleted. All of it is the user's own data,
  stored on the device.
- **Runner fueling** — opened via the button in the bottom-left corner, presented
  as a modal sheet. On first open it asks for a short profile (sex, age, weight,
  optional body fat, day job, goal, bone stress injury history, and — for female
  runners, optionally — menstrual regularity). After that it shows today's
  calorie, carbohydrate, protein and fat targets, a weekly training entry
  (mileage, long run, and which days are workouts or rest), energy availability
  calculated from the user's own logged food, and a list of sources.

Days roll over at the device's local midnight.

## 4. Setup and access instructions

No setup is required. There is no account, no registration, no login, no paid
tier, no subscription, and no unlockable content. Every feature is available
immediately on first launch, offline. No demo credentials are needed because no
part of the app is gated.

To exercise the full app: type any numbers into the three fields, tap "Add to
today", and observe the totals and calorie figure update. Tap the calendar
button in the bottom-right to view the month grid, and tap any day in it to see
that day's breakdown. Tap the pencil at the top right of that breakdown to edit
the day — set its total by hand, add macros to it, or delete an entry from it.

To exercise the runner page: tap the button in the bottom-left, fill in the
profile (any values; choose "Lose" as the goal), and enter a weekly mileage in
the training card — today's targets appear. Tap days in the "Workouts" row to
see targets change with the day type. To see a safety guardrail override the
goal, tap the edit button on the profile card and choose "One in the hip
(femoral neck), pelvis or sacrum" under bone stress injuries: the targets return
to maintenance and the page explains why.

## 5. External services, tools or platforms

None. The app makes no network requests of any kind. It contains no HTTP client,
no analytics SDK, no advertising SDK, no crash reporting, no authentication
provider, no payment processing and no AI or third-party data services.

Entries, and the runner page's profile and training weeks, are stored only in
the app's local storage on the device, and are deleted when the app is deleted.
The runner page's targets are calculated on the device; nothing is sent
anywhere. This is why App Privacy is declared as "Data
Not Collected".

## 6. Regional differences

None. The app behaves identically in all regions and contains no region-gated
features or content. It has no server component, so there is no region-specific
behaviour to configure. Dates use the device's own locale and timezone.

## 7. Regulated industry or protected third-party material

Worth stating explicitly given the Health & Fitness category. The app is not a
medical device or a medical service. It does not diagnose or treat any
condition, and the runner page says on screen that its figures are estimates
from published research, not medical advice.

**What the runner page does.** It calculates daily energy and macronutrient
targets for runners using published, cited sports-nutrition formulas and
guidance, listed in the app under "Sources":

- Thomas, Erdman & Burke (2016), ACSM / Academy of Nutrition and Dietetics /
  Dietitians of Canada joint position statement on nutrition and athletic
  performance — carbohydrate, protein and fat ranges.
- Mountjoy et al. (2023), IOC consensus statement on Relative Energy Deficiency
  in Sport (REDs), and Stellingwerff et al. (2023), the IOC REDs Clinical
  Assessment Tool — energy availability thresholds and warning signs.
- Cunningham (1980) resting metabolic rate; Margaria et al. (1963) energy cost
  of running; Burke et al. (2011); Hector & Phillips (2018); Loucks & Thuma
  (2003).

**How it avoids harm.** The page is designed to prevent under-fuelling, which
is a recognised risk among runners, rather than to encourage weight loss:

- A weight-loss goal is capped at a 300 kcal/day deficit, applied only on rest
  and easy days. Workout and long-run days are always at maintenance.
- A deficit is refused outright — targets return to maintenance with an
  on-screen explanation — for users under 18, for users reporting a bone stress
  injury history or missed periods that the IOC's REDs assessment tool treats as
  a primary warning sign, and when the user's own logged intake shows low energy
  availability.
- Those explanations, and a standing "signs of under-fuelling" card, direct the
  user to a doctor. The app never suggests eating less in response to a warning
  sign.
- It makes no promises about weight loss or appearance, sets no body-weight or
  body-size targets, and shows no before/after or body-image content.

**Sensitive information.** The profile's injury and menstrual questions are
optional where noted and stored only on the device, alongside the food log.

The main screen still performs one fixed arithmetic conversion on numbers the
user types in themselves, using the universally published Atwater factors (4
kcal per gram of carbohydrate, 4 per gram of protein, 9 per gram of fat). The
app contains no food database, and no licensed, proprietary or third-party
content of any kind. All code and artwork is original.
