import { forwardRef, useId } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../theme';

/**
 * A TextInput with Apple's Done bar on top of its keyboard (iOS number pads
 * have no return key, so otherwise there's no way to put them away).
 *
 * Each field gets its own InputAccessoryView with its own id: on the new
 * architecture an accessory attaches to one field only, so one shared bar
 * missed nearly every field. The bar is part of the keyboard, so iOS keeps it
 * in place and counts it in the keyboard's height.
 */
export const DoneTextInput = forwardRef<TextInput, TextInputProps>(function DoneTextInput(
  props,
  ref,
) {
  const { c } = useTheme();
  const id = useId();
  if (Platform.OS !== 'ios') return <TextInput ref={ref} {...props} />;
  return (
    <>
      <TextInput ref={ref} {...props} inputAccessoryViewID={id} />
      <InputAccessoryView nativeID={id} backgroundColor={c.surface}>
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
    </>
  );
});

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
