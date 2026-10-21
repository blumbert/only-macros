import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, formatTime, fromDayKey, shortDate, type DayKey } from '../date';
import { healthAvailable, readRecentRuns, requestHealthAccess } from '../fueling/health';
import { distanceSource, mergeDayKm } from '../fueling/healthDays';
import {
  dayTargets,
  loggedEnergyAvailability,
  type DayTargets,
  type Guard,
  type Profile,
} from '../fueling/model';
import { useRunner, type Units } from '../fueling/profile';
import { RULES, SOURCES, type DayType } from '../fueling/rules';
import {
  checkWeek,
  KM_PER_MI,
  planFor,
  weekFor,
  weekKey,
  type DayKm,
} from '../fueling/training';
import type { Log } from '../storage';
import { formatNumber, MACROS, useTheme } from '../theme';
import { MileageWheel } from './MileageWheel';
import { RunnerProfileForm } from './RunnerProfileForm';
import { TrainingWeekEditor } from './TrainingWeekEditor';

type Props = {
  visible: boolean;
  onClose: () => void;
  log: Log;
  today: DayKey;
};

const DAY_LABEL: Record<DayType, string> = {
  rest: 'Rest day',
  easy: 'Easy day',
  workout: 'Workout day',
  long: 'Long run day',
};

/**
 * How far ahead the targets card goes. A week covers a meal-prep cycle;
 * further out, the training plan behind the numbers is mostly a guess.
 */
const MAX_DAYS_AHEAD = 6;

/**
 * How far back. Exactly the days the recent energy availability reads, so the
 * distance actually run on each of them can be set and that number gets
 * sharper; further back changes nothing the page shows.
 */
const MAX_DAYS_BACK = RULES.loggedEa.lookbackDays;

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function dayHeading(day: DayKey, offset: number): string {
  if (offset === 0) return 'TODAY';
  if (offset === 1) return 'TOMORROW';
  if (offset === -1) return 'YESTERDAY';
  return `${WEEKDAYS[fromDayKey(day).getDay()]} · ${shortDate(day).toUpperCase()}`;
}

const DAY_NOUN: Record<DayType, string> = {
  rest: 'a rest day',
  easy: 'an easy day',
  workout: 'a workout day',
  long: 'a long run day',
};

/** Why the goal was overridden. Plain, and not a lecture. */
function blockCopy(guard: Guard, loggedEa: number | null): string {
  switch (guard) {
    case 'minor':
      return 'You’re under 18, so the page won’t set a deficit.';
    case 'boneHistory':
      return 'Your bone stress injury history is a primary warning sign of under-fuelling in the IOC’s REDs assessment tool. Worth seeing a sports doctor before cutting.';
    case 'missedPeriods':
      return 'Missing 3 or more periods in a row is a primary warning sign of under-fuelling in the IOC’s REDs assessment tool. See a doctor about it — the app can’t tell what’s causing it.';
    case 'loggedLowEa':
      return `Your recent logging puts energy availability at ${loggedEa}, under the ${RULES.ea.low} linked to low energy availability. Targets stay at maintenance until that comes up.`;
    default:
      return '';
  }
}

function warningCopy(guard: Guard, t: DayTargets, loggedEa: number | null): string | null {
  switch (guard) {
    case 'boneHistoryMinor':
      return 'One bone stress injury in the last 2 years is a secondary warning sign. A deficit is still allowed — keep an eye on it.';
    case 'irregularPeriods':
      return 'Periods more than 35 days apart can be an early sign of under-fuelling. Worth raising with a doctor.';
    case 'loggedReducedEa':
      return `Your recent logging puts energy availability at ${loggedEa}, below the ${RULES.ea.adequate} considered adequate.`;
    case 'reducedEa':
      return `This target puts energy availability at ${t.ea}, below the ${RULES.ea.adequate} considered adequate — fine for a slow cut, not something to hold for months.`;
    case 'fatBelowFloor':
      return 'Fat is below 20% of the day’s energy.';
    default:
      return null;
  }
}

