import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Doklad } from '../types';
import { subscribe } from '../store';
import { addPhoto, sendPeriod } from '../pipeline';
import { getSettings, type AppSettings } from '../settings';
import { colors, fmtKc } from '../theme';
import { periodLabel } from '../period';

function StatusIcon({ d }: { d: Doklad }) {
  if (d.status === 'zpracovava') return <ActivityIndicator color={colors.primary} />;
  if (d.status === 'chyba') return <Text style={[styles.flag, { color: colors.error }]}>✕</Text>;
  if (d.data?.pole_ke_kontrole.length && !d.reviewed) {
    return <Text style={[styles.flag, { color: colors.warn }]}>⚠</Text>;
  }
  return <Text style={[styles.flag, { color: d.sentAt ? colors.ok : colors.muted }]}>{d.sentAt ? '✓' : '●'}</Text>;
}

export default function HomeScreen({
  onOpen, onOpenSettings, autoCapture, onAutoCaptureDone,
}: {
  onOpen: (d: Doklad) => void;
  onOpenSettings: () => void;
  /** Po dokončení průvodce rovnou otevřít fotoaparát. */
  autoCapture?: boolean;
  onAutoCaptureDone?: () => void;
}) {
  const [docs, setDocs] = useState<Doklad[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => subscribe(setDocs), []);
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // Neodeslané hotové doklady po obdobích (pro souhrnné odeslání).
  const unsent = docs.filter((d) => d.status === 'hotovo' && !d.sentAt);
  const unsentPeriods = [...new Set(unsent.map((d) => d.period))];
  const processing = docs.filter((d) => d.status === 'zpracovava').length;

  useEffect(() => {
    if (!autoCapture) return;
    onAutoCaptureDone?.();
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture]);

  async function capture() {
    const s = await getSettings();
    setSettings(s);
    if (!s.accountantEmail && s.sendMode === 'per_photo') {
      Alert.alert('Chybí e-mail účetní', 'Nejdřív nastavte e-mail účetní v Nastavení.', [
        { text: 'Zrušit', style: 'cancel' },
        { text: 'Otevřít nastavení', onPress: onOpenSettings },
      ]);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Přístup ke kameře', 'Pro focení dokladů povolte přístup ke kameře.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    const a = result.assets[0];
    try {
      await addPhoto(a.uri, a.width, a.height);
    } catch (e: any) {
      Alert.alert('Fotku se nepodařilo uložit', e.message);
    }
  }

  function send(period: string) {
    const count = unsent.filter((d) => d.period === period).length;
    Alert.alert(
      'Odeslat účetní',
      `Odeslat ${count} dokladů za ${periodLabel(period)} na ${settings?.accountantEmail || '(nevyplněno)'}?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Odeslat',
          onPress: async () => {
            setSending(true);
            try {
              await sendPeriod(period);
            } catch (e: any) {
              Alert.alert('Odeslání selhalo', e.message);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Účtenkomat</Text>
        <Pressable onPress={onOpenSettings} hitSlop={12}>
          <Text style={styles.gear}>⚙</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        {settings?.sendMode === 'per_period' ? 'Odesílání souhrnně za období' : 'Každý doklad se hned posílá účetní'}
        {processing ? ` · zpracovávám ${processing}` : ''}
      </Text>

      <Pressable style={styles.captureBtn} onPress={capture}>
        <Text style={styles.captureBtnText}>＋ Vyfotit doklad</Text>
      </Pressable>

      <Text style={styles.listLabel}>Doklady</Text>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        ListEmptyComponent={<Text style={styles.empty}>Zatím žádné doklady. Vyfoťte první.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpen(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.data?.dodavatel?.nazev ?? (item.status === 'chyba' ? 'Zpracování selhalo' : 'Nový doklad')}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={2}>
                {item.status === 'zpracovava'
                  ? item.step
                  : item.status === 'chyba'
                    ? item.error
                    : `${item.data?.datum_vystaveni ?? '—'} · ${item.sentAt ? 'odesláno' : 'čeká na odeslání'}`}
              </Text>
            </View>
            {item.data && <Text style={styles.rowAmount}>{fmtKc(item.data.castka_celkem)}</Text>}
            <StatusIcon d={item} />
          </Pressable>
        )}
      />

      {unsentPeriods.map((p) => (
        <Pressable key={p} style={styles.sendBtn} onPress={() => send(p)} disabled={sending}>
          {sending
            ? <ActivityIndicator color="#fff" />
            : (
              <Text style={styles.sendBtnText}>
                Odeslat účetní – {periodLabel(p)} ({unsent.filter((d) => d.period === p).length}) →
              </Text>
            )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  gear: { fontSize: 24, color: colors.muted },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: 16 },
  captureBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 20,
  },
  captureBtnText: { color: colors.primaryText, fontSize: 18, fontWeight: '600' },
  listLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '600', color: colors.text },
  flag: { fontSize: 18, width: 20, textAlign: 'center' },
  sendBtn: {
    backgroundColor: colors.text, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
