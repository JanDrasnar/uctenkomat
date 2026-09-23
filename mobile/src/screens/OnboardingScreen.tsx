// Průvodce prvním spuštěním pro netechnické uživatele: Google účet →
// účetní → AI klíč → hotovo. Každý krok se hned ukládá, takže průvodce
// jde kdykoli přerušit a v Nastavení spustit znovu.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AiKeySetup from '../components/AiKeySetup';
import Segmented from '../components/Segmented';
import {
  getApiKey, getSettings, modelFor, saveSettings, setApiKey,
  type AiProvider, type AppSettings,
} from '../settings';
import { currentGoogleEmail, ensureSetup, shareFolderWith, signInGoogle } from '../google';
import { colors } from '../theme';

const STEPS = ['Vítejte', 'Google účet', 'Účetní', 'Čtení dokladů', 'Hotovo'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function OnboardingScreen({ onDone }: { onDone: (takePhoto: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<AppSettings | null>(null);
  const [apiKey, setKey] = useState('');
  const [keyOk, setKeyOk] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(currentGoogleEmail());
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await getSettings();
      // Bez uloženého klíče nabídni nejjednodušší možnost (Gemini).
      const existing = await getApiKey(loaded.aiProvider);
      if (!existing) loaded.aiProvider = 'gemini';
      setS(loaded);
      setKey(existing);
    })();
  }, []);

  if (!s) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const set = (patch: Partial<AppSettings>) => setS({ ...s, ...patch });

  async function switchProvider(p: AiProvider) {
    set({ aiProvider: p });
    setKey(await getApiKey(p));
    setKeyOk(false);
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const email = await signInGoogle();
      setGoogleEmail(email);
      if (email) {
        await ensureSetup(); // hned založí složku a tabulku — uživatel vidí, že to funguje
        setGoogleReady(true);
      }
    } catch (e: any) {
      Alert.alert(
        'Přihlášení se nepovedlo',
        `${e.message}\n\nZkuste to prosím znovu. Pokud chyba trvá, pošlete ji autorovi aplikace.`,
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  async function next() {
    const cur = s!;
    if (step === 2) {
      const email = cur.accountantEmail.trim();
      if (email && !EMAIL_RE.test(email)) {
        Alert.alert('Neplatný e-mail', 'Zkontrolujte prosím e-mailovou adresu účetní.');
        return;
      }
      if (email && currentGoogleEmail()) shareFolderWith(email).catch(() => undefined);
    }
    if (step === 3 && apiKey) await setApiKey(cur.aiProvider, apiKey);
    await saveSettings(cur);
    setStep(step + 1);
  }

  async function finish(takePhoto: boolean) {
    await saveSettings({ ...s!, onboarded: true });
    onDone(takePhoto);
  }

  const canContinue =
    step === 1 ? !!googleEmail
      : step === 2 ? EMAIL_RE.test(s.accountantEmail.trim())
        : step === 3 ? keyOk
          : true;
  const skippable = step === 1 || step === 2 || step === 3;

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>Krok {step + 1} z {STEPS.length} · {STEPS[step]}</Text>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={styles.title}>Účtenky bez papírování</Text>
            <Text style={styles.lead}>Vyfotíte účtenku nebo fakturu a aplikace za vás:</Text>
            {[
              ['📷', 'přečte z ní všechny údaje pro daně (dodavatel, IČO, DPH, částky)'],
              ['📊', 'zapíše je do tabulky na vašem Google Disku i s fotkou'],
              ['✉️', 'pošle doklad vaší účetní e-mailem'],
            ].map(([icon, text]) => (
              <View key={text} style={styles.bullet}>
                <Text style={styles.bulletIcon}>{icon}</Text>
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
            <Text style={styles.lead}>
              Nastavení zabere asi 5 minut a projdeme ho spolu ve 3 krocích.
            </Text>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>Přihlaste se Googlem</Text>
            <Text style={styles.lead}>
              Doklady se ukládají na váš Google Disk a e-mail účetní odejde z vašeho Gmailu.
              Nic neukládáme u nás.
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Co uvidíte:</Text>
              <Text style={styles.infoText}>1. Výběr Google účtu — vyberte ten, který používáte.</Text>
              <Text style={styles.infoText}>
                2. Pokud Google napíše „Aplikace není ověřena“, klepněte na „Pokračovat“.
              </Text>
              <Text style={styles.infoText}>
                3. Povolte přístup. Aplikace uvidí jen soubory, které sama vytvoří, a e-maily umí
                jen odesílat — vaši poštu nečte.
              </Text>
            </View>
            {googleEmail ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneText}>✓ Přihlášeno: {googleEmail}</Text>
                {googleReady && (
                  <Text style={styles.doneSub}>Na Disku je připravená složka „Účtenkomat“ a tabulka.</Text>
                )}
              </View>
            ) : (
              <Pressable style={styles.bigBtn} onPress={google} disabled={googleBusy}>
                {googleBusy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.bigBtnText}>Přihlásit se Googlem</Text>}
              </Pressable>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Kam posílat doklady?</Text>
            <Text style={styles.label}>E-mail vaší účetní</Text>
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
            <Text style={styles.hint}>
              Tip: pro vyzkoušení zadejte nejdřív svůj vlastní e-mail. Účetní později změníte v Nastavení.
            </Text>
            <Text style={[styles.label, { marginTop: 20 }]}>Kdy posílat</Text>
            <Segmented
              value={s.sendMode}
              onChange={(v) => set({ sendMode: v })}
              options={[
                { id: 'per_photo', label: 'Každý doklad hned' },
                { id: 'per_period', label: 'Najednou za období' },
              ]}
            />
            <Text style={styles.hint}>
              {s.sendMode === 'per_photo'
                ? 'Účetní dostane každý doklad hned po vyfocení.'
                : 'Doklady se sbírají a pošlete je jedním tlačítkem, např. na konci čtvrtletí.'}
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Kdo bude doklady číst?</Text>
            <Text style={styles.lead}>
              Údaje z fotky přečte umělá inteligence. Potřebuje k tomu „klíč“ — heslo k vašemu účtu
              u vybrané služby. Vyberte službu a postupujte podle kroků.
            </Text>
            <AiKeySetup
              provider={s.aiProvider}
              onProviderChange={switchProvider}
              apiKey={apiKey}
              onKeyChange={setKey}
              modelFor={(p) => modelFor(s, p)}
              onVerified={setKeyOk}
            />
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.title}>Hotovo 🎉</Text>
            {[
              [!!googleEmail, googleEmail ? `Google účet ${googleEmail}` : 'Google účet nepřipojen'],
              [EMAIL_RE.test(s.accountantEmail.trim()), s.accountantEmail.trim()
                ? `Doklady půjdou na ${s.accountantEmail.trim()}` : 'E-mail účetní chybí'],
              [keyOk || !!apiKey, keyOk || apiKey ? 'Čtení dokladů nastaveno' : 'Klíč pro čtení dokladů chybí'],
            ].map(([ok, text]) => (
              <Text key={String(text)} style={[styles.summary, { color: ok ? colors.ok : colors.warn }]}>
                {ok ? '✓' : '⚠'} {text}
              </Text>
            ))}
            <Text style={styles.lead}>
              Až doklad vyfotíte, můžete hned fotit další — o dokončení vás upozorní notifikace.
              Cokoli změníte později v ⚙ Nastavení.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {step === 4 ? (
          <>
            <Pressable style={styles.secondaryBtn} onPress={() => finish(false)}>
              <Text style={styles.secondaryText}>Později</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => finish(true)}>
              <Text style={styles.primaryText}>Vyfotit první doklad</Text>
            </Pressable>
          </>
        ) : (
          <>
            {step > 0 && (
              <Pressable style={styles.secondaryBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.secondaryText}>Zpět</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
              onPress={next}
              disabled={!canContinue}
            >
              <Text style={styles.primaryText}>{step === 0 ? 'Začít' : 'Pokračovat'}</Text>
            </Pressable>
          </>
        )}
      </View>
      {skippable && !canContinue && (
        <Pressable onPress={next} style={styles.skip}>
          <Text style={styles.skipText}>Přeskočit, nastavím později</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 13, color: colors.muted, paddingHorizontal: 16, marginTop: 8 },
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 12 },
  lead: { fontSize: 16, color: colors.text, lineHeight: 23, marginBottom: 14 },
  bullet: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  bulletIcon: { fontSize: 24 },
  bulletText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 23 },
  infoBox: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21, marginBottom: 6 },
  doneBox: { backgroundColor: colors.okBg, borderRadius: 12, padding: 14 },
  doneText: { color: colors.ok, fontSize: 16, fontWeight: '700' },
  doneSub: { color: colors.text, fontSize: 14, marginTop: 4 },
  bigBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  hint: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20 },
  summary: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  actions: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  secondaryBtn: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  primaryBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { alignItems: 'center', paddingBottom: 12, backgroundColor: colors.card },
  skipText: { color: colors.muted, fontSize: 14, textDecorationLine: 'underline' },
});
