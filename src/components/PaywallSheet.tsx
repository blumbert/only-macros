import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { MANAGE_SUBSCRIPTIONS_URL, PRIVACY_URL, TERMS_URL } from '../links';
import { getPlans, purchase, restore, type Plan, type PurchaseResult } from '../premium/purchases';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  premium: boolean;
  managementUrl: string | null;
  /** Re-read the subscription after a purchase or restore. */
  onChanged: () => void;
};

// What Premium unlocks. Label scanning, saved foods and everything else stay
// free; existing users keep Runner fueling free too.
const PERKS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  {
    icon: 'sparkles',
    title: 'AI food search',
    body: 'Describe anything you ate in your own words and get its macros, from the real label when it can be found. 60 searches a month.',
  },
  {
    icon: 'footsteps',
    title: 'Runner fueling',
    body: 'Daily calorie and macro targets that move with your training, with your runs filled in from Apple Health.',
  },
];

/**
 * The one place Premium is sold. Carries everything Apple requires on an
 * auto-renewing subscription screen (Guideline 3.1.2): the plan, its length
 * and price per period, an auto-renew statement, working Terms and Privacy
 * links, and Restore Purchases. Prices come from the store, localised per
 * country; none is ever written here.
 */
export function PaywallSheet({ visible, onClose, premium, managementUrl, onChanged }: Props) {
  const { c } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Plans are fetched each time the sheet opens. Keyed on `visible` rather
  // than the Modal's onShow, which react-native-web doesn't reliably fire.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    void getPlans().then(({ plans: list, error }) => {
      if (!alive) return;
      setLoading(false);
      setLoadError(error ?? null);
      setPlans(list);
      setSelected(list.find((p) => p.recommended)?.id ?? list[list.length - 1]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  const finish = (result: PurchaseResult, restoring: boolean) => {
    setBusy(false);
    if (result.ok) {
      onChanged();
      if (result.entitled) {
        onClose();
        Alert.alert('Welcome to Premium', 'AI food search and Runner fueling are unlocked.');
      } else {
        Alert.alert(
          restoring ? 'Nothing to restore' : 'Not active',
          restoring
            ? 'No active Only Macros Premium subscription was found for this Apple ID.'
            : 'That purchase didn’t start a subscription.',
        );
      }
      return;
    }
    if (result.cancelled) return;
    Alert.alert(restoring ? 'Couldn’t restore' : 'Purchase failed', result.message);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Premium" closeLabel="Close">
      <Text style={[styles.headline, { color: c.text }]}>
        {premium ? 'You’re on Premium' : 'Only Macros Premium'}
      </Text>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {PERKS.map((p, i) => (
          <View key={p.title} style={[styles.perk, i > 0 && styles.perkGap]}>
            <Ionicons name={p.icon} size={20} color={c.macro.p} style={styles.perkIcon} />
            <View style={styles.perkText}>
              <Text style={[styles.perkTitle, { color: c.text }]}>{p.title}</Text>
              <Text style={[styles.perkBody, { color: c.muted }]}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {premium ? (
        <Pressable
          onPress={() => void Linking.openURL(managementUrl ?? MANAGE_SUBSCRIPTIONS_URL)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.secondary,
            { borderColor: c.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: c.text }]}>Manage subscription</Text>
        </Pressable>
      ) : (
        <>
          {plans.length ? (
            <View style={styles.plans}>
              {plans.map((p) => {
                const active = p.id === selected;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.plan,
                      {
                        backgroundColor: c.surface,
                        borderColor: active ? c.text : c.border,
                        borderWidth: active ? 2 : StyleSheet.hairlineWidth * 2,
                      },
                    ]}
                  >
                    <View style={styles.planText}>
                      <Text style={[styles.planTitle, { color: c.text }]}>{p.title}</Text>
                      {p.period ? (
                        <Text style={[styles.planPeriod, { color: c.muted }]}>
                          {p.priceString} per {p.period}, renews automatically
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.planPrice, { color: c.text }]}>{p.priceString}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : loading ? (
            <ActivityIndicator color={c.muted} style={styles.spinner} />
          ) : (
            <Text style={[styles.unavailable, { color: c.muted }]}>
              Premium isn&apos;t available to buy right now.
              {__DEV__ && loadError ? `\n${loadError}` : ''}
            </Text>
          )}

          <Pressable
            onPress={() => {
              if (!selected) return;
              setBusy(true);
              void purchase(selected).then((r) => finish(r, false));
            }}
            disabled={busy || !selected}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.accent, opacity: busy || !selected ? 0.35 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: c.onAccent }]}>
              {busy ? 'Please wait…' : 'Subscribe'}
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={() => {
          setBusy(true);
          void restore().then((r) => finish(r, true));
        }}
        disabled={busy}
        hitSlop={10}
        accessibilityRole="button"
        style={styles.restore}
      >
        <Text style={[styles.restoreLabel, { color: c.muted }]}>Restore purchases</Text>
      </Pressable>

      <Text style={[styles.legal, { color: c.faint }]}>
        Payment is charged to your Apple ID when you confirm. The subscription renews
        automatically at the same price and length unless it&apos;s cancelled at least 24 hours
        before the end of the current period. Manage or cancel it any time in your Apple ID&apos;s
        subscription settings.
      </Text>
      <View style={styles.links}>
        <Text
          onPress={() => void Linking.openURL(TERMS_URL)}
          accessibilityRole="link"
          style={[styles.link, { color: c.muted }]}
        >
          Terms of Use
        </Text>
        <Text style={[styles.link, { color: c.faint }]}>·</Text>
        <Text
          onPress={() => void Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
          style={[styles.link, { color: c.muted }]}
        >
          Privacy Policy
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 4, paddingHorizontal: 4 },
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  perk: { flexDirection: 'row', gap: 12 },
  perkGap: { marginTop: 16 },
  perkIcon: { marginTop: 1 },
  perkText: { flex: 1 },
  perkTitle: { fontSize: 15, fontWeight: '700' },
  perkBody: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 3 },
  plans: { marginTop: 16, gap: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  planText: { flex: 1 },
  planTitle: { fontSize: 15, fontWeight: '700' },
  planPeriod: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  planPrice: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  spinner: { marginTop: 24 },
  unavailable: { marginTop: 18, fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  primary: { marginTop: 16, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  secondary: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 15, fontWeight: '700' },
  restore: { alignSelf: 'center', marginTop: 14, padding: 6 },
  restoreLabel: { fontSize: 14, fontWeight: '600' },
  legal: { fontSize: 11, fontWeight: '500', lineHeight: 16, textAlign: 'center', marginTop: 12 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  link: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
