import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { msUntilNextMidnight, todayKey, type DayKey } from './date';
import { loadLog, mergeLogs, saveLog, type Entry, type Log } from './storage';

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function useLog() {
  const [log, setLog] = useState<Log>({});
  const [today, setToday] = useState<DayKey>(todayKey);
  const [hydrated, setHydrated] = useState(false);

  /**
   * Load once on launch. The screen is interactive before this resolves — it
   * must never gate rendering, or a slow or wedged read shows a blank app — so
   * fold what was stored into whatever is already in memory instead of
   * overwriting it. Without the merge, an entry added in that window would be
   * silently discarded the moment storage came back.
   */
  useEffect(() => {
    let alive = true;
    loadLog().then((stored) => {
      if (!alive) return;
      setLog((current) => mergeLogs(stored, current));
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every change, but never write the empty initial state over real data.
  useEffect(() => {
    if (hydrated) void saveLog(log);
  }, [log, hydrated]);

  /**
   * Day rollover. Two triggers, because either one alone has a hole:
   *  - a timer armed for the next local midnight catches the app being open
   *    across the boundary;
   *  - an AppState check catches the far more common case of the phone being
   *    asleep at midnight (timers don't fire reliably in the background), and
   *    also picks up timezone or manual clock changes.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, msUntilNextMidnight());
    };

    const sync = () => {
      setToday((prev) => {
        const now = todayKey();
        return now === prev ? prev : now;
      });
      arm();
    };

    arm();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const subscription = AppState.addEventListener('change', onAppState);

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const addRef = useRef<{ day: DayKey; id: string } | null>(null);

  const add = useCallback((c: number, p: number, f: number) => {
    // Read the clock at the moment of the tap rather than trusting `today` —
    // an add at 11:59:59 lands on the day it was actually made.
    const day = todayKey();
    const entry: Entry = { id: newId(), at: Date.now(), c, p, f };
    setToday(day);
    setLog((prev) => ({ ...prev, [day]: [...(prev[day] ?? []), entry] }));
    addRef.current = { day, id: entry.id };
    return { day, entry };
  }, []);

  const remove = useCallback((day: DayKey, id: string) => {
    setLog((prev) => {
      const next = (prev[day] ?? []).filter((e) => e.id !== id);
      const copy = { ...prev };
      if (next.length) copy[day] = next;
      else delete copy[day];
      return copy;
    });
  }, []);

  return { log, today, hydrated, add, remove };
}
