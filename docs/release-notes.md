# Release notes — Only Macros

The text below goes into **App Store Connect → the version → What's New in This
Version**. Newest first. Apple requires this field on every update, and it is
shown to users on the App Store listing, so it stays plain and describes only
what someone would notice.

---

## How to ship

**JS-only fix or tweak** (from 1.0.3 on) — goes straight to phones on the
same app version, no build, no review:

```sh
npx eas-cli@latest update --channel production --message "what changed"
```

**New App Store release** — anything with a new native module, a new feature
App Review should see, or when the version should change:

1. Bump `version` in app.json. Over-the-air updates only reach phones on the
   version they were built for, so a new version starts a new update line.
2. `npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive`
3. In App Store Connect: new version, select the build, paste What's New
   from below, update review notes if the app changed, submit for review.

---

## 1.0.3

The calendar's monthly average now leaves out today until the day is over, so
it's no longer pulled down by a day you're still logging.

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
