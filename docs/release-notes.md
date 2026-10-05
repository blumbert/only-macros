# Release notes — Only Macros

The text below goes into **App Store Connect → the version → What's New in This
Version**. Newest first. Apple requires this field on every update, and it is
shown to users on the App Store listing, so it stays plain and describes only
what someone would notice.

---

## How to ship

Every change goes out as an App Store release. The app has no update
mechanism of its own — it makes no network requests at all, which is what
keeps App Privacy at "Data Not Collected". (Over-the-air updates were tried
for 1.0.3 and taken back out for exactly that reason: `expo-updates` requires
declaring Crash Data.)

1. Bump `version` in app.json. A version that's already live on the store is
   rejected on upload (ITMS-90062).
2. `npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive`
   — builds, then uploads to App Store Connect. The build lands in TestFlight.
3. In App Store Connect: new version, select the build, paste What's New from
   below, update the review notes if the app changed, submit for review.

---

## 1.0.4

Runner fueling now shows the day's mileage right beside your calorie target.
Scroll it to what you're actually running and the calories and macros follow.
Until you change it, it's what's left of your weekly mileage spread over the
running days left, so a long day early in the week shortens the rest and a
skipped day lengthens them.

---

## 1.0.3

New for runners: Runner fueling. Tap the button in the bottom-left for daily
calorie and macro targets that follow your training — more carbs on workout and
long-run days — built on published sports-nutrition research. It won't put you
into a deficit when there are warning signs of under-fuelling, and like
everything else in the app, what you enter stays on your phone.

Also: the calendar's monthly average now leaves out today until the day is
over, so it's no longer pulled down by a day you're still logging.

---

## 1.0.2

Edit any day from the calendar.

Tap a day to see its breakdown, then the pencil at the top right of that card.
From there you can type the day's total in directly, add macros to a day you
forgot to log, or delete an entry you got wrong.

---

## 1.0.1

Fixed a bug that could leave the app on an empty screen at launch, and corrected
the layout on iPad.
