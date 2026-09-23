import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  AI_PROVIDERS, getApiKey, getSettings, modelFor, saveSettings, setApiKey,
  type AiProvider, type AppSettings,
} from '../settings';
import {
  currentGoogleEmail, getSetup, signInGoogle, signOutGoogle,
} from '../google';
import { colors } from '../theme';

function Segmented<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          style={[styles.segmentItem, value === o.id && styles.segmentItemActive]}
          onPress={() => onChange(o.id)}
        >
          <Text style={[styles.segmentText, value === o.id && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<AppSettings | null>(null);
  const [keys, setKeys] = useState<Partial<Record<AiProvider, string>>>({});
  const [googleEmail, setGoogleEmail] = useState<string | null>(currentGoogleEmail());
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setS(await getSettings());
      const k: Partial<Record<AiProvider, string>> = {};
      for (const p of AI_PROVIDERS) k[p.id] = await getApiKey(p.id);
      setKeys(k);
      setSheetUrl((await getSetup())?.spreadsheetUrl ?? null);
    })();
  }, []);

  if (!s) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  }
  const set = (patch: Partial<AppSettings>) => setS({ ...s, ...patch });
  const provider = AI_PROVIDERS.find((p) => p.id === s.aiProvider)!;

  async function googleLogin() {
    try {
      const email = await signInGoogle();
      setGoogleEmail(email);
      setSheetUrl((await getSetup())?.spreadsheetUrl ?? null);
    } catch (e: any) {
      Alert.alert('Přihlášení Googlem selhalo', e.message);
    }
  }

  async function googleLogout() {
    await signOutGoogle();
    setGoogleEmail(null);
    setSheetUrl(null);
  }

  async function save() {
    const email = s!.accountantEmail.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      Alert.alert('Neplatný e-mail', 'Zadejte platnou e-mailovou adresu účetní.');
      return;
    }
    setSaving(true);
    try {
      await saveSettings(s!);
      for (const p of AI_PROVIDERS) await setApiKey(p.id, keys[p.id] ?? '');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Nastavení</Text>

        {/* --- Účetní ------------------------------------------------------ */}
        <Text style={styles.section}>Účetní</Text>
        <Text style={styles.label}>E-mail účetní</Text>
        <TextInput
          style={styles.input}
          value={s.accountantEmail}
          onChangeText={(v) => set({ accountantEmail: v })}
          placeholder="ucetni@firma.cz"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, styles.gap]}>Odesílání dokladů</Text>
        <Segmented
          value={s.sendMode}
          onChange={(v) => set({ sendMode: v })}
          options={[
            { id: 'per_photo', label: 'Každý doklad hned' },
            { id: 'per_period', label: 'Souhrnně za období' },
          ]}
        />
        <Text style={styles.hint}>
          {s.sendMode === 'per_photo'
            ? 'Každá fotka se po zpracování hned pošle účetní e-mailem.'
            : 'Doklady se sbírají a pošlete je najednou tlačítkem „Odeslat účetní“ (fotky + CSV).'}
        </Text>

        <Text style={[styles.label, styles.gap]}>Účetní období</Text>
        <Segmented
          value={s.periodType}
          onChange={(v) => set({ periodType: v })}
          options={[{ id: 'mesic', label: 'Měsíc' }, { id: 'ctvrtleti', label: 'Čtvrtletí' }]}
        />

        {/* --- AI ------------------------------------------------------------ */}
        <Text style={styles.section}>AI pro čtení dokladů</Text>
        <Segmented
          value={s.aiProvider}
          onChange={(v) => set({ aiProvider: v })}
          options={AI_PROVIDERS.map((p) => ({ id: p.id, label: p.label }))}
        />
        <Text style={[styles.label, styles.gap]}>API klíč ({provider.label})</Text>
        <TextInput
          style={styles.input}
          value={keys[s.aiProvider] ?? ''}
          onChangeText={(v) => setKeys({ ...keys, [s.aiProvider]: v })}
          placeholder={provider.keyHint}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.hint}>Klíč je uložený šifrovaně jen v tomto telefonu.</Text>
        <Text style={[styles.label, styles.gap]}>Model</Text>
        <TextInput
          style={styles.input}
          value={s.aiModels[s.aiProvider] ?? ''}
          onChangeText={(v) => set({ aiModels: { ...s.aiModels, [s.aiProvider]: v } })}
          placeholder={modelFor({ ...s, aiModels: {} })}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* --- Google ---------------------------------------------------------- */}
        <Text style={styles.section}>Google účet</Text>
        <Text style={styles.hint}>
          Fotky se ukládají do složky „Účtenkomat“ na vašem Google Disku, údaje do Google tabulky
          a e-mail účetní odchází z vašeho Gmailu.
        </Text>
        {googleEmail ? (
          <>
            <Text style={styles.account}>Přihlášeno: {googleEmail}</Text>
            {sheetUrl && (
              <Pressable onPress={() => Linking.openURL(sheetUrl)}>
                <Text style={styles.link}>Otevřít tabulku dokladů ↗</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryBtn} onPress={googleLogout}>
              <Text style={styles.secondaryText}>Odhlásit</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.googleBtn} onPress={googleLogin}>
            <Text style={styles.googleText}>Přihlásit se Googlem</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={onClose}>
          <Text style={styles.secondaryText}>Zpět</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Uložit</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8 },
  section: {
    fontSize: 13, color: colors.muted, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 8, fontWeight: '600',
  },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  gap: { marginTop: 14 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  segment: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, padding: 3,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  segmentTextActive: { color: colors.primaryText, fontWeight: '600' },
  account: { fontSize: 15, color: colors.text, marginTop: 12 },
  link: { color: colors.primary, fontSize: 15, marginTop: 8, fontWeight: '600' },
  googleBtn: {
    marginTop: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, paddingVertical: 14, alignItems: 'center',
  },
  googleText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  actions: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  secondaryBtn: {
    marginTop: 12, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  saveBtn: {
    flex: 1, marginTop: 12, backgroundColor: colors.primary, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
