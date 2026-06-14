import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { Doklad } from './src/types';
import { colors } from './src/theme';

export default function App() {
  const [reviewDoc, setReviewDoc] = useState<Doklad | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {showSettings ? (
        <SettingsScreen onClose={() => setShowSettings(false)} />
      ) : reviewDoc ? (
        <ReviewScreen
          doklad={reviewDoc}
          onDone={() => setReviewDoc(null)}
          onCancel={() => setReviewDoc(null)}
        />
      ) : (
        <HomeScreen onReview={setReviewDoc} onOpenSettings={() => setShowSettings(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
