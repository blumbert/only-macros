# Privacy Policy — Only Macros

_Last updated: 9 November 2026_

## Short version

Everything you log stays on your phone. There is no account, no analytics and
no advertising.

Two optional parts of Only Macros Premium use the network:

- **AI food search** sends the description you type (for example "half a quart
  of Hornstra Farms ice cream") to the app's server and on to Anthropic's
  Claude, which looks up the nutrition and sends back an estimate.
- **Subscribing** goes through Apple, and the app checks your subscription with
  RevenueCat using a random ID that isn't tied to your name, email or Apple ID.

If you don't use AI food search, the app sends nothing anywhere except that
subscription check.

## What the app stores on your phone

The macro entries you type — carbohydrates, protein and fat, and the date each
entry was made — are saved in the app's own storage on your device.

If you use the Runner fueling page, the profile and training you enter there
are saved the same way: sex, age, weight, body fat if you give it, the kind of
day job you have, your goal, your bone stress injury history, your menstrual
cycle if you choose to answer, and your weekly mileage and training days. They
are used only to calculate your targets, on your phone, and are never sent
anywhere.

Foods you save — a name, its carbohydrates, protein and fat per serving, and a
serving size if you give one — are saved the same way, and so is the name of a
food when you add it to a day.

If you connect Apple Health, the distance it reports for each recent day is
saved the same way.

## AI food search (Premium)

When you run an AI search, the app sends two things to the app's server, which
runs on Cloudflare:

- the description you typed, and
- the random subscription ID described below, so the server can confirm you
  subscribe and count your searches against the monthly limit.

The server passes your description to Anthropic's Claude API, which may search
the web for the product's nutrition label and replies with an estimate. Your
description is the only thing Anthropic receives: not your ID, your log, your
runner profile or anything else from your phone. Anthropic handles it under its
commercial API terms, which do not allow it to be used to train its models.

The server does not keep what you typed. It keeps only a count of how many
searches each subscription ID has made this month, which it deletes after
about 40 days, and remembers for ten minutes whether that ID subscribes.

Don't type anything into AI search that you wouldn't want to share, such as
your name or health conditions. It only needs a description of the food.

## Subscriptions

Premium is an auto-renewing subscription sold by Apple. Apple handles the
payment; the app and the developer never see your card or Apple ID.

The app uses RevenueCat to check whether you subscribe. RevenueCat gives the app
a random ID and receives the record of your purchases from Apple (the product,
dates and price) under that ID. It is not linked to your name, email or any
contact information. RevenueCat's privacy policy is at
https://www.revenuecat.com/privacy.

## Apple Health

If you connect Apple Health on the Runner fueling page, the app reads your
running workouts from it — only their date and distance — to fill in how far
you ran on each of the last seven days. That is used to calculate your targets
on your phone and is never sent anywhere. The app does not write anything to
Apple Health, and it reads no other health data. You can stop it in the app,
and turn off its access any time in Settings › Health › Data Access & Devices.

## Camera and photos

If you scan a nutrition facts label, the app asks to use your camera, or lets
you choose a photo from your library. The photo is read on your phone by
Apple's built-in text recognition, only to find the numbers on the label. It
is not uploaded anywhere, and the app does not keep it: only the numbers you
choose to add or save are stored. Camera and photo access can be turned off at
any time in your phone's Settings; everything else in the app keeps working.

## Backups

Your data may be included in an iCloud or iTunes backup of your phone if you
have device backups enabled. That backup is controlled entirely by Apple and by
your own device settings; the developer has no access to it.

## Third parties

- **Anthropic** (Claude): receives the descriptions you type into AI food
  search, as described above.
- **Cloudflare**: runs the app's AI search server.
- **RevenueCat**: checks subscriptions, as described above.

The app includes no analytics SDK, no advertising SDK, no crash reporting, and
no social or tracking integrations. Nothing is used to track you across other
apps or websites.

## Deleting your data

Deleting the app removes everything stored on your device permanently. The
server's monthly search count expires on its own. To have your purchase record
removed from RevenueCat, contact the developer at the address below.

## Children

Only Macros is not directed at children, and the app asks no one for personal
information.

## Changes

If this policy ever changes, the updated version will be published at this same
address with a new date at the top.

## Contact

Questions about this policy can be sent to the address listed on the App Store
listing for Only Macros.
