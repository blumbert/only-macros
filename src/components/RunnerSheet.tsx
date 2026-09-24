import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

import { addDays, fromDayKey, shortDate, type DayKey } from '../date';
import {
  dayTargets,
  loggedEnergyAvailability,
  runningKcal,
  type DayTargets,
  type Guard,
  type Profile,
} from '../fueling/model';
import { useRunner, type Units } from '../fueling/profile';
import { RULES, SOURCES, type DayType } from '../fueling/rules';
import { checkWeek, KM_PER_MI, planFor, weekFor, weekKey } from '../fueling/training';
import type { Log } from '../storage';
import { formatNumber, MACROS, useTheme } from '../theme';
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

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function dayHeading(day: DayKey, offset: number): string {
  if (offset === 0) return 'TODAY';
  if (offset === 1) return 'TOMORROW';
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
                  <DayTargetsCard profile={profile} units={runner.units} log={log} today={today} weeks={runner.weeks} />
                  <TrainingWeekEditor
                    weeks={runner.weeks}
                    today={today}
                    units={runner.units}
                    onChange={runner.setWeek}
                  />
                  <LastWeek profile={profile} log={log} today={today} weeks={runner.weeks} />
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
}: {
  profile: Profile;
  units: Units;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
}) {
  const { c } = useTheme();
  // Days ahead of today, so meal prep can plan for the days it covers. Resets
  // to today whenever the day rolls over.
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [today]);

  const day = addDays(today, offset);
  const plan = planFor(weeks, day);
  const found = weekFor(weeks, day);
  const problem = found ? checkWeek(found.week) : null;
  // A later week that hasn't been entered borrows the most recent one.
  const borrowed = found?.carried && weekKey(day) > weekKey(today) ? found.key : null;

  const header = (
    <View style={styles.dayNav}>
      <Pressable
        onPress={() => setOffset((o) => Math.max(o - 1, 0))}
        disabled={offset === 0}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
      >
        <Ionicons name="chevron-back" size={18} color={offset === 0 ? c.faint : c.text} />
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
            : 'Enter this week’s training below to see targets.'}
        </Text>
      </View>
    );
  }

  // Energy availability from the log is where the runner is now, so it
  // guards every day shown — tomorrow's targets can't be based on meals that
  // haven't been eaten.
  const logged = loggedEnergyAvailability(profile, log, weeks, today);
  const t = dayTargets(profile, plan, logged?.ea ?? null);
  const unit = units === 'imperial' ? 'mi' : 'km';
  const toUnit = (km: number) => Math.round((units === 'imperial' ? km / KM_PER_MI : km) * 10) / 10;

  // Only the long run's distance was actually entered. Easy and workout days
  // get an even share of the rest of the week, which is nobody's real day, so
  // the card doesn't present it as one — it says what the share is and how to
  // adjust from it, at the same per-distance cost the model itself uses.
  const perUnitKcal = Math.round(
    runningKcal(profile.weightKg, units === 'imperial' ? KM_PER_MI : 1) / 5,
  ) * 5;
  const adjust =
    plan.type === 'easy' || plan.type === 'workout'
      ? `Based on your weekly mileage spread evenly — about ${toUnit(plan.km)} ${unit} on each easy and workout day. Running more than that? Add about ${perUnitKcal} kcal per extra ${unit}, mostly as carbs (about ${Math.round(perUnitKcal / 4)} g). Running less, take the same off.`
      : null;

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
      <Text style={[styles.dayLabel, { color: c.faint }]}>
        {DAY_LABEL[plan.type]}
        {plan.type === 'long' ? ` · ${toUnit(plan.km)} ${unit}` : ''}
      </Text>
      {borrowed ? (
        <Text style={[styles.why, { color: c.faint }]}>
          That week isn&apos;t entered yet, so this uses the plan from the week of{' '}
          {shortDate(borrowed)}.
        </Text>
      ) : null}

      <Text style={[styles.kcal, { color: c.text }]}>
        {formatNumber(t.kcal)}
        <Text style={[styles.unit, { color: c.faint }]}> kcal</Text>
      </Text>

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

      {adjust ? (
        <View style={[styles.adjust, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="swap-vertical-outline" size={15} color={c.muted} />
          <Text style={[styles.adjustText, { color: c.muted }]}>{adjust}</Text>
        </View>
      ) : null}

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
}: {
  profile: Profile;
  log: Log;
  today: DayKey;
  weeks: ReturnType<typeof useRunner>['weeks'];
}) {
  const { c } = useTheme();
  const logged = loggedEnergyAvailability(profile, log, weeks, today);

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
            What you logged over {logged.days} days, minus the running you entered, per kg of
            fat-free mass. {RULES.ea.adequate}+ is adequate; under {RULES.ea.low} is linked to
            low energy availability.
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
  adjust: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: 12 },
  adjustText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  warnings: { marginTop: 10, gap: 8 },
  warningRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  eaRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eaStatus: { fontSize: 13, fontWeight: '700' },
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
