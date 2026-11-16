import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Over-the-air updates, served from our own Cloudflare Worker (server/updates),
 * never Expo's servers. app.json sets `checkAutomatically: NEVER`, so this file
 * is the only thing that asks for one.
 *
 * Each time the app opens or comes back to the front it asks the server for a
 * newer update. If one downloads within a few seconds, the app reloads into it
 * straight away, before anyone has had time to start typing. If the download
 * takes longer it waits, and the next time the app comes to the front it
 * reloads at once with nothing left to download.
 */

/** A download that finishes this soon after opening reloads at once. */
const RELOAD_WINDOW_MS = 4000;
/** Don't ask more than once a minute, however often the app is switched to. */
const MIN_CHECK_GAP_MS = 60_000;

const TEST_KEY = 'updates.testChannel';

/** Whether this copy of the app can take updates (not dev, not web, not Expo Go). */
export const updatesEnabled = Platform.OS === 'ios' && !__DEV__ && Updates.isEnabled;

let checking = false;
let lastCheck = 0;
let pending = false;

async function check(activeSince: number) {
  if (checking || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable && !result.isRollBackToEmbedded) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) return;
    if (Date.now() - activeSince <= RELOAD_WINDOW_MS && AppState.currentState === 'active') {
      await Updates.reloadAsync();
    } else {
      pending = true;
    }
  } catch {
    // Offline or the server is down: try again next time.
  } finally {
    checking = false;
  }
}

function onActive() {
  if (pending) {
    // Downloaded last time; the app just came back, so nothing is mid-edit yet.
    void Updates.reloadAsync().catch(() => {});
    return;
  }
  void check(Date.now());
}

/** Call once from the root component. */
export function useOtaUpdates() {
  useEffect(() => {
    if (!updatesEnabled) return;
    onActive();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onActive();
    });
    return () => sub.remove();
  }, []);
}

/**
 * The test channel: updates published with `npm run update:preview` reach only
 * phones switched onto it, so they can be tried before everyone gets them.
 */
export function useTestChannel() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(TEST_KEY).then((v) => setOn(v === '1'));
  }, []);
  const toggle = async () => {
    const next = !on;
    // The header has to be in app.json's requestHeaders for iOS to accept the override.
    Updates.setUpdateRequestHeadersOverride(
      next ? { 'expo-channel-name': 'preview' } : null,
    );
    await AsyncStorage.setItem(TEST_KEY, next ? '1' : '0');
    setOn(next);
    lastCheck = 0;
    pending = false;
    void check(Date.now());
  };
  return { on, toggle };
}

/** "1.0.10 · a1b2c3d4": the app version and which update is running. */
export function versionLabel() {
  if (!updatesEnabled) return null;
  // runtimeVersion follows the app version (app.json's appVersion policy).
  const version = Updates.runtimeVersion ?? '';
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return version;
  return `${version} · ${Updates.updateId.slice(0, 8)}`;
}
