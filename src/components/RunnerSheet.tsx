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
import {
  dayCrossTraining,
  distanceSource,
  healthWindow,
  mergeDayKm,
  withHealthWeeks,
  type DayXt,
  type HealthXt,
} from '../fueling/healthDays';
import {
  crossTrainingKcal,
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
  plannedCrossTraining,
  weekFor,
  weekKey,
  type DayKm,
} from '../fueling/training';
import { calories, isEmpty, sumDay, type Log, type Totals } from '../storage';
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
  // With no training entered, Apple Health's last 7 days stand in for it.
  const planned = useMemo(
    () => withHealthWeeks(runner.weeks, healthDays, today),
    [runner.weeks, healthDays, today],
  );
  // Cross-training: set by hand, else Apple Health's workouts, else the week's
  // plan. Health speaks for finished days in full once it's connected.
  const healthXt = healthConnected ? (runner.health.xt ?? {}) : null;
  const xtFor = useCallback(
    (day: DayKey): DayXt =>
      dayCrossTraining(
        day,
        runner.dayXt,
        healthXt,
        profile?.weightKg ?? 0,
        plannedCrossTraining(planned.weeks, day),
        healthConnected && day < today,
      ),
    [runner.dayXt, healthXt, profile, planned.weeks, healthConnected, today],
  );
  const xtKcal = useMemo(() => {
    const out: Record<DayKey, number> = {};
    for (const day of healthWindow(today, RULES.loggedEa.lookbackDays)) out[day] = xtFor(day).kcal;
    return out;
  }, [xtFor, today]);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const syncHealth = useCallback(async () => {
    setHealthBusy(true);
    setHealthError(null);
    try {
      const read = await readRecentRuns(today);
      setHealth({
        connected: true,
        days: read.visible ? read.days : {},
        xt: read.xt,
        syncedAt: Date.now(),
      });
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
                    weeks={planned.weeks}
                    healthWeeks={planned.fromHealth}
                    dayKm={dayKm}
                    manualKm={runner.dayKm}
                    healthDays={healthDays}
                    onSetKm={runner.setDayKm}
                    xtFor={xtFor}
                    healthXt={healthXt}
                    xtKcal={xtKcal}
                    onSetXt={runner.setDayXt}
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
                    weeks={planned.weeks}
                    dayKm={dayKm}
                    xtKcal={xtKcal}
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
  healthWeeks,
  dayKm,
  manualKm,
  healthDays,
  onSetKm,
  xtFor,
  healthXt,
  xtKcal,
  onSetXt,
}: {
  profile: Profile;
  units: Units;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
  /** Week keys in `weeks` read off Apple Health rather than entered. */
  healthWeeks: DayKey[];
  /** Every known distance: hand-set over Apple Health. */
  dayKm: DayKm;
  /** Just the hand-set ones, to say where a day's distance came from. */
  manualKm: DayKm;
  healthDays: Record<DayKey, number> | null;
  onSetKm: (day: DayKey, km: number | null) => void;
  /** A day's cross-training, from whichever source has it. */
  xtFor: (day: DayKey) => DayXt;
  healthXt: HealthXt | null;
  /** Cross-training energy for the last 7 days, for energy availability. */
  xtKcal: Record<DayKey, number>;
  onSetXt: (day: DayKey, xt: { min: number; effort: number } | null) => void;
}) {
  const { c } = useTheme();
  // Days from today: ahead for meal prep, back to set what was actually run.
  // Resets to today whenever the day rolls over.
  const [offset, setOffset] = useState(0);
  const past = offset < 0;
  useEffect(() => setOffset(0), [today]);
  // The distance under the wheel while it's turning, in the runner's unit.
  const [preview, setPreview] = useState<number | null>(null);
  // The reasoning behind the numbers, folded away until asked for.
  const [showWhy, setShowWhy] = useState(false);
  // Cross-training minutes under the wheel while it turns, and whether the
  // effort list is open.
  const [xtPreview, setXtPreview] = useState<number | null>(null);
  const [effortOpen, setEffortOpen] = useState(false);

  const day = addDays(today, offset);
  useEffect(() => {
    setPreview(null);
    setXtPreview(null);
    setEffortOpen(false);
  }, [day]);
  const plan = planFor(weeks, day, dayKm, today);
  const found = weekFor(weeks, day);
  const problem = found ? checkWeek(found.week) : null;
  // A later week that hasn't been entered borrows the most recent one.
  const fromHealthWeek = !!found && healthWeeks.includes(found.key) && day >= today;
  const borrowed =
    !fromHealthWeek && found?.carried && weekKey(day) > weekKey(today) ? found.key : null;

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
  const logged = loggedEnergyAvailability(profile, log, weeks, today, dayKm, xtKcal);
  const imperial = units === 'imperial';
  const unit = imperial ? 'mi' : 'km';
  const toUnit = (km: number) => Math.round((imperial ? km / KM_PER_MI : km) * 10) / 10;
  const toKm = (v: number) => (imperial ? v * KM_PER_MI : v);
  const km = preview !== null ? toKm(preview) : plan.km;
  const xt = xtFor(day);
  const xtKcalNow =
    xtPreview === null
      ? xt.kcal
      : crossTrainingKcal(
          profile.weightKg,
          xtPreview,
          xt.effort ?? RULES.crossTraining.defaultEffort,
        );
  const t = dayTargets(
    profile,
    { type: plan.type, km, crossTrainingKcal: xtKcalNow },
    logged?.ea ?? null,
  );
  const healthHasXt = (healthXt?.[day]?.min ?? 0) > 0;
  const planHasXt = plannedCrossTraining(weeks, day) !== null;

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
              : null;

  const grams = { c: t.carbsG, p: t.proteinG, f: t.fatG };
  const eatenToday = sumDay(log[today]);
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
  if (t.crossTrainingKcal > 0) {
    why.push(`Includes ${formatNumber(t.crossTrainingKcal)} kcal of cross-training.`);
  }
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
      {borrowed ? (
        <Text style={[styles.why, { color: c.faint }]}>
          That week isn&apos;t entered yet, so this uses the plan from the week of{' '}
          {shortDate(borrowed)}.
        </Text>
      ) : fromHealthWeek ? (
        <Text style={[styles.why, { color: c.faint }]}>
          No training entered, so this follows your last 7 days in Apple Health. Enter your
          week below to plan it yourself.
        </Text>
      ) : null}

      {/* The day's training, side by side: the run, and cross-training. */}
      <View style={styles.training}>
        <View style={styles.trainingCol}>
          <Text style={[styles.trainingLabel, { color: c.muted }]}>RUN</Text>
          <View style={styles.wheelRow}>
            <MileageWheel
              key={day}
              value={toUnit(plan.km)}
              unit={unit}
              onPreview={setPreview}
              onCommit={(v) => onSetKm(day, toKm(v))}
            />
            <Text style={[styles.unit, { color: c.faint }]}>{unit}</Text>
          </View>
        </View>
        <View style={[styles.trainingDivider, { backgroundColor: c.border }]} />
        <View style={styles.trainingCol}>
          <Text style={[styles.trainingLabel, { color: c.muted }]}>CROSS-TRAINING</Text>
          <CrossTrainingControls
            key={day}
            xt={xt}
            effortOpen={effortOpen}
            onToggleEffort={() => setEffortOpen((o) => !o)}
            onPreview={setXtPreview}
            onSet={(next) => onSetXt(day, next)}
          />
        </View>
      </View>
      {effortOpen && xt.min > 0 ? (
        <EffortPicker
          value={xt.effort}
          onPick={(n) => {
            onSetXt(day, { min: xt.min, effort: n });
            setEffortOpen(false);
          }}
        />
      ) : null}
      {distanceNote || source === 'manual' ? (
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
      ) : null}

      <CrossTrainingNote
        xt={xt}
        healthHas={healthHasXt}
        planHas={planHasXt}
        onReset={() => onSetXt(day, null)}
      />

      {/* What the day's training comes to, under the training itself. */}
      <Text style={[styles.dayLabel, styles.dayLabelBelow, { color: c.muted }]}>
        Recommended for {DAY_NOUN[plan.type]}
      </Text>
      <Text style={[styles.kcal, styles.kcalAlone, { color: c.text }]}>
        {formatNumber(t.kcal)}
        <Text style={[styles.unit, { color: c.faint }]}> kcal</Text>
      </Text>

      {past ? (
        <Compare target={{ kcal: t.kcal, ...grams }} eaten={sumDay(log[day])} />
      ) : (
        <>
          <View style={styles.macroRow}>
            {offset === 0 ? <View style={styles.vsLabelCol} /> : null}
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
          {/* What's been logged today so far, under what's recommended. */}
          {offset === 0 ? (
            <View style={[styles.macroRow, styles.vsRow]}>
              <View style={styles.vsLabelCol}>
                <Text style={[styles.vsLabel, { color: c.muted }]}>vs. today</Text>
                <Text style={[styles.vsKcal, { color: c.faint }]}>
                  {formatNumber(calories(eatenToday))} kcal
                </Text>
              </View>
              {MACROS.map((m) => (
                <View key={m.key} style={styles.macroCol}>
                  <Text style={[styles.vsValue, { color: c.muted }]}>
                    {formatNumber(Math.round(eatenToday[m.key]))}
                    <Text style={[styles.unit, { color: c.faint }]}>g</Text>
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

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
      <Pressable
        onPress={() => setShowWhy((s) => !s)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: showWhy }}
        style={styles.whyToggle}
      >
        <Text style={[styles.sourcesToggleText, { color: c.muted }]}>How it&apos;s worked out</Text>
        <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={14} color={c.muted} />
      </Pressable>
      {showWhy
        ? why.map((line) => (
            <Text key={line} style={[styles.why, { color: c.muted }]}>
              {line}
            </Text>
          ))
        : null}

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

/**
 * A past day: what the page recommends for it next to what was logged. The
 * recommendation is worked out again from that day's distance as it stands
 * now, so a run filled in afterwards is what the food gets compared with.
 */
function Compare({
  target,
  eaten,
}: {
  target: { kcal: number; c: number; p: number; f: number };
  eaten: Totals;
}) {
  const { c } = useTheme();
  const logged = !isEmpty(eaten);
  const eatenKcal = Math.round(calories(eaten));
  const cols = [
    ...MACROS.map((m) => ({
      key: m.key,
      head: m.letter,
      color: c.macro[m.key],
      target: target[m.key],
      eaten: Math.round(eaten[m.key]),
      unit: 'g',
    })),
    { key: 'kcal', head: 'KCAL', color: c.muted, target: target.kcal, eaten: eatenKcal, unit: '' },
  ];
  const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : '0');

  const row = (label: string, value: (col: (typeof cols)[number]) => string, color: string, bold?: boolean) => (
    <View style={styles.compareRow}>
      <Text style={[styles.compareLabel, { color: c.muted }]}>{label}</Text>
      {cols.map((col) => (
        <Text
          key={col.key}
          style={[styles.compareValue, bold && styles.compareBold, { color }]}
          numberOfLines={1}
        >
          {value(col)}
        </Text>
      ))}
    </View>
  );

  return (
    <View style={styles.compare}>
      <View style={styles.compareRow}>
        <Text style={styles.compareLabel} />
        {cols.map((col) => (
          <Text key={col.key} style={[styles.compareValue, styles.compareHead, { color: col.color }]}>
            {col.head}
          </Text>
        ))}
      </View>
      {row('Recommended', (col) => `${formatNumber(col.target)}${col.unit}`, c.text, true)}
      {row('Logged', (col) => (logged ? `${formatNumber(col.eaten)}${col.unit}` : '—'), c.text, true)}
      {logged
        ? row('Difference', (col) => signed(col.eaten - col.target), c.faint)
        : null}
      {!logged ? (
        <Text style={[styles.why, { color: c.faint }]}>Nothing was logged this day.</Text>
      ) : null}
    </View>
  );
}

/** Highest cross-training the minutes wheel offers before it stretches. */
const XT_MAX_MIN = 300;

/**
 * A day's cross-training: a wheel of whole minutes, like the run's, and its
 * effort beside it once there are minutes. Any change sets the day by hand.
 */
function CrossTrainingControls({
  xt,
  effortOpen,
  onToggleEffort,
  onPreview,
  onSet,
}: {
  xt: DayXt;
  effortOpen: boolean;
  onToggleEffort: () => void;
  onPreview: (minutes: number | null) => void;
  onSet: (next: { min: number; effort: number }) => void;
}) {
  const { c } = useTheme();
  const effort = xt.effort ?? RULES.crossTraining.defaultEffort;
  return (
    <View style={styles.wheelRow}>
      <MileageWheel
        value={xt.min}
        unit="min"
        step={1}
        max={XT_MAX_MIN}
        noun="Cross-training"
        width={52}
        onPreview={onPreview}
        onCommit={(min) => onSet({ min, effort })}
      />
      <Text style={[styles.unit, { color: c.faint }]}>min</Text>
      {xt.min > 0 ? (
        <Pressable
          onPress={onToggleEffort}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: effortOpen }}
          accessibilityLabel={
            xt.effort === null ? 'Effort, measured by Apple Health' : `Effort ${effort} of 10`
          }
          style={({ pressed }) => [
            styles.effortBox,
            { borderColor: effortOpen ? c.macro.c : c.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <View style={styles.effortBoxValue}>
            <Text style={[styles.effortValue, { color: c.text }]}>
              {xt.effort === null ? '–' : effort}
            </Text>
            <Ionicons name={effortOpen ? 'chevron-up' : 'chevron-down'} size={10} color={c.muted} />
          </View>
          <Text style={[styles.effortCaption, { color: c.faint }]}>
            {xt.effort === null ? 'measured' : 'effort'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Effort 1–10, dropped down under the day's training. */
function EffortPicker({ value, onPick }: { value: number | null; onPick: (n: number) => void }) {
  const { c } = useTheme();
  const { minEffort, maxEffort } = RULES.crossTraining;
  const options = Array.from({ length: maxEffort - minEffort + 1 }, (_, k) => minEffort + k);
  return (
    <View style={[styles.effortList, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
      <Text style={[styles.effortListLabel, { color: c.muted }]}>
        Cross-training effort · 1 easy, 10 all-out
      </Text>
      <View style={styles.effortOptions}>
        {options.map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onPick(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Effort ${n}`}
              style={({ pressed }) => [
                styles.effortOption,
                {
                  borderColor: on ? c.macro.c : c.border,
                  backgroundColor: on ? c.macro.c + '2E' : c.surface,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.effortValue, { color: on ? c.macro.c : c.text }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Where Health's cross-training came from, and the way back from a hand edit. */
function CrossTrainingNote({
  xt,
  healthHas,
  planHas,
  onReset,
}: {
  xt: DayXt;
  healthHas: boolean;
  planHas: boolean;
  onReset: () => void;
}) {
  const { c } = useTheme();
  const kcal = formatNumber(Math.round(xt.kcal));
  const note =
    xt.source === 'health'
      ? xt.effort === null
        ? `Cross-training from Apple Health: ${kcal} kcal, as it measured them.`
        : `Cross-training from Apple Health, at a moderate effort.`
      : null;
  const canReset = xt.source === 'manual' && (healthHas || planHas || xt.min > 0);
  if (!note && !canReset) return null;
  return (
    <View style={styles.distanceNote}>
      <Text style={[styles.distanceNoteText, { color: c.faint }]}>{note ?? ''}</Text>
      {canReset ? (
        <Pressable onPress={onReset} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.reset, { color: c.muted }]}>
            {healthHas ? 'Use Health' : planHas ? 'Use plan' : 'Clear'}
          </Text>
        </Pressable>
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
  xtKcal,
  fromHealth,
}: {
  profile: Profile;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
  dayKm: DayKm;
  xtKcal: Record<DayKey, number>;
  /** Whether Apple Health is supplying the recent days' distances. */
  fromHealth: boolean;
}) {
  const { c } = useTheme();
  const logged = loggedEnergyAvailability(profile, log, weeks, today, dayKm, xtKcal);

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
      'Fill each day’s mileage and cross-training in from your workouts in Apple Health — Apple Watch, and apps like Garmin Connect or Strava that save them there. Read on this phone only; nothing is sent anywhere.';
  } else if (!checked) {
    body = 'Checking Apple Health for your runs…';
  } else if (visible) {
    body =
      'Each of the last 7 days uses your runs and cross-training from Apple Health. A day with no run counts as 0 — step back on the card above and scroll a day to override it.';
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
  dayLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  empty: { marginTop: 10, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  kcal: { fontSize: 30, fontWeight: '800', marginTop: 8, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '600' },
  macroRow: { flexDirection: 'row', marginTop: 10 },
  macroCol: { flex: 1, alignItems: 'center' },
  vsRow: { marginTop: 6, alignItems: 'center' },
  vsLabelCol: { width: 68 },
  vsLabel: { fontSize: 12, fontWeight: '700' },
  vsKcal: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  vsValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macroLetter: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  macroValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  compare: { marginTop: 12, gap: 6 },
  compareRow: { flexDirection: 'row', alignItems: 'baseline' },
  compareLabel: { flex: 1.5, fontSize: 12, fontWeight: '600' },
  compareHead: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  compareValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  compareBold: { fontSize: 15, fontWeight: '700' },
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
  distanceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  distanceNoteText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  reset: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  dayLabelBelow: { marginTop: 14 },
  kcalAlone: { marginTop: 2, marginBottom: 6, textAlign: 'center' },
  training: { flexDirection: 'row', marginTop: 18, marginBottom: 8 },
  trainingCol: { flex: 1, alignItems: 'center', gap: 6 },
  trainingLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  trainingDivider: { width: StyleSheet.hairlineWidth * 2, marginHorizontal: 8 },
  wheelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  effortBox: {
    marginLeft: 4,
    minWidth: 46,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
  },
  effortBoxValue: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  effortValue: { fontSize: 15, fontWeight: '700' },
  effortCaption: { fontSize: 10, fontWeight: '600' },
  effortList: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 10,
    gap: 8,
  },
  effortListLabel: { fontSize: 11, fontWeight: '600' },
  effortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effortOption: {
    width: 40,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  whyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  sources: { marginTop: 6, gap: 8 },
  source: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  disclaimer: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 18 },
});
