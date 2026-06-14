import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Doklad, PeriodSummary } from '../types';
import { getPeriod, getPeriods, sendPeriod, uploadDoklad } from '../api';
import { getAccountantEmail } from '../settings';
import { colors, fmtKc } from '../theme';
import { periodLabel } from '../period';

export default function HomeScreen({
  onReview, onOpenSettings,
}: {
  onReview: (d: Doklad) => void;
  onOpenSettings: () => void;
}) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [docs, setDocs] = useState<Doklad[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Aktuální období = to s nejvíce doklady, nebo první. Pro MVP zjednodušeno.
  const current = periods.find((p) => !p.sent) ?? periods[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ps = await getPeriods();
      setPeriods(ps);
      const cur = ps.find((p) => !p.sent) ?? ps[0];
      if (cur) {
        const detail = await getPeriod(cur.period);
        setDocs(detail.documents);
      } else {
        setDocs([]);
      }
    } catch (e: any) {
      Alert.alert('Chyba', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function capture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Přístup ke kameře', 'Pro focení dokladů povolte přístup ke kameře.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;

    setBusy(true);
    try {
      const doklad = await uploadDoklad(result.assets[0].uri);
      onReview(doklad);
    } catch (e: any) {
      Alert.alert('Nepodařilo se zpracovat doklad', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!current) return;
    const accountantEmail = await getAccountantEmail();
    if (!accountantEmail) {
      Alert.alert('Chybí e-mail účetní', 'Nejdřív nastavte e-mail účetní v Nastavení.', [
        { text: 'Zrušit', style: 'cancel' },
        { text: 'Otevřít nastavení', onPress: onOpenSettings },
      ]);
      return;
    }
    Alert.alert('Odeslat účetní', `Odeslat ${current.count} dokladů za ${periodLabel(current.period)} na ${accountantEmail}?`, [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Odeslat',
        onPress: async () => {
          setBusy(true);
          try {
            const r = await sendPeriod(current.period, accountantEmail);
            const msg = r.email?.sent
              ? `Odesláno účetní (${r.documents} dokladů).`
              : `Vygenerováno ${r.documents} dokladů. ${r.email?.reason ?? ''}`;
            Alert.alert('Hotovo', msg);
            load();
          } catch (e: any) {
            Alert.alert('Chyba', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.periodTitle}>
            {current ? periodLabel(current.period) : 'Žádné doklady'}
          </Text>
          <Pressable onPress={onOpenSettings} hitSlop={12}>
            <Text style={styles.gear}>⚙</Text>
          </Pressable>
        </View>
        {current && (
          <Text style={styles.periodSub}>
            {current.count} dokladů · {fmtKc(current.total)}
          </Text>
        )}
      </View>

      <Pressable style={styles.captureBtn} onPress={capture} disabled={busy}>
        <Text style={styles.captureBtnText}>＋ Vyfotit doklad</Text>
      </Pressable>

      <Text style={styles.listLabel}>Naposledy přidané</Text>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Zatím žádné doklady. Vyfoťte první.</Text> : null
        }
        renderItem={({ item }) => {
          const needsCheck = !item.reviewed || item.data.pole_ke_kontrole?.length > 0;
          return (
            <Pressable style={styles.row} onPress={() => onReview(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.data.dodavatel?.nazev ?? 'Neznámý dodavatel'}</Text>
                <Text style={styles.rowMeta}>
                  {item.data.datum_vystaveni ?? '—'} · {item.data.typ_dokladu}
                </Text>
              </View>
              <Text style={styles.rowAmount}>{fmtKc(item.data.castka_celkem)}</Text>
              <Text style={needsCheck ? styles.flagWarn : styles.flagOk}>
                {needsCheck ? '⚠' : '✓'}
              </Text>
            </Pressable>
          );
        }}
      />

      {current && current.count > 0 && (
        <Pressable style={styles.sendBtn} onPress={send} disabled={busy}>
          <Text style={styles.sendBtnText}>Odeslat účetní →</Text>
        </Pressable>
      )}

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Zpracovávám…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gear: { fontSize: 24, color: colors.muted },
  periodTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  periodSub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  captureBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 20,
  },
  captureBtnText: { color: colors.primaryText, fontSize: 18, fontWeight: '600' },
  listLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '600', color: colors.text, marginRight: 10 },
  flagWarn: { fontSize: 18, color: colors.warn },
  flagOk: { fontSize: 18, color: colors.ok },
  sendBtn: {
    backgroundColor: colors.text, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  sendBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlayText: { marginTop: 12, color: colors.text, fontSize: 16 },
});
