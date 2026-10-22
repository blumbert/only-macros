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
Only Macros is a manual macro logger for people who already know their numbers. The main screen has three fields (grams of carbohydrate, protein and fat), an "Add to today" button, and the day's totals and calories (carbs x 4 + protein x 4 + fat x 9). Everything else is in the menu (top-right button): Calendar, Scan a label, Saved foods and Runner fueling.

Scan a label reads the carbohydrate, protein and fat off a photo of a nutrition facts label using Apple's on-device Vision text recognition, multiplies them by the number of servings, and adds them to today or an earlier day. The photo is never uploaded or kept. Saved foods holds foods with their macros per serving, which can be picked under the main screen's fields.

HealthKit (optional, Runner fueling page): the app requests read access to workouts only, and uses the date and distance of running workouts from the last 7 days to set each day's mileage, which sets that day's calorie target and the 7-day energy availability. It writes nothing to Health, reads no other data types, and the data never leaves the device.

HOW TO TEST
No account, login, purchase or setup; everything works offline.
1. Type numbers into C, P and F and tap "Add to today".
2. Menu > Scan a label: take or choose a photo of any nutrition facts label. The numbers appear in editable fields; set 2 servings, switch on "Save to my foods", name it, and tap "Add to today". The arrows at the top move the day back.
3. On the main screen, tap "Saved food" under the fields and pick that food; the fields fill in, and the servings buttons change them.
4. Menu > Calendar, then any day, then its pencil to edit it.
5. Menu > Runner fueling. Fill in the profile with any values and choose "Lose" as the goal, then enter a weekly mileage: today's targets appear. Scroll the distance beside the calories and the targets follow it; the arrows step back 7 days and ahead 6. To see a safety guardrail, edit the profile and choose "One in the hip (femoral neck), pelvis or sacrum" under bone stress injuries: the targets return to maintenance and the page explains why.
6. On the same page, tap "Connect Apple Health" and allow Workouts. Running workouts in Health from the last 7 days fill in those days' distances. With no runs in Health, the card says it can't see any and the plan's distances stay; that is expected.

DATA AND NETWORK
The app makes no network requests and contains no analytics, advertising or crash-reporting SDKs. Food entries, the runner profile and distances read from Health are stored only on the device and are deleted with the app. App Privacy is declared as "Data Not Collected".

HEALTH AND FITNESS
The app is not a medical device and does not diagnose or treat any condition. The runner page states that its figures are estimates from published research, not medical advice, and lists its sources in the app, including the ACSM/AND/DC position statement on nutrition and athletic performance (2016) and the IOC REDs consensus statement (2023).

The page is designed to prevent under-fuelling, a recognised risk among runners, rather than to promote weight loss:
- A weight-loss goal is capped at a 300 kcal/day deficit, applied only on rest and easy days. Workout and long-run days are always at maintenance.
- No deficit is set for users under 18, for users reporting a bone stress injury history or missed periods that the IOC tool treats as a primary warning sign, or when the user's own logged food shows low energy availability. The page explains why and points the user to a doctor, never to eating less.
- No body-weight or body-size targets, weight-loss promises or body-image content.
- The injury and menstrual questions stay on the device, and the menstrual question is optional.

The app contains no food database and no third-party content. Its artwork is original.
