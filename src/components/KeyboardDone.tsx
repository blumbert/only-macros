import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

/** Give a TextInput `inputAccessoryViewID={DONE_ID}` to put a Done bar on its keyboard. */
export const DONE_ID = 'keyboard-done';

/**
 * A Done bar along the top of the keyboard. iOS number pads have no return
 * key, so without it there's no way to put the keyboard away. Rendered once
 * per screen and per sheet, so every text field can find it. iOS only.
 */
export function KeyboardDoneBar() {
  const { c } = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ID} backgroundColor={c.surface}>
      <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Done, hide the keyboard"
        >
          <Text style={[styles.done, { color: c.text }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: { fontSize: 17, fontWeight: '700' },
});
