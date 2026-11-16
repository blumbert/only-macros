# App Review notes — Only Macros

Paste everything below the line into **App Store Connect → App Review
Information → Notes** for every submission. Apple asked for it once under
Guideline 2.1; a standing copy in the Notes field prevents them asking again.

The field is plain text with a **4,000-character limit** — keep the body under
it, and keep markdown out of it (Apple shows asterisks literally).

---

DEVICES TESTED
iPhone 14, iOS 18.7.8.

WHAT THE APP DOES
A manual macro logger: carbs, protein and fat fields, "Add to today", and the day's totals. Top right: a scan button, a Runner fueling button and the menu (Calendar, Saved foods, Smart Search, Premium).

The scan button opens the app's camera, with a Choose photo button; the photo is read by Apple's on-device Vision text recognition and never uploaded or kept. HealthKit (optional, Runner fueling): read access to workouts only. The last 7 days' runs give distance; other workouts give cross-training. Nothing is written to Health and Health data never leaves the device.

PREMIUM
An auto-renewable subscription group: com.lumbert.macros.premium.monthly ($3.99) and com.lumbert.macros.premium.yearly ($29.99). It unlocks Smart Search (tagged "Premium" in the menu) and Runner fueling; everything else stays free. People who used Runner fueling before 1.0.7 keep it free, so on a fresh install it opens the paywall. The paywall shows each plan's length and price, renewal terms, Terms of Use and Privacy Policy links, and Restore purchases.

Smart Search sends only the typed description to our server, which checks the subscription and asks Anthropic's Claude (with web search) for the nutrition. The result fills the same editable form as a scanned label, with sources, marked as an estimate. 60 searches a month.

HOW TO TEST
No login needed; Premium uses a Sandbox account.
1. Type numbers into C, P and F and tap "Add to today".
2. Tap the scan button (top right): the camera opens. Photograph a nutrition label (or Choose photo), set 2 servings, switch on "Save to my foods", name it, tap "Add to today".
3. Main screen: tap "Saved food" under the fields and pick it.
4. Menu > Calendar, any day, then its pencil to edit it.
5. Menu > Premium: subscribe to either plan.
6. Menu > Smart Search: type "half a quart of Ben & Jerry's Cookie Dough ice cream" and tap the sparkles button. After 20–40 seconds, tap "Add to today".
7. Tap the Runner fueling button: fill in the profile, choose "Lose" as the goal and enter the week's total miles. Change the day's miles or cross-training minutes and the targets follow; "Use Plan" or "Use Health" puts them back. For a guardrail, choose "One in the hip (femoral neck), pelvis or sacrum" under bone stress injuries: targets return to maintenance.
8. Same page: "Connect Apple Health", allow Workouts. The last 7 days' workouts fill in those days. With none in Health it says so; that is expected.

DATA AND NETWORK
No analytics, advertising or crash-reporting SDKs, and no tracking. The log, runner profile, photos and Health workouts stay on the device. Network use is only RevenueCat (subscription status under an anonymous ID; there are no accounts), Smart Search (the typed text, to our server and Anthropic) and an expo-updates check on our own server for signed JavaScript bug-fix updates. Holding the version line at the bottom of the Premium page for 2 seconds moves the device to our pre-release update channel for developer testing; it unlocks nothing. App Privacy declares Purchase History and Other User Content, not linked to the user and not used for tracking.

HEALTH AND FITNESS
Not a medical device. The runner page says its figures are estimates from published research, not medical advice, and lists its sources, including the ACSM/AND/DC position statement (2016) and the IOC REDs consensus statement (2023). It is built to prevent under-fuelling, not to promote weight loss:
- A weight-loss goal is capped at a 300 kcal/day deficit on rest and easy days only; workout and long-run days stay at maintenance.
- No deficit for users under 18, with a bone stress injury history or missed periods the IOC tool treats as a primary warning sign, or when their logged food shows low energy availability. The page points them to a doctor, never to eating less.
- No body-weight targets, weight-loss promises or body-image content. The cycle question is optional.
