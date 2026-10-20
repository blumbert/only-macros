import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScanSource, ScanState } from '../nutrition/useLabelScan';
import { useTheme } from '../theme';

type Props = {
  state: ScanState;
  onScan: (source: ScanSource) => void;
};

/** "Take photo" and "Choose photo", plus what happened last time. */
export function ScanButtons({ state, onScan }: Props) {
  const { c } = useTheme();
  const reading = state.status === 'reading';

  return (
    <View>
      <View style={styles.row}>
        <Button
          icon="camera-outline"
          label="Take photo"
          primary
          disabled={reading}
          onPress={() => onScan('camera')}
        />
        <Button
          icon="images-outline"
          label="Choose photo"
          disabled={reading}
          onPress={() => onScan('library')}
        />
      </View>

      {reading ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={c.muted} />
          <Text style={[styles.statusText, { color: c.muted }]}>Reading the label…</Text>
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.status}>
          <Ionicons name="alert-circle-outline" size={16} color={c.macro.c} />
          <Text style={[styles.statusText, { color: c.muted }]}>
            {state.message}
            {state.settings ? (
              <Text
                onPress={() => void Linking.openSettings()}
                style={[styles.link, { color: c.text }]}
                accessibilityRole="link"
              >
                {' '}
                Open Settings
              </Text>
            ) : null}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Button({
  icon,
  label,
  primary,
  disabled,
  onPress,
}: {
  icon: 'camera-outline' | 'images-outline';
  label: string;
  primary?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: c.accent, borderColor: c.accent }
          : { backgroundColor: c.surfaceAlt, borderColor: c.border },
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={primary ? c.onAccent : c.text} />
      <Text style={[styles.label, { color: primary ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: { fontSize: 15, fontWeight: '700' },
  status: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
