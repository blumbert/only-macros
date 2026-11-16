import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
} from 'react-native';

import { useTheme } from '../theme';

const BAR = 44;

// Mounted scroll views, newest last. Sheets mount their content only while
// open, so the newest is the one on top: only it answers the keyboard, and the
// screen underneath doesn't scroll or show a second bar.
const stack: object[] = [];
/** Clear space kept between the field being typed in and the Done bar. */
const GAP = 16;

/**
 * A ScrollView for any screen with text fields. While the keyboard is up it
 * puts a Done bar along the top of the keyboard (iOS number pads have no
 * return key, so otherwise there's no way to put them away) and scrolls the
 * field being typed into so it sits above the bar.
 *
 * This draws its own bar rather than using InputAccessoryView: on the new
 * architecture one InputAccessoryView attaches to a single field only, so a
 * shared one silently missed almost every field in the app.
 */
export function KeyboardScrollView({ children, onScroll, onTouchEnd, ...props }: ScrollViewProps & { children: ReactNode }) {
  const { c } = useTheme();
  const wrap = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  // Top of the keyboard on screen while it's up, else null.
  const keyboardTop = useRef<number | null>(null);
  // How much of this view the keyboard covers, so the bar can sit on it and
  // the content can scroll clear of it.
  const [covered, setCovered] = useState<number | null>(null);

  /** Scroll the focused field up above the Done bar, if it's hidden. */
  const reveal = () => {
    const top = keyboardTop.current;
    const input = TextInput.State.currentlyFocusedInput() as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    if (top === null || !input?.measureInWindow) return;
    input.measureInWindow((_x, y, _w, h) => {
      const limit = top - BAR - GAP;
      if (y + h > limit) {
        scroll.current?.scrollTo({ y: scrollY.current + (y + h - limit), animated: true });
      }
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const me = {};
    stack.push(me);
    const onTop = () => stack[stack.length - 1] === me;
    const show = Keyboard.addListener('keyboardWillShow', (e: KeyboardEvent) => {
      if (!onTop()) return;
      const top = e.endCoordinates.screenY;
      keyboardTop.current = top;
      wrap.current?.measureInWindow((_x, y, _w, h) => {
        setCovered(Math.max(y + h - top, 0));
        // Once the spacer below has been laid out, there's room to scroll.
        setTimeout(reveal, 60);
      });
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      keyboardTop.current = null;
      setCovered(null);
    });
    return () => {
      show.remove();
      hide.remove();
      stack.splice(stack.indexOf(me), 1);
    };
  }, []);

  return (
    <View ref={wrap} style={styles.flex} collapsable={false}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        {...props}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        // Tapping from one field to the next doesn't always move the keyboard,
        // so check the new field after every tap while it's up.
        onTouchEnd={(e) => {
          if (keyboardTop.current !== null) setTimeout(reveal, 120);
          onTouchEnd?.(e);
        }}
      >
        {children}
        {covered !== null ? <View style={{ height: covered + BAR + GAP }} /> : null}
      </ScrollView>

      {covered !== null ? (
        <View
          style={[
            styles.bar,
            { bottom: covered, backgroundColor: c.surface, borderTopColor: c.border },
          ]}
        >
          <Pressable
            onPress={() => Keyboard.dismiss()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Done, hide the keyboard"
          >
            <Text style={[styles.done, { color: c.text }]}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: { fontSize: 17, fontWeight: '700' },
});
