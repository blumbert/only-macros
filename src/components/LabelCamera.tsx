import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickPhoto } from '../nutrition/useLabelScan';

type Props = {
  visible: boolean;
  /** A photo to read: one just taken, or one chosen from the library. */
  onPhoto: (uri: string) => void;
  onClose: () => void;
};

/**
 * The app's own camera for a nutrition label: full screen, with a shutter, an
 * X to close, and Choose photo for a picture already on the phone. Apple's
 * built-in camera can't take extra buttons, which is why this exists.
 * Assumes camera permission has already been granted.
 */
export function LabelCamera({ visible, onPhoto, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setBusy(false);
    }
  }, [visible]);

  const shoot = async () => {
    if (!ready || busy || !camera.current) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1 });
      if (photo?.uri) onPhoto(photo.uri);
    } catch {
      // Nothing to show: the shutter just comes back for another try.
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // The library opens over the camera; backing out of it lands back here.
      const uri = await pickPhoto();
      if (uri) onPhoto(uri);
    } catch {
      // Same: stay on the camera.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {visible ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            onCameraReady={() => setReady(true)}
          />
        ) : null}

        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close the camera"
          style={({ pressed }) => [
            styles.close,
            { top: insets.top + 12, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        <View style={[styles.bar, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            onPress={() => void choose()}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo"
            style={({ pressed }) => [styles.side, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="images-outline" size={26} color="#fff" />
            <Text style={styles.sideLabel}>Choose photo</Text>
          </Pressable>

          <Pressable
            onPress={() => void shoot()}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Take the photo"
            style={({ pressed }) => [
              styles.shutter,
              { opacity: !ready || busy ? 0.4 : pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          {/* Balances Choose photo, so the shutter sits in the middle. */}
          <View style={styles.side} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  side: { width: 96, alignItems: 'center', gap: 4 },
  sideLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
