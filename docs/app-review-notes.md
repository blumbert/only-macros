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
values to a running daily total. This app is that and nothing else.

The app has two screens:

- **Main screen** — three numeric fields, labelled C, P and F, for grams of
  carbohydrate, protein and fat; an "Add to today" button which adds those three
  numbers to the current day's running total; and the day's totals and total
  calories shown below (a fixed arithmetic conversion: (carbs x 4) + (protein x
  4) + (fat x 9)).
- **Calendar** — opened via the button in the bottom-right corner, presented as a
  modal sheet. Shows a month grid with the totals and calories recorded for each
  past day; tapping a day shows its full breakdown.

Days roll over at the device's local midnight.

## 4. Setup and access instructions

No setup is required. There is no account, no registration, no login, no paid
tier, no subscription, and no unlockable content. Every feature is available
immediately on first launch, offline. No demo credentials are needed because no
part of the app is gated.

To exercise the full app: type any numbers into the three fields, tap "Add to
today", and observe the totals and calorie figure update. Tap the calendar
button in the bottom-right to view the month grid, and tap any day in it to see
that day's breakdown.

## 5. External services, tools or platforms

None. The app makes no network requests of any kind. It contains no HTTP client,
no analytics SDK, no advertising SDK, no crash reporting, no authentication
provider, no payment processing and no AI or third-party data services.

Entries are stored only in the app's local storage on the device, and are
deleted when the app is deleted. This is why App Privacy is declared as "Data
Not Collected".

## 6. Regional differences

None. The app behaves identically in all regions and contains no region-gated
features or content. It has no server component, so there is no region-specific
behaviour to configure. Dates use the device's own locale and timezone.

## 7. Regulated industry or protected third-party material

Not applicable, and worth stating explicitly given the Health & Fitness
category: this app is not a medical or health service. It does not diagnose,
treat, or give dietary, medical or nutritional advice. It makes no health claims
and issues no recommendations, targets or warnings.

It performs one fixed arithmetic conversion on numbers the user types in
themselves, using the universally published Atwater factors (4 kcal per gram of
carbohydrate, 4 per gram of protein, 9 per gram of fat). It contains no food
database, and no licensed, proprietary or third-party content of any kind. All
code and artwork is original.
