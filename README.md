# Macros

A one-screen macro tracker. Type carbs, protein and fat, tap add, and the day's
totals and calories update. A calendar button in the bottom right opens a month
view with each day's macros and calories.

Built with Expo (React Native) so the same code ships to the App Store and Play
Store, and so iOS builds can be produced from Windows via EAS.

## Running it

```bash
npm start
```

Then scan the QR code with **Expo Go** on your phone (App Store / Play Store).
`npm run web` opens it in a browser, which is handy for checking layout but not
representative of the real thing.

### Why SDK 56 and not 57

Expo Go on the App Store only supports the newest SDK that Apple has actually
approved. When this was set up, SDK 57 had shipped but its Expo Go build was
still in review, so a 57 project gave "Project is incompatible with this version
of Expo Go" on a fully up-to-date phone. Pinning to 56 sidesteps that.

None of the app's code is version-specific. Once Expo Go for 57 is on the App
Store, `npm install expo@^57.0.0 && npx expo install --fix` bumps it. This only
affects Expo Go — an EAS build bundles its own runtime and doesn't care.

## How it works

| File | What it does |
| --- | --- |
| `App.tsx` | The single screen: three inputs, add button, totals, calendar FAB |
| `src/useLog.ts` | Holds the log, persists it, and handles the midnight rollover |
| `src/storage.ts` | AsyncStorage read/write plus the totals and calorie math |
| `src/date.ts` | Local-timezone day keys (`YYYY-MM-DD`) and date formatting |
| `src/theme.ts` | Light/dark palettes, macro colours, number formatting |
| `src/components/` | `MacroField`, `TotalsPanel`, `CalendarSheet` |

**Calories** are `carbs × 4 + protein × 4 + fat × 9`.

**Days** are keyed by local calendar date, never by UTC, so the day boundary is
your midnight wherever you are. Rollover is detected two ways: a timer armed for
the next local midnight (covers the app being open across the boundary) and an
`AppState` check on every return to the foreground (covers the phone being
asleep at midnight, and also catches timezone or clock changes). Adds read the
clock at the moment of the tap, so an entry at 11:59:59 lands on the right day.

**Entries** are stored individually rather than as a running total, which is why
undo can remove one add without the totals drifting.

## Shipping to the App Store from Windows

You do not need a Mac — EAS builds on Apple hardware in the cloud.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile production
eas submit --platform ios
```

Before the first submit:

1. Change `ios.bundleIdentifier` in `app.json` if you want something other than
   `com.lumbert.macros` — it has to be globally unique and cannot be changed
   after the app is created in App Store Connect.
2. Replace `assets/icon.png` with a real 1024×1024 icon (no transparency, no
   rounded corners — Apple applies the mask).
3. Create the app record at appstoreconnect.apple.com, and prepare screenshots
   for a 6.9" iPhone.
4. Fill in App Privacy: this app collects nothing and sends nothing anywhere —
   all data stays in local storage on the device.
