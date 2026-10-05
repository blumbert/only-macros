# App Review notes — Only Macros

Paste everything below the line into **App Store Connect → App Review
Information → Notes** for every submission. Apple asked for it once under
Guideline 2.1; a standing copy in the Notes field prevents them asking again.

The field is plain text with a **4,000-character limit** — keep the body under
it, and keep markdown out of it (Apple shows asterisks literally).

---

DEVICES TESTED
Physical iPhone 14 running iOS 18.7.8, installed via TestFlight.

WHAT THE APP DOES
Only Macros is a manual macro logger for people who already know their numbers. The main screen has three fields (grams of carbohydrate, protein and fat), an "Add to today" button, and the day's totals and calories (carbs x 4 + protein x 4 + fat x 9). A calendar (bottom-right button) shows past days; tapping a day shows its breakdown, and the pencil on it edits that day's entries.

New in 1.0.3: an optional Runner fueling page (bottom-left button). From a short profile and the user's weekly training, it calculates daily calorie, carbohydrate, protein and fat targets using published sports-nutrition research. It never appears on the main screen.

HOW TO TEST
No account, login, purchase or setup. Everything works offline on first launch.
1. Type numbers into C, P and F and tap "Add to today".
2. Tap the calendar button (bottom-right), then any day, then its pencil to edit it.
3. Tap the runner button (bottom-left). Fill in the profile with any values and choose "Lose" as the goal, then enter a weekly mileage: today's targets appear. Scroll the distance beside the calories and the targets follow it. The arrows step through the next six days.
4. To see a safety guardrail: tap the edit button on the profile card and choose "One in the hip (femoral neck), pelvis or sacrum" under bone stress injuries. The targets return to maintenance and the page explains why.

DATA AND NETWORK
The app makes no network requests and contains no analytics, advertising, crash reporting or other third-party SDKs. Food entries and the runner profile are stored only on the device and are deleted with the app. App Privacy is declared as "Data Not Collected".

HEALTH AND FITNESS
The app is not a medical device and does not diagnose or treat any condition. The runner page states that its figures are estimates from published research, not medical advice, and lists its sources in the app, including the ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada joint position statement on nutrition and athletic performance (2016) and the IOC consensus statement on Relative Energy Deficiency in Sport and its Clinical Assessment Tool (2023).

The page is designed to prevent under-fuelling, a recognised risk among runners, rather than to promote weight loss:
- A weight-loss goal is capped at a 300 kcal/day deficit, applied only on rest and easy days. Workout and long-run days are always at maintenance.
- No deficit is set for users under 18, for users reporting a bone stress injury history or missed periods that the IOC tool treats as a primary warning sign, or when the user's own logged food shows low energy availability. The page explains why and points the user to a doctor, never to eating less.
- There are no body-weight or body-size targets, no weight-loss promises, and no before/after or body-image content.
- The injury and menstrual questions stay on the device, and the menstrual question is optional.

The app contains no food database and no licensed or third-party content. All code and artwork is original.
