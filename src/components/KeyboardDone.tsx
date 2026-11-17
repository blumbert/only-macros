import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
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

type Measurable = {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/**
 * A ScrollView for any screen with text fields: while the keyboard is up, it
 * scrolls the field being typed into so it sits above the keyboard and its
 * Done bar (DoneTextInput's, which iOS counts as part of the keyboard).
 *
 * Every screen and sheet puts this view at its very bottom, which is the
 * bottom of the screen, so the keyboard covers exactly its own height of it.
 * Positions are only ever compared with each other (the field against this
 * view), never with the keyboard's screen position: inside a page sheet,
 * "window" positions are measured from the top of the sheet, not the screen,
 * and mixing the two left fields hidden behind the bar by the sheet's offset.
 */
export function KeyboardScrollView({ children, onScroll, onTouchEnd, ...props }: ScrollViewProps & { children: ReactNode }) {
  const wrap = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  // Height of the keyboard (with its Done bar) while it's up, else null.
  const keyboardHeight = useRef<number | null>(null);
  // How much of this view the keyboard covers, so the content can scroll
  // clear of it.
  const [covered, setCovered] = useState<number | null>(null);

  /** Scroll the focused field up above the Done bar, if it's hidden. */
  const reveal = () => {
    const kb = keyboardHeight.current;
    const input = TextInput.State.currentlyFocusedInput() as unknown as Measurable | null;
    if (kb === null || !input?.measureInWindow || !wrap.current) return;
    wrap.current.measureInWindow((_wx, wy, _ww, wh) => {
      input.measureInWindow!((_x, y, _w, h) => {
        // Bottom of the field, and the lowest it may sit, both measured from
        // the top of this view.
        const bottom = y - wy + h;
        const limit = wh - kb - GAP;
        if (bottom > limit) {
          scroll.current?.scrollTo({ y: scrollY.current + (bottom - limit), animated: true });
        }
      });
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const me = {};
    stack.push(me);
    const onTop = () => stack[stack.length - 1] === me;
    const update = (e: KeyboardEvent) => {
      if (!onTop()) return;
      // From the keyboard's top to the bottom of the screen: the bar counts.
      const screenH = Dimensions.get('screen').height;
      const kb = Math.max(screenH - e.endCoordinates.screenY, e.endCoordinates.height, 0);
      if (kb <= 0) return;
      keyboardHeight.current = kb;
      setCovered(kb);
      // Once the spacer below has been laid out, there's room to scroll.
      setTimeout(reveal, 60);
    };
    // The Done bar can arrive a moment after the keyboard, and switching
    // between fields can change the keyboard's height, so every change counts.
    const show = Keyboard.addListener('keyboardWillShow', update);
    const shown = Keyboard.addListener('keyboardDidShow', update);
    const change = Keyboard.addListener('keyboardDidChangeFrame', (e: KeyboardEvent) => {
      if (keyboardHeight.current !== null) update(e);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      keyboardHeight.current = null;
      setCovered(null);
    });
    return () => {
      show.remove();
      shown.remove();
      change.remove();
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
          if (keyboardHeight.current !== null) setTimeout(reveal, 120);
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
