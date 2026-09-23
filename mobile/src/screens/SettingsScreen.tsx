import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  AI_PROVIDERS, getApiKey, getSettings, modelFor, saveSettings, setApiKey,
  type AiProvider, type AppSettings,
} from '../settings';
import AiKeySetup from '../components/AiKeySetup';
import Segmented from '../components/Segmented';
import CompanySection from '../components/CompanySection';
import {
  currentGoogleEmail, getSetup, shareFolderWith, signInGoogle, signOutGoogle,
} from '../google';
import { colors } from '../theme';

export default function SettingsScreen({
  onClose, onRunWizard,
}: {
  onClose: () => void;
  onRunWizard: () => void;
}) {
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
      // Účetní dostane přístup ke složce s fotkami hned, ne až s dalším dokladem.
      if (email && currentGoogleEmail()) {
        shareFolderWith(email).catch((e) => console.warn('Sdílení složky selhalo:', e));
      }
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
        <Text style={styles.section}>Čtení dokladů (AI)</Text>
        <AiKeySetup
          provider={s.aiProvider}
          onProviderChange={(p) => set({ aiProvider: p })}
          apiKey={keys[s.aiProvider] ?? ''}
          onKeyChange={(v) => setKeys({ ...keys, [s.aiProvider]: v })}
          modelFor={(p) => modelFor(s, p)}
          stepsInitiallyOpen={!keys[s.aiProvider]}
        />
        <Text style={[styles.label, styles.gap]}>Model (pro pokročilé)</Text>
        <TextInput
          style={styles.input}
          value={s.aiModels[s.aiProvider] ?? ''}
          onChangeText={(v) => set({ aiModels: { ...s.aiModels, [s.aiProvider]: v } })}
          placeholder={modelFor({ ...s, aiModels: {} })}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>Nechte prázdné, pokud nevíte — použije se doporučený model.</Text>

        {/* --- Google ---------------------------------------------------------- */}
        <Text style={styles.section}>Google účet</Text>
        <Text style={styles.hint}>
          Fotky se ukládají do složky „Účtenkomat“ na vašem Google Disku, údaje do Google tabulky
          s odkazem na fotku a e-mail účetní odchází z vašeho Gmailu. Složku aplikace nasdílí
          účetní (jen pro čtení), aby jí odkazy na fotky fungovaly.
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

        {/* --- Firma ------------------------------------------------------------ */}
        <Text style={styles.section}>Firma</Text>
        <CompanySection key={googleEmail ?? 'none'} accountantEmail={s.accountantEmail} />

        <Pressable style={styles.wizardBtn} onPress={onRunWizard}>
          <Text style={styles.link}>Spustit průvodce nastavením znovu</Text>
        </Pressable>
        <Pressable
          style={styles.wizardBtn}
          onPress={() => Linking.openURL('https://jandrasnar.github.io/uctenkomat/ochrana-soukromi.html')}
        >
          <Text style={styles.link}>Zásady ochrany osobních údajů ↗</Text>
        </Pressable>
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
  wizardBtn: { marginTop: 28, alignItems: 'center' },
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
