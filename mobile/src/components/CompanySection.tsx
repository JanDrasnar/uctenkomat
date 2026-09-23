// Nastavení → Firma: založení firmy (správce), pozvání kolegů a připojení
// k firmě pozvánkou. Připojení nejdřív ověří, že aplikace na tomto účtu smí
// do firemní tabulky a složky — výsledek se ukáže srozumitelně.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  checkCompanyAccess, createCompany, currentGoogleEmail, getCompany, inviteColleague, joinCompany,
  leaveCompany, parseInvite, shareFolderWith, type AccessCheck, type CompanyInfo, type Invite,
} from '../google';
import { stampSheetIds } from '../pipeline';
import { colors } from '../theme';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Mode = 'idle' | 'create' | 'join';

export default function CompanySection({ accountantEmail }: { accountantEmail: string }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [inviteText, setInviteText] = useState('');
  const [checks, setChecks] = useState<AccessCheck[] | null>(null);
  const [colleague, setColleague] = useState('');
  const [invited, setInvited] = useState<string[]>([]);

  useEffect(() => {
    getCompany().then(setCompany);
  }, []);

  if (!currentGoogleEmail()) {
    return <Text style={styles.hint}>Nejdřív se přihlaste Googlem (výše).</Text>;
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await stampSheetIds();
      await createCompany(n);
      if (EMAIL_RE.test(accountantEmail.trim())) {
        await shareFolderWith(accountantEmail).catch(() => undefined);
      }
      setCompany(await getCompany());
      setMode('idle');
    } catch (e: any) {
      Alert.alert('Firmu se nepodařilo založit', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const email = colleague.trim();
    if (!EMAIL_RE.test(email)) {
      Alert.alert('Neplatný e-mail', 'Zadejte Google e-mail kolegy.');
      return;
    }
    setBusy(true);
    try {
      const text = await inviteColleague(email);
      setInvited([...invited, email]);
      setColleague('');
      // Google kolegovi pošle e-mail s pozvánkou; navíc jde poslat WhatsAppem apod.
      await Share.share({ message: text });
    } catch (e: any) {
      Alert.alert('Pozvání se nepovedlo', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function tryJoin(text: string) {
    const inv: Invite | null = parseInvite(text);
    if (!inv) {
      Alert.alert('Pozvánka nenalezena', 'Zkopírujte celou zprávu s pozvánkou (obsahuje kód UCT1-…).');
      return;
    }
    setBusy(true);
    setChecks(null);
    try {
      const result = await checkCompanyAccess(inv);
      setChecks(result);
      if (result.every((c) => c.ok)) {
        await stampSheetIds();
        await joinCompany(inv);
        setCompany(await getCompany());
        setMode('idle');
        Alert.alert('Připojeno ✓', `Doklady se teď ukládají do firmy „${inv.name}“.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function pasteInvite() {
    const text = await Clipboard.getStringAsync();
    if (parseInvite(text)) await tryJoin(text);
    else setMode('join');
  }

  function leave() {
    Alert.alert(
      'Opustit firmu?',
      'Další doklady se budou ukládat do vaší osobní tabulky. Doklady už uložené ve firmě tam zůstanou.',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Opustit',
          style: 'destructive',
          onPress: async () => {
            await leaveCompany();
            setCompany(null);
            setChecks(null);
          },
        },
      ],
    );
  }

  if (company) {
    return (
      <View>
        <Text style={styles.account}>
          {company.name}{company.role === 'admin' ? ' · jste správce' : ` · správce ${company.adminEmail}`}
        </Text>
        <Text style={styles.hint}>
          Doklady všech členů se ukládají do jedné firemní tabulky a složky na Disku správce.
        </Text>

        {company.role === 'admin' && (
          <>
            <Text style={[styles.label, { marginTop: 14 }]}>Pozvat kolegu</Text>
            <TextInput
              style={styles.input}
              value={colleague}
              onChangeText={setColleague}
              placeholder="kolega@gmail.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.primaryBtn} onPress={invite} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Pozvat</Text>}
            </Pressable>
            <Text style={styles.hint}>
              Kolega dostane od Googlu e-mail s pozvánkou. Pozvánku mu můžete poslat i jinak (WhatsApp, SMS) —
              nabídne se po klepnutí na Pozvat.
            </Text>
            {invited.map((e) => <Text key={e} style={styles.ok}>✓ Pozván: {e}</Text>)}
          </>
        )}

        <Pressable style={styles.secondaryBtn} onPress={leave}>
          <Text style={styles.secondaryText}>Opustit firmu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.hint}>
        Pracujete ve firmě s více lidmi? Doklady všech se mohou ukládat do jedné společné tabulky a složky.
      </Text>

      {mode === 'create' ? (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Název firmy</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="např. Firma XY s.r.o."
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.primaryBtn} onPress={create} disabled={busy || !name.trim()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Založit firmu</Text>}
          </Pressable>
        </>
      ) : mode === 'join' ? (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Vložte pozvánku</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={inviteText}
            onChangeText={setInviteText}
            placeholder="Celá zpráva nebo kód UCT1-…"
            placeholderTextColor={colors.muted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.primaryBtn} onPress={() => tryJoin(inviteText)} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Připojit se</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.primaryBtn} onPress={pasteInvite} disabled={busy}>
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryText}>📋  Připojit se k firmě (vložit pozvánku)</Text>}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setMode('create')}>
            <Text style={styles.secondaryText}>Založit novou firmu</Text>
          </Pressable>
        </>
      )}

      {checks && (
        <View style={styles.checks}>
          <Text style={styles.label}>Kontrola přístupu</Text>
          {checks.map((c) => (
            <View key={c.label}>
              <Text style={c.ok ? styles.ok : styles.error}>{c.ok ? '✓' : '✕'} {c.label}</Text>
              {c.detail && <Text style={styles.detail}>{c.detail}</Text>}
            </View>
          ))}
          {!checks.every((c) => c.ok) && (
            <Text style={styles.hint}>
              Aplikace na tomto účtu nemá přístup k firemním souborům. Ověřte, že správce pozval
              právě tento Google účet. Pokud ano, pošlete snímek této obrazovky autorovi aplikace.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  account: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  primaryBtn: {
    marginTop: 12, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', paddingHorizontal: 12,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  checks: {
    marginTop: 14, backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  ok: { color: colors.ok, fontWeight: '600', marginTop: 4 },
  error: { color: colors.error, fontWeight: '600', marginTop: 4 },
  detail: { color: colors.muted, fontSize: 12, marginLeft: 16 },
});
