import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { BoneHistory, Cycle, Goal, Profile, Sex } from '../fueling/model';
import type { Units } from '../fueling/profile';
import { useTheme } from '../theme';
import { Segmented } from './Segmented';

const KG_PER_LB = 0.45359237;

type Props = {
  initial: Profile | null;
  units: Units;
  onSave: (profile: Profile, units: Units) => void;
  onCancel?: () => void;
};

const trimNumber = (n: number) => String(Math.round(n * 10) / 10);

export function RunnerProfileForm({ initial, units: initialUnits, onSave, onCancel }: Props) {
  const { c } = useTheme();

  const [units, setUnits] = useState<Units>(initialUnits);
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [weight, setWeight] = useState(
    initial
      ? trimNumber(initialUnits === 'imperial' ? initial.weightKg / KG_PER_LB : initial.weightKg)
      : '',
  );
  const [bodyFat, setBodyFat] = useState(
    initial?.bodyFat ? trimNumber(initial.bodyFat * 100) : '',
  );
  const [lifestyle, setLifestyle] = useState<Profile['lifestyle']>(initial?.lifestyle ?? 'desk');
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'maintain');
  const [bone, setBone] = useState<BoneHistory>(initial?.bone ?? 'none');
  const [layoff, setLayoff] = useState(initial?.boneLongLayoff ?? false);
  const [cycle, setCycle] = useState<Cycle | null>(
    initial?.sex === 'female' ? initial.cycle : null,
  );
  const [error, setError] = useState<string | null>(null);

  // Switching units converts what's already typed rather than reinterpreting it.
  const changeUnits = (next: Units) => {
    if (next === units) return;
    const w = parseFloat(weight);
    if (Number.isFinite(w) && w > 0) {
      setWeight(trimNumber(next === 'imperial' ? w / KG_PER_LB : w * KG_PER_LB));
    }
    setUnits(next);
  };

  const submit = () => {
    const ageN = parseInt(age, 10);
    const weightN = parseFloat(weight);
    const fatN = bodyFat.trim() ? parseFloat(bodyFat) : null;

    if (!sex) return setError('Choose male or female.');
    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 100) return setError('Enter your age.');
    if (!Number.isFinite(weightN) || weightN <= 0) return setError('Enter your weight.');
    const weightKg = units === 'imperial' ? weightN * KG_PER_LB : weightN;
    if (weightKg < 25 || weightKg > 250) return setError('That weight looks off — check the units.');
    if (fatN !== null && (!Number.isFinite(fatN) || fatN < 3 || fatN > 50)) {
      return setError('Body fat should be between 3 and 50%, or left blank.');
    }
    if (sex === 'female' && !cycle) return setError('Answer the cycle question, or pick "Doesn’t apply".');

    setError(null);
    onSave(
      {
        sex,
        age: ageN,
        weightKg,
        bodyFat: fatN === null ? undefined : fatN / 100,
        lifestyle,
        goal,
        bone,
        boneLongLayoff: bone !== 'none' && layoff,
        cycle: sex === 'female' ? (cycle ?? 'notApplicable') : 'notApplicable',
      },
      units,
    );
  };

  const numberField = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    suffix: string,
    placeholder: string,
  ) => (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: c.muted }]}>{label}</Text>
      <View style={[styles.field, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
        <TextInput
          value={value}
          onChangeText={(v) => {
            onChange(v.replace(/[^0-9.]/g, ''));
            setError(null);
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={placeholder}
          placeholderTextColor={c.faint}
          maxLength={5}
          accessibilityLabel={label}
          style={[styles.fieldInput, { color: c.text }]}
        />
        <Text style={[styles.suffix, { color: c.faint }]}>{suffix}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Section label="UNITS" color={c.muted} />
      <Segmented
        accessibilityLabel="Units"
        value={units}
        onChange={changeUnits}
        options={[
          { value: 'imperial', label: 'mi · lb' },
          { value: 'metric', label: 'km · kg' },
        ]}
      />

      <Section label="ABOUT YOU" color={c.muted} />
      <Segmented
        accessibilityLabel="Sex"
        value={sex}
        onChange={(v) => {
          setSex(v);
          setError(null);
        }}
        options={[
          { value: 'female', label: 'Female' },
          { value: 'male', label: 'Male' },
        ]}
      />
      <View style={styles.fieldRow}>
        {numberField(age, setAge, 'Age', 'yrs', '28')}
        {numberField(weight, setWeight, 'Weight', units === 'imperial' ? 'lb' : 'kg', units === 'imperial' ? '130' : '59')}
        {numberField(bodyFat, setBodyFat, 'Body fat', '%', 'optional')}
      </View>
      <Text style={[styles.hint, { color: c.faint }]}>
        Leave body fat blank if you don&apos;t know it — a lean runner&apos;s estimate is used.
      </Text>

      <Section label="DAY JOB" color={c.muted} />
      <Segmented
        accessibilityLabel="Day job"
        value={lifestyle}
        onChange={setLifestyle}
        options={[
          { value: 'desk', label: 'Mostly sitting' },
          { value: 'onFeet', label: 'On my feet' },
        ]}
      />

      <Section label="GOAL" color={c.muted} />
      <Segmented
        accessibilityLabel="Goal"
        value={goal}
        onChange={setGoal}
        options={[
          { value: 'maintain', label: 'Maintain' },
          { value: 'lose', label: 'Lose' },
          { value: 'recomp', label: 'Recomp' },
        ]}
      />

      <Section label="BONE STRESS INJURIES, LAST 2 YEARS" color={c.muted} />
      <Text style={[styles.hint, styles.hintAbove, { color: c.faint }]}>
        Stress fractures and stress reactions.
      </Text>
      <Segmented
        vertical
        accessibilityLabel="Bone stress injuries in the last 2 years"
        value={bone}
        onChange={setBone}
        options={[
          { value: 'none', label: 'None' },
          { value: 'oneLowRisk', label: 'One — not in the hip, pelvis or sacrum' },
          { value: 'oneHighRisk', label: 'One in the hip (femoral neck), pelvis or sacrum' },
          { value: 'twoOrMore', label: 'Two or more, anywhere' },
        ]}
      />
      {bone !== 'none' ? (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.text }]}>
            Kept you out of training for 6 months or more
          </Text>
          <Switch
            value={layoff}
            onValueChange={setLayoff}
            accessibilityLabel="A bone stress injury kept you out of training for 6 months or more"
          />
        </View>
      ) : null}

      {sex === 'female' ? (
        <>
          <Section label="YOUR CYCLE" color={c.muted} />
          <Segmented
            vertical
            accessibilityLabel="Menstrual cycle"
            value={cycle}
            onChange={(v) => {
              setCycle(v);
              setError(null);
            }}
            options={[
              { value: 'regular', label: 'Regular' },
              { value: 'oligo', label: 'Usually more than 35 days apart' },
              { value: 'missed3', label: 'Missed 3 or more in a row' },
              { value: 'notApplicable', label: 'Doesn’t apply / prefer not to say' },
            ]}
          />
          <Text style={[styles.hint, { color: c.faint }]}>
            Missed or infrequent periods are one of the clearest early signs of under-fuelling.
            Hormonal contraception can hide them — a withdrawal bleed isn&apos;t a natural cycle.
            Stays on this phone like everything else.
          </Text>
        </>
      ) : null}

      {error ? <Text style={[styles.error, { color: c.macro.c }]}>{error}</Text> : null}

      <Pressable
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: c.accent, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[styles.saveLabel, { color: c.onAccent }]}>
          {initial ? 'Save profile' : 'See my targets'}
        </Text>
      </Pressable>
      {onCancel ? (
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel} hitSlop={8}>
          <Text style={[styles.cancelLabel, { color: c.muted }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Section({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.section, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  section: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  fieldWrap: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 10,
    height: 42,
  },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], padding: 0 },
  suffix: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  hint: { fontSize: 11, fontWeight: '500', marginTop: 8, lineHeight: 15 },
  hintAbove: { marginTop: -4, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  switchLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  error: { fontSize: 13, fontWeight: '600', marginTop: 14 },
  save: {
    marginTop: 18,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { fontSize: 16, fontWeight: '700' },
  cancel: { alignSelf: 'center', marginTop: 12 },
  cancelLabel: { fontSize: 14, fontWeight: '600' },
});
