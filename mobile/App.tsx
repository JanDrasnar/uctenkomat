import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { getSettings } from './src/settings';
import type { Doklad } from './src/types';
import { configureGoogle, signInGoogleSilently } from './src/google';
import { initNotifications } from './src/notify';
import { migrateSheet, resumePending } from './src/pipeline';
import { colors } from './src/theme';

export default function App() {
  const [openDoc, setOpenDoc] = useState<Doklad | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // null = ještě nevíme (načítá se nastavení)
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);

  useEffect(() => {
    configureGoogle();
    getSettings().then((s) => setShowWizard(!s.onboarded));
    (async () => {
      await initNotifications();
      await signInGoogleSilently();
      // Doklady rozpracované před zavřením aplikace dokonči.
      await resumePending();
      await migrateSheet();
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') resumePending();
    });
    return () => sub.remove();
  }, []);

  return (
    // Android 15+ kreslí aplikaci pod stavový i navigační řádek (edge-to-edge).
    // SafeAreaView z react-native funguje jen na iOS, proto safe-area-context,
    // který odsadí obsah od systémových lišt na všech zařízeních.
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
        {showWizard === null ? null : showWizard ? (
          <OnboardingScreen
            onDone={(takePhoto) => {
              setShowWizard(false);
              setShowSettings(false);
              setAutoCapture(takePhoto);
            }}
          />
        ) : showSettings ? (
          <SettingsScreen
            onClose={() => setShowSettings(false)}
            onRunWizard={() => setShowWizard(true)}
          />
        ) : openDoc ? (
          <ReviewScreen doklad={openDoc} onClose={() => setOpenDoc(null)} />
        ) : (
          <HomeScreen
            onOpen={setOpenDoc}
            onOpenSettings={() => setShowSettings(true)}
            autoCapture={autoCapture}
            onAutoCaptureDone={() => setAutoCapture(false)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
