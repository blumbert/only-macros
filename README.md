# Only Macros

A one-screen macro tracker. Type carbs, protein and fat, tap add, and the day's
totals and calories update. A calendar button in the bottom right opens a month
view with each day's macros and calories.

The App Store listing is **Only Macros**; the home screen icon reads **Macros**.
Those are separate fields: `expo.name` in `app.json` names the App Store Connect
record, and `ios.infoPlist.CFBundleDisplayName` is what iOS prints under the
icon. (Android takes its launcher label from `expo.name`, so it shows the long
one — change `expo.name` if you'd rather it matched.)

Built with Expo (React Native) so the same code ships to the App Store and Play
Store, and so iOS builds can be produced from Windows via EAS.

## Running it

```bash
npm start
```

Then scan the QR code with **Expo Go** on your phone (App Store / Play Store).
`npm run web` opens it in a browser, which is handy for checking layout but not
representative of the real thing.

### Why SDK 54 and not the newest one

Expo Go on the App Store is stuck on **54.0.2 (released 2025-09-23)**, so it can
only open SDK 54 projects. SDKs 55, 56 and 57 all exist, but their Expo Go
builds were never published — a newer project just gives "Project is
incompatible with this version of Expo Go" on a fully up-to-date phone.

Don't trust `sdkVersions[x].iosClientVersion` in Expo's version API; those are
the clients Expo built, not the ones Apple published. The field that actually
answers the question is `expoGoSdkVersion`:

```bash
curl -s https://api.expo.dev/v2/versions/latest | grep -o '"expoGoSdkVersion":"[^"]*"'
```

Cross-check it against the live App Store listing:

```bash
curl -s "https://itunes.apple.com/lookup?id=982107779" | grep -o '"version":"[^"]*"'
```

None of the app's code is version-specific, so `npm install expo@^NN.0.0 &&
npx expo install --fix` moves it whenever Expo Go catches up. This constraint
only exists because of Expo Go — an EAS build bundles its own runtime and can
be on any SDK.

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

No Mac needed — EAS builds on Apple hardware in the cloud. `eas.json` is already
configured, `eas-cli` is installed, and `npx expo-doctor` passes 18/18.

```bash
eas login
eas build --platform ios --profile production
eas submit --platform ios --latest
```

`eas login` uses an **Expo** account (free, unrelated to Apple). The build step
asks for your Apple ID and generates the signing certificate and provisioning
profile for you; let it. First build takes roughly 15-25 minutes including queue.

Then, at appstoreconnect.apple.com, fill in the listing and hit **Submit for
Review**:

- **Name**: Only Macros. **Category**: Health & Fitness.
- **Screenshots**: one 6.9" iPhone set is the minimum. Take them on a real
  device, or in the iOS simulator if you ever get Mac access.
- **App Privacy**: "Data Not Collected". The app has no network code at all —
  everything lives in `AsyncStorage` on the device.
- **Support URL** is required. A GitHub repo page or a one-page site is fine.
- **Sign-in**: say the app does not require one, and leave demo credentials blank.

### Version bumps

`appVersionSource` is `remote`, so EAS owns the build number and increments it
automatically. Bump `expo.version` in `app.json` only for user-facing releases
(1.0.0 → 1.0.1); never touch `buildNumber` by hand.

### Regenerating the icons

`assets/*.png` are generated, not drawn by hand — three pills in the carb,
protein and fat colours on the app's dark ground. The generator lives at
`scripts/make-icons.js`:

```bash
node scripts/make-icons.js ./assets
```

Colours and bar heights are the `BARS` array at the top. `icon.png` is written
as RGB with no alpha channel on purpose: App Store Connect rejects app icons
that carry one.
