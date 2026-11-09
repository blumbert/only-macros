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
A manual macro logger: three fields (carbs, protein, fat in grams), "Add to today", and the day's totals and calories. The menu (top right) has Calendar, Scan a label, Search with AI, Saved foods, Runner fueling and Premium.

Scan a label reads a nutrition facts photo with Apple's on-device Vision text recognition; the photo is never uploaded or kept. HealthKit (optional, Runner fueling): read access to workouts only, using the date and distance of runs from the last 7 days to set each day's mileage. Nothing is written to Health and Health data never leaves the device.

PREMIUM (NEW IN 1.0.7)
An auto-renewable subscription group: com.lumbert.macros.premium.monthly ($3.99) and com.lumbert.macros.premium.yearly ($29.99). It unlocks Search with AI and Runner fueling, tagged "Premium" in the menu; everything else stays free. People who used Runner fueling before 1.0.7 keep it free, so on a fresh install it opens the paywall. The paywall shows each plan's length and App Store price, the renewal terms, Terms of Use and Privacy Policy links, and Restore purchases.

Search with AI sends only the typed description to our server, which checks the subscription and asks Anthropic's Claude (with web search) for the nutrition per serving and the number of servings. The result fills the same editable form as a scanned label, with its sources and a note that it is an estimate. 60 searches a month per subscriber.

HOW TO TEST
No account or login. Use a Sandbox Apple Account for Premium.
1. Type numbers into C, P and F and tap "Add to today".
2. Menu > Scan a label: photograph any nutrition label, set 2 servings, switch on "Save to my foods", name it, tap "Add to today".
3. Main screen: tap "Saved food" under the fields and pick it.
4. Menu > Calendar, any day, then its pencil to edit it.
5. Menu > Premium: subscribe to either plan. The Premium tags disappear.
6. Menu > Search with AI: type "half a quart of Ben & Jerry's Cookie Dough ice cream" and tap the sparkles button. After 20 to 40 seconds the macros, servings and sources appear; tap "Add to today".
7. Menu > Runner fueling: fill in the profile, choose "Lose" as the goal and enter a weekly mileage. Scroll the distance beside the calories and the targets follow it. For a guardrail, choose "One in the hip (femoral neck), pelvis or sacrum" under bone stress injuries: targets return to maintenance and the page explains why.
8. Same page: "Connect Apple Health", allow Workouts. Runs from the last 7 days fill in those days. With no runs in Health the card says so; that is expected.

DATA AND NETWORK
No analytics, advertising or crash-reporting SDKs, and no tracking. The log, runner profile, photos and Health distances stay on the device. Network use is only RevenueCat (subscription status under an anonymous ID; there are no accounts) and Search with AI (the typed text, to our server and Anthropic). App Privacy declares Purchase History and Other User Content, not linked to the user and not used for tracking.

HEALTH AND FITNESS
Not a medical device. The runner page says its figures are estimates from published research, not medical advice, and lists its sources, including the ACSM/AND/DC position statement on nutrition and athletic performance (2016) and the IOC REDs consensus statement (2023). It is built to prevent under-fuelling, not to promote weight loss:
- A weight-loss goal is capped at a 300 kcal/day deficit on rest and easy days only; workout and long-run days stay at maintenance.
- No deficit for users under 18, with a bone stress injury history or missed periods the IOC tool treats as a primary warning sign, or when their logged food shows low energy availability. The page points them to a doctor, never to eating less.
- No body-weight targets, weight-loss promises or body-image content. The menstrual question is optional.
