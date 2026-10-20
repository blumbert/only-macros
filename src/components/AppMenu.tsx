import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../theme';

export type MenuItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

/** Where the menu button is on screen, from `measureInWindow`. */
export type Anchor = { x: number; y: number; width: number; height: number };

/**
 * A dropdown under the menu button. Deliberately not a `<Modal>`: every item
 * opens a page sheet, and on iOS a sheet presented while another modal is
 * still dismissing never appears. As a plain overlay, closing the menu and
 * opening the page can happen in the same tap.
 */
export function AppMenu({
  anchor,
  items,
  onClose,
}: {
  anchor: Anchor | null;
  items: MenuItem[];
  onClose: () => void;
}) {
  const { c, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anchor) {
      fade.setValue(0);
      return;
    }
    Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [anchor, fade]);

  if (!anchor) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      <Animated.View
        accessibilityRole="menu"
        // The shadow lives on this outer view and the clipping on the inner
        // one: on iOS a view that clips its corners also clips its own shadow.
        style={[
          styles.card,
          {
            top: anchor.y + anchor.height + 6,
            right: Math.max(width - (anchor.x + anchor.width), 12),
            shadowOpacity: isDark ? 0.5 : 0.18,
            opacity: fade,
            transform: [
              { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          },
        ]}
      >
        <View style={[styles.inner, { backgroundColor: c.surface, borderColor: c.border }]}>
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            accessibilityRole="menuitem"
            style={({ pressed }) => [
              styles.item,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
              pressed && { backgroundColor: c.surfaceAlt },
            ]}
          >
            <Ionicons name={item.icon} size={20} color={c.text} />
            <Text style={[styles.label, { color: c.text }]}>{item.label}</Text>
          </Pressable>
        ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    minWidth: 220,
    borderRadius: 16,
    shadowColor: '#000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inner: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontSize: 16, fontWeight: '600' },
});
