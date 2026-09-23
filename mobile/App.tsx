import { useEffect, useState } from 'react';
import { AppState, SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { Doklad } from './src/types';
import { configureGoogle, signInGoogleSilently } from './src/google';
import { initNotifications } from './src/notify';
import { resumePending } from './src/pipeline';
import { colors } from './src/theme';

export default function App() {
  const [openDoc, setOpenDoc] = useState<Doklad | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    configureGoogle();
    (async () => {
      await initNotifications();
      await signInGoogleSilently();
      // Doklady rozpracované před zavřením aplikace dokonči.
      await resumePending();
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') resumePending();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {showSettings ? (
        <SettingsScreen onClose={() => setShowSettings(false)} />
      ) : openDoc ? (
        <ReviewScreen doklad={openDoc} onClose={() => setOpenDoc(null)} />
      ) : (
        <HomeScreen onOpen={setOpenDoc} onOpenSettings={() => setShowSettings(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
