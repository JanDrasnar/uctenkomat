// Výběr AI služby + provedení uživatele získáním klíče krok za krokem:
// odkaz přímo na správnou stránku, vložení ze schránky jedním klepnutím,
// automatické rozpoznání služby podle klíče a okamžité ověření.
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PROVIDER_GUIDES, checkApiKey, cleanKey, detectProvider, guideFor } from '../ai/keys';
import type { AiProvider } from '../settings';
import { colors } from '../theme';

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; message: string };

export default function AiKeySetup({
  provider, onProviderChange, apiKey, onKeyChange, modelFor, onVerified, stepsInitiallyOpen = true,
}: {
  provider: AiProvider;
  onProviderChange: (p: AiProvider) => void;
  apiKey: string;
  onKeyChange: (key: string) => void;
  modelFor: (p: AiProvider) => string;
  onVerified?: (ok: boolean) => void;
  stepsInitiallyOpen?: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [stepsOpen, setStepsOpen] = useState(stepsInitiallyOpen);
  const [note, setNote] = useState<string | null>(null);
  const guide = guideFor(provider);

  const setResult = (s: Status) => {
    setStatus(s);
    onVerified?.(s.kind === 'ok');
  };

  async function verify(p: AiProvider, key: string) {
    if (!key) return;
    setResult({ kind: 'checking' });
    const r = await checkApiKey(p, key, modelFor(p));
    setResult(r.ok ? { kind: 'ok' } : { kind: 'error', message: r.message });
  }

  async function paste() {
    const key = cleanKey(await Clipboard.getStringAsync());
    if (!key) {
      setResult({ kind: 'error', message: 'Ve schránce nic není. Nejdřív klíč na webu zkopírujte.' });
      return;
    }
    let p = provider;
    const detected = detectProvider(key);
    if (detected && detected !== provider) {
      p = detected;
      onProviderChange(detected);
      setNote(`Klíč patří službě ${guideFor(detected).name} — přepnuto automaticky.`);
    } else {
      setNote(null);
    }
    onKeyChange(key);
    await verify(p, key);
  }

  return (
    <View>
      {PROVIDER_GUIDES.map((g) => {
        const active = g.id === provider;
        return (
          <Pressable
            key={g.id}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => {
              if (g.id === provider) return;
              onProviderChange(g.id);
              setNote(null);
              setResult({ kind: 'idle' });
            }}
          >
            <View style={styles.cardHead}>
              <Text style={styles.radio}>{active ? '◉' : '○'}</Text>
              <Text style={styles.cardTitle}>{g.name}</Text>
            </View>
            {g.badge && <Text style={styles.badge}>{g.badge}</Text>}
            <Text style={styles.cardText}>{g.tagline}</Text>
            <Text style={styles.cardPrice}>{g.price}</Text>
          </Pressable>
        );
      })}

      <Pressable onPress={() => setStepsOpen(!stepsOpen)}>
        <Text style={styles.stepsToggle}>
          {stepsOpen ? '▾' : '▸'} Jak získat klíč pro {guide.name}
        </Text>
      </Pressable>
      {stepsOpen && (
        <View style={styles.steps}>
          {guide.steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
          {guide.billingUrl && (
            <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(guide.billingUrl!)}>
              <Text style={styles.linkBtnText}>{guide.billingLabel} ↗</Text>
            </Pressable>
          )}
          <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(guide.keyUrl)}>
            <Text style={styles.linkBtnText}>{guide.keyUrlLabel} ↗</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.pasteBtn} onPress={paste}>
        <Text style={styles.pasteText}>📋  Vložit zkopírovaný klíč</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={(v) => {
          onKeyChange(cleanKey(v));
          setResult({ kind: 'idle' });
        }}
        onEndEditing={() => verify(provider, apiKey)}
        placeholder="nebo klíč vepište sem"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      {note && <Text style={styles.note}>{note}</Text>}
      {status.kind === 'checking' && (
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.statusText}>Ověřuji klíč…</Text>
        </View>
      )}
      {status.kind === 'ok' && <Text style={styles.ok}>✓ Klíč funguje, vše je připraveno.</Text>}
      {status.kind === 'error' && <Text style={styles.error}>✕ {status.message}</Text>}
      {status.kind === 'idle' && apiKey ? (
        <Pressable onPress={() => verify(provider, apiKey)}>
          <Text style={styles.verifyLink}>Ověřit klíč</Text>
        </Pressable>
      ) : null}
      <Text style={styles.hint}>Klíč je uložený šifrovaně jen v tomto telefonu.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardActive: { borderColor: colors.primary, borderWidth: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { fontSize: 18, color: colors.primary },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  badge: {
    alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.okBg, color: colors.ok,
    fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  cardText: { fontSize: 14, color: colors.text, marginTop: 6 },
  cardPrice: { fontSize: 13, color: colors.muted, marginTop: 4 },
  stepsToggle: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 8, marginBottom: 8 },
  steps: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, color: '#fff',
    textAlign: 'center', lineHeight: 24, fontWeight: '700', fontSize: 13,
  },
  stepText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  linkBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 6,
  },
  linkBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  pasteBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10,
  },
  pasteText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  note: { color: colors.primary, marginTop: 8, fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  statusText: { color: colors.text },
  ok: { color: colors.ok, fontWeight: '600', marginTop: 10, fontSize: 15 },
  error: { color: colors.error, marginTop: 10, fontSize: 15, lineHeight: 21 },
  verifyLink: { color: colors.primary, fontWeight: '600', marginTop: 10 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
});
