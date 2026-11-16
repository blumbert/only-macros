import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
} from 'react-native';

// Mounted scroll views, newest last. Sheets mount their content only while
// open, so the newest is the one on top: only it answers the keyboard, and the
// screen underneath doesn't scroll.
const stack: object[] = [];
/** Clear space kept between the field being typed in and the Done bar. */
const GAP = 16;

/**
 * A ScrollView for any screen with text fields: while the keyboard is up, it
 * scrolls the field being typed into so it sits above the keyboard and its
 * Done bar (DoneTextInput's, which iOS counts as part of the keyboard).
 */
export function KeyboardScrollView({ children, onScroll, onTouchEnd, ...props }: ScrollViewProps & { children: ReactNode }) {
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
      const limit = top - GAP;
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
        {covered !== null ? <View style={{ height: covered + GAP }} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
