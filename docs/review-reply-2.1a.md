# Reply to Apple — Guideline 2.1(a), submission a932b77e

Paste the body below into Resolution Center. Fill in the two bracketed values
first: the iPad model and iPadOS version it was verified on (Settings > General >
About), and the build number if it is not 5.

---

Thank you for the detailed report — the device and OS information was enough to
identify and reproduce the cause.

**Cause**

The app could show an empty screen on launch. Two independent code paths were
each capable of withholding the interface:

1. The safe-area library the app uses renders none of its children until the
native layer reports safe-area insets back to JavaScript. If that callback is
delayed, nothing at all is drawn.

2. A second, separate gate in our own code withheld the interface until locally
stored data had finished loading.

Either one alone produces the reported behaviour: with no interface on screen,
there is no way to enter or add macros. This is also consistent with the problem
appearing on iPad while not reproducing on the iPhone hardware used during
development, since the timing of that native callback differs by platform.

**Fix, in build [5]**

1. The safe-area provider now renders immediately from window metrics captured
at launch instead of waiting for the native callback.

2. The storage gate has been removed. The screen is interactive from the first
frame, and stored entries are merged into memory when the read completes, so
nothing entered in the interim is lost.

3. Content is now width-capped and centred, so the layout is correct on iPad in
both portrait and landscape.

**Verification**

The new build was installed from TestFlight and tested on a physical iPad
running iPadOS [FILL IN], and on a physical iPhone 14 running iOS [FILL IN]. On
both devices the app launches directly to the entry screen, macros can be typed
and added, the daily totals and calorie figure update, and the calendar shows
per-day history.

No functionality was added or changed beyond the fixes described above.