export function RunnerSheet({ visible, onClose, log, today }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const runner = useRunner();
  const [editingProfile, setEditingProfile] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const saveProfile = (profile: Profile, units: Units) => {
    runner.setProfile(profile, units);
    setEditingProfile(false);
  };

  const profile = runner.profile;

  // Apple Health, when connected, speaks for each recent day's distance; a
  // distance set by hand still wins over it.
  const canUseHealth = useMemo(healthAvailable, []);
  const { setHealth } = runner;
  const healthConnected = canUseHealth && runner.health.connected;
  const healthDays = healthConnected ? runner.health.days : null;
  const dayKm = useMemo(
    () => mergeDayKm(runner.dayKm, healthDays, today),
    [runner.dayKm, healthDays, today],
  );
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const syncHealth = useCallback(async () => {
    setHealthBusy(true);
    setHealthError(null);
    try {
      const read = await readRecentRuns(today);
      setHealth({ connected: true, days: read.visible ? read.days : {}, syncedAt: Date.now() });
    } catch {
      setHealthError('Couldn’t read Apple Health just now. Try again in a moment.');
    } finally {
      setHealthBusy(false);
    }
  }, [today, setHealth]);

  // Every time the page opens, so the days are as fresh as the runs.
  useEffect(() => {
    if (visible && runner.hydrated && healthConnected) void syncHealth();
  }, [visible, runner.hydrated, healthConnected, syncHealth]);

  const connectHealth = async () => {
    setHealthBusy(true);
    setHealthError(null);
    try {
      await requestHealthAccess();
    } catch {
      setHealthBusy(false);
      setHealthError('Couldn’t open Apple Health’s permission screen.');
      return;
    }
    // Connecting flips `healthConnected`, which runs the first sync.
    setHealth({ connected: true, days: {} });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => setEditingProfile(false)}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
        ]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Runner fueling</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.done, { color: c.text }]}>Done</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.content}>
              {!runner.hydrated ? null : !profile || editingProfile ? (
                <>
                  {!profile ? (
                    <Text style={[styles.intro, { color: c.muted }]}>
                      Daily calorie and macro targets for runners, from published sports-nutrition
                      research. They move with your training — more carbs on workout and long-run
                      days — and they won&apos;t put you into a deficit when the warning signs of
                      under-fuelling are there.
                    </Text>
                  ) : null}
                  <RunnerProfileForm
                    initial={profile}
                    units={runner.units}
                    onSave={saveProfile}
                    onCancel={profile ? () => setEditingProfile(false) : undefined}
                  />
                </>
              ) : (
                <>
                  <DayTargetsCard
                    profile={profile}
                    units={runner.units}
                    log={log}
                    today={today}
                    weeks={runner.weeks}
                    dayKm={dayKm}
                    manualKm={runner.dayKm}
                    healthDays={healthDays}
                    onSetKm={runner.setDayKm}
                  />
                  {canUseHealth ? (
                    <HealthCard
                      connected={healthConnected}
                      visible={Object.keys(runner.health.days).length > 0}
                      syncedAt={runner.health.syncedAt}
                      busy={healthBusy}
                      error={healthError}
                      onConnect={() => void connectHealth()}
                      onRefresh={() => void syncHealth()}
                      onStop={() => {
                        setHealthError(null);
                        setHealth({ connected: false, days: {} });
                      }}
                    />
                  ) : null}
                  <TrainingWeekEditor
                    weeks={runner.weeks}
                    today={today}
                    units={runner.units}
                    onChange={runner.setWeek}
                  />
                  <LastWeek
                    profile={profile}
                    log={log}
                    today={today}
                    weeks={runner.weeks}
                    dayKm={dayKm}
                    fromHealth={!!healthDays && Object.keys(healthDays).length > 0}
                  />
                  <ProfileSummary
                    profile={profile}
                    units={runner.units}
                    onEdit={() => setEditingProfile(true)}
                  />
                  <Signs />

                  <Pressable
                    onPress={() => setShowSources((s) => !s)}
                    accessibilityRole="button"
                    style={styles.sourcesToggle}
                  >
                    <Text style={[styles.sourcesToggleText, { color: c.muted }]}>
                      {showSources ? 'Hide sources' : 'Sources'}
                    </Text>
                    <Ionicons
                      name={showSources ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={c.muted}
                    />
                  </Pressable>
                  {showSources ? (
                    <View style={styles.sources}>
                      {Object.values(SOURCES).map((s) => (
                        <Text key={s} style={[styles.source, { color: c.faint }]}>
                          {s}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <Text style={[styles.disclaimer, { color: c.faint }]}>
                    Estimates from published research, not medical advice. Everything stays on
                    this phone.
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function DayTargetsCard({
  profile,
  units,
  log,
  today,
  weeks,
  dayKm,
  manualKm,
  healthDays,
  onSetKm,
}: {
  profile: Profile;
  units: Units;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
  /** Every known distance: hand-set over Apple Health. */
  dayKm: DayKm;
  /** Just the hand-set ones, to say where a day's distance came from. */
  manualKm: DayKm;
  healthDays: Record<DayKey, number> | null;
  onSetKm: (day: DayKey, km: number | null) => void;
}) {
  const { c } = useTheme();
  // Days from today: ahead for meal prep, back to set what was actually run.
  // Resets to today whenever the day rolls over.
  const [offset, setOffset] = useState(0);
  const past = offset < 0;
  useEffect(() => setOffset(0), [today]);
  // The distance under the wheel while it's turning, in the runner's unit.
  const [preview, setPreview] = useState<number | null>(null);

  const day = addDays(today, offset);
  useEffect(() => setPreview(null), [day]);
  const plan = planFor(weeks, day, dayKm, today);
  const found = weekFor(weeks, day);
  const problem = found ? checkWeek(found.week) : null;
  // A later week that hasn't been entered borrows the most recent one.
  const borrowed = found?.carried && weekKey(day) > weekKey(today) ? found.key : null;

  const header = (
    <View style={styles.dayNav}>
      <Pressable
        onPress={() => setOffset((o) => Math.max(o - 1, -MAX_DAYS_BACK))}
        disabled={offset === -MAX_DAYS_BACK}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
      >
        <Ionicons
          name="chevron-back"
          size={18}
          color={offset === -MAX_DAYS_BACK ? c.faint : c.text}
        />
      </Pressable>
      <Text style={[styles.eyebrow, { color: c.muted }]}>{dayHeading(day, offset)}</Text>
      <Pressable
        onPress={() => setOffset((o) => Math.min(o + 1, MAX_DAYS_AHEAD))}
        disabled={offset === MAX_DAYS_AHEAD}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Next day"
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={offset === MAX_DAYS_AHEAD ? c.faint : c.text}
        />
      </Pressable>
    </View>
  );

  if (!plan || problem) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {header}
        <Text style={[styles.empty, { color: c.faint }]}>
          {plan
            ? 'Finish that week’s training entry below to see these targets.'
            : past
              ? 'No training was entered for that week yet.'
              : 'Enter this week’s training below to see targets.'}
        </Text>
      </View>
    );
  }

  // Energy availability from the log is where the runner is now, so it
  // guards every day shown — tomorrow's targets can't be based on meals that
  // haven't been eaten.
  const logged = loggedEnergyAvailability(profile, log, weeks, today, dayKm);
  const imperial = units === 'imperial';
  const unit = imperial ? 'mi' : 'km';
  const toUnit = (km: number) => Math.round((imperial ? km / KM_PER_MI : km) * 10) / 10;
  const toKm = (v: number) => (imperial ? v * KM_PER_MI : v);
  const km = preview !== null ? toKm(preview) : plan.km;
  const t = dayTargets(profile, { type: plan.type, km }, logged?.ea ?? null);

  const source = distanceSource(day, manualKm, healthDays, today);
  // What "undo" goes back to: Apple Health's figure where it covers the day,
  // the plan everywhere else.
  const underneath = distanceSource(day, {}, healthDays, today);

  const distanceNote =
    source === 'manual'
      ? past
        ? 'The distance you ran this day, as you set it.'
        : 'Distance you set for this day. The rest of the week’s running days split what’s left.'
      : source === 'health'
        ? plan.km > 0
          ? past
            ? 'From your runs in Apple Health. Scroll to change it.'
            : 'Today’s run from Apple Health. The rest of the week’s running days split what’s left.'
          : 'No run in Apple Health this day, so it counts as 0. Scroll if you ran without recording it.'
        : past
          ? 'The plan’s distance for this day. Scroll to what you actually ran — it makes your recent energy availability more accurate.'
          : plan.type === 'long'
            ? 'Your long run, from this week’s plan.'
            : plan.type === 'rest'
              ? 'Rest day. Scroll if you run anyway.'
              : 'What’s left of this week’s mileage, split over the running days left. Scroll to change it.';

  const grams = { c: t.carbsG, p: t.proteinG, f: t.fatG };
  const range = RULES.carbs[plan.type];
  const carbsPerKg = Math.round((t.carbsG / profile.weightKg) * 10) / 10;
  const proteinPerKg = Math.round((t.proteinG / profile.weightKg) * 10) / 10;

  const why: string[] = [
    `Carbs ${carbsPerKg} g/kg — the range for ${DAY_NOUN[plan.type]} is ${range.min}–${range.max}.`,
    t.goal === 'maintain'
      ? `Protein ${proteinPerKg} g/kg.`
      : `Protein ${proteinPerKg} g/kg — higher while ${t.goal === 'lose' ? 'losing' : 'recomping'}, to hold on to muscle.`,
    'Fat fills the rest, kept between 20% and 35% of the day.',
  ];
  if (t.deficitApplied) {
    why.push(
      `${RULES.deficit.kcal} kcal under your maintenance of ${formatNumber(t.maintenanceKcal)}. Deficits only go on rest and easy days, so the loss is slow on purpose.`,
    );
  } else if (t.goal === 'lose') {
    why.push('No deficit — workout and long-run days are fuelled in full.');
  } else if (t.goal === 'recomp') {
    why.push(
      'Recomp keeps energy at maintenance with more protein. Strength training is what drives it, and for trained runners the change is slow.',
    );
  }

  const warnings = t.warnings
    .map((w) => warningCopy(w, t, logged?.ea ?? null))
    .filter((w): w is string => !!w);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {header}
      <Text style={[styles.dayLabel, { color: c.faint }]}>{DAY_LABEL[plan.type]}</Text>
      {borrowed ? (
        <Text style={[styles.why, { color: c.faint }]}>
          That week isn&apos;t entered yet, so this uses the plan from the week of{' '}
          {shortDate(borrowed)}.
        </Text>
      ) : null}

      <View style={styles.kcalRow}>
        <Text style={[styles.kcal, styles.flex, { color: c.text }]}>
          {formatNumber(t.kcal)}
          <Text style={[styles.unit, { color: c.faint }]}> kcal</Text>
        </Text>
        <MileageWheel
          key={day}
          value={toUnit(plan.km)}
          unit={unit}
          onPreview={setPreview}
          onCommit={(v) => onSetKm(day, toKm(v))}
        />
        <Text style={[styles.unit, { color: c.faint }]}>{unit}</Text>
      </View>
      <View style={styles.distanceNote}>
        <Text style={[styles.distanceNoteText, { color: c.faint }]}>{distanceNote}</Text>
        {source === 'manual' ? (
          <Pressable
            onPress={() => onSetKm(day, null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              underneath === 'health'
                ? 'Go back to the distance from Apple Health'
                : 'Go back to the planned distance'
            }
          >
            <Text style={[styles.reset, { color: c.muted }]}>
              {underneath === 'health' ? 'Use Health' : 'Use plan'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.macroRow}>
        {MACROS.map((m) => (
          <View key={m.key} style={styles.macroCol}>
            <Text style={[styles.macroLetter, { color: c.macro[m.key] }]}>{m.letter}</Text>
            <Text style={[styles.macroValue, { color: c.text }]}>
              {grams[m.key]}
              <Text style={[styles.unit, { color: c.faint }]}>g</Text>
            </Text>
          </View>
        ))}
      </View>

      {t.blocks.length && profile.goal === 'lose' ? (
        <View style={[styles.notice, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          <Text style={[styles.noticeTitle, { color: c.text }]}>
            Your goal is to lose, but these targets are at maintenance
          </Text>
          {t.blocks.map((b) => (
            <Text key={b} style={[styles.noticeText, { color: c.muted }]}>
              {blockCopy(b, logged?.ea ?? null)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: c.border }]} />
      {why.map((line) => (
        <Text key={line} style={[styles.why, { color: c.muted }]}>
          {line}
        </Text>
      ))}

      {warnings.length ? (
        <View style={styles.warnings}>
          {warnings.map((w) => (
            <View key={w} style={styles.warningRow}>
              <Ionicons name="information-circle-outline" size={16} color={c.macro.c} />
              <Text style={[styles.warningText, { color: c.muted }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LastWeek({
  profile,
  log,
  today,
  weeks,
  dayKm,
  fromHealth,
}: {
  profile: Profile;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
  dayKm: DayKm;
  /** Whether Apple Health is supplying the recent days' distances. */
  fromHealth: boolean;
}) {
  const { c } = useTheme();
  const logged = loggedEnergyAvailability(profile, log, weeks, today, dayKm);

  const status = !logged
    ? null
    : logged.ea < RULES.ea.low
      ? 'Low'
      : logged.ea < RULES.ea.adequate
        ? 'Reduced'
        : 'Adequate';

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.eyebrow, { color: c.muted }]}>LAST 7 DAYS · ENERGY AVAILABILITY</Text>
      {logged ? (
        <>
          <View style={styles.eaRow}>
            <Text style={[styles.kcal, { color: c.text }]}>
              {logged.ea}
              <Text style={[styles.unit, { color: c.faint }]}> kcal / kg fat-free mass</Text>
            </Text>
            <Text style={[styles.eaStatus, { color: status === 'Adequate' ? c.macro.p : c.macro.c }]}>
              {status}
            </Text>
          </View>
          <Text style={[styles.why, { color: c.muted }]}>
            What you logged over {logged.days} days, minus each day&apos;s running, per kg of
            fat-free mass. {RULES.ea.adequate}+ is adequate; under {RULES.ea.low} is linked to
            low energy availability.
          </Text>
          <Text style={[styles.why, { color: c.faint }]}>
            {fromHealth
              ? 'Each day counts your runs from Apple Health, or a distance you set by hand — step back with the arrow on the card above to change any of them.'
              : `Each day counts its planned distance unless you set what you actually ran — step back with the arrow on the card above to fix any of the last ${MAX_DAYS_BACK} days.`}
          </Text>
          <Text style={[styles.why, { color: c.faint }]}>
            Only as accurate as what you logged. Today isn&apos;t counted until it&apos;s over.
          </Text>
        </>
      ) : (
        <Text style={[styles.empty, { color: c.faint }]}>
          Log food on at least {RULES.loggedEa.minDays} of the last 7 days, with training entered,
          to see how your actual intake compares.
        </Text>
      )}
    </View>
  );
}

/**
 * Connect, refresh or stop Apple Health. Only shown where Health can be read
 * at all — a real iPhone build, not Expo Go or the web.
 */
function HealthCard({
  connected,
  visible,
  syncedAt,
  busy,
  error,
  onConnect,
  onRefresh,
  onStop,
}: {
  connected: boolean;
  /** Whether the last sync could see any runs. */
  visible: boolean;
  syncedAt?: number;
  busy: boolean;
  error: string | null;
  onConnect: () => void;
  onRefresh: () => void;
  onStop: () => void;
}) {
  const { c } = useTheme();
  const checked = connected && syncedAt !== undefined;

  let body: string;
  if (!connected) {
    body =
      'Fill each day’s mileage in from your runs in Apple Health — Apple Watch, and apps like Garmin Connect or Strava that save runs there. Read on this phone only; nothing is sent anywhere.';
  } else if (!checked) {
    body = 'Checking Apple Health for your runs…';
  } else if (visible) {
    body =
      'Each of the last 7 days uses your runs from Apple Health. A day with no run counts as 0 — step back on the card above and scroll a day to override it.';
  } else {
    body =
      'Macros can’t see any runs in Apple Health from the last 2 months, so it’s using your plan. If you’ve recorded runs, allow access in Settings › Health › Data Access & Devices › Macros, then refresh.';
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.healthHeader}>
        <Ionicons name="heart" size={14} color={c.macro.c} />
        <Text style={[styles.eyebrow, { color: c.muted }]}>APPLE HEALTH</Text>
        {checked && !busy ? (
          <Text style={[styles.healthSynced, { color: c.faint }]}>
            Updated {formatTime(syncedAt!)}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.why, { color: c.muted }]}>{body}</Text>
      {error ? <Text style={[styles.why, { color: c.macro.c }]}>{error}</Text> : null}

      <View style={styles.healthActions}>
        {!connected ? (
          <Pressable
            onPress={onConnect}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.healthPrimary,
              { backgroundColor: c.accent, opacity: busy ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.healthPrimaryLabel, { color: c.onAccent }]}>
              Connect Apple Health
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={onRefresh}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.healthSecondary,
                { borderColor: c.border, opacity: busy ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.healthSecondaryLabel, { color: c.text }]}>
                {busy ? 'Reading…' : 'Refresh'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onStop}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.healthStop, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.healthSecondaryLabel, { color: c.muted }]}>
                Stop using Health
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function ProfileSummary({
  profile,
  units,
  onEdit,
}: {
  profile: Profile;
  units: Units;
  onEdit: () => void;
}) {
  const { c } = useTheme();
  const weight =
    units === 'imperial'
      ? `${Math.round(profile.weightKg / 0.45359237)} lb`
      : `${Math.round(profile.weightKg * 10) / 10} kg`;
  const goal = { maintain: 'Maintain', lose: 'Lose', recomp: 'Recomp' }[profile.goal];
  return (
    <View style={[styles.card, styles.summary, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.flex}>
        <Text style={[styles.eyebrow, { color: c.muted }]}>PROFILE</Text>
        <Text style={[styles.summaryText, { color: c.text }]}>
          {profile.sex === 'female' ? 'Female' : 'Male'} · {profile.age} · {weight} · Goal: {goal}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <Ionicons name="create-outline" size={20} color={c.muted} />
      </Pressable>
    </View>
  );
}

function Signs() {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.eyebrow, { color: c.muted }]}>SIGNS OF UNDER-FUELLING</Text>
      <Text style={[styles.why, { color: c.muted }]}>
        Missed or irregular periods, bone stress injuries, getting ill often, fatigue that
        doesn&apos;t lift, low libido, and performance stalling despite training. If these sound
        familiar, see a sports doctor — changing the numbers here isn&apos;t the fix.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  done: { fontSize: 16, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  intro: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 14, paddingHorizontal: 4 },
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  dayLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  empty: { marginTop: 10, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  kcal: { fontSize: 30, fontWeight: '800', marginTop: 8, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '600' },
  macroRow: { flexDirection: 'row', marginTop: 10 },
  macroCol: { flex: 1, alignItems: 'center' },
  macroLetter: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  macroValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 6 },
  why: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 6 },
  notice: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 12,
    gap: 6,
  },
  noticeTitle: { fontSize: 13, fontWeight: '700' },
  noticeText: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  kcalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  distanceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  distanceNoteText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  reset: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  warnings: { marginTop: 10, gap: 8 },
  warningRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  eaRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eaStatus: { fontSize: 13, fontWeight: '700' },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthSynced: { marginLeft: 'auto', fontSize: 11, fontWeight: '600' },
  healthActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  healthPrimary: { height: 42, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  healthPrimaryLabel: { fontSize: 15, fontWeight: '700' },
  healthSecondary: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
  healthSecondaryLabel: { fontSize: 14, fontWeight: '600' },
  healthStop: { paddingVertical: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryText: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: 20,
    padding: 6,
  },
  sourcesToggleText: { fontSize: 13, fontWeight: '600' },
  sources: { marginTop: 6, gap: 8 },
  source: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  disclaimer: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 18 },
});
