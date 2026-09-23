import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { Doklad, DokladData } from '../types';
import { subscribe, updateDoklad } from '../store';
import { processDoklad, sendSingle, sheetRowValues } from '../pipeline';
import { updateRow } from '../google';
import { getSettings } from '../settings';
import { periodKey, periodLabel } from '../period';
import { colors, fmtKc } from '../theme';
import { fmtCzkSmall } from '../ai/pricing';

function Field({
  label, value, onChange, flagged, keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  flagged?: boolean;
  keyboard?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, flagged && styles.fieldLabelWarn]}>
        {label}{flagged ? '  ⚠ zkontrolujte' : ''}
      </Text>
      <TextInput
        style={[styles.input, flagged && styles.inputWarn]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        placeholder="—"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const num = (v: string) => (v.trim() ? Number(v.replace(/\s/g, '').replace(',', '.')) : null);

export default function ReviewScreen({ doklad, onClose }: { doklad: Doklad; onClose: () => void }) {
  const [doc, setDoc] = useState<Doklad>(doklad);
  const [data, setData] = useState<DokladData | null>(doklad.data);
  const [saving, setSaving] = useState(false);

  // Živé změny (doklad se může zrovna zpracovávat na pozadí).
  useEffect(() => subscribe((all) => {
    const cur = all.find((d) => d.id === doklad.id);
    if (!cur) return;
    setDoc(cur);
    setData((prev) => prev ?? cur.data);
  }), [doklad.id]);

  const flagged = (name: string) => !!data?.pole_ke_kontrole?.includes(name);
  const set = (patch: Partial<DokladData>) => setData((d) => (d ? { ...d, ...patch } : d));
  const setDod = (patch: Partial<DokladData['dodavatel']>) =>
    setData((d) => (d ? { ...d, dodavatel: { ...d.dodavatel, ...patch } } : d));

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const settings = await getSettings();
      const updated = (await updateDoklad(doc.id, {
        data: { ...data, pole_ke_kontrole: [] },
        reviewed: true,
        period: periodKey(data.datum_vystaveni, settings.periodType),
      }))!;
      if (updated.sheetRow) await updateRow(updated.sheetRow, sheetRowValues(updated));

      if (updated.sentAt && settings.accountantEmail) {
        Alert.alert('Doklad už byl odeslán', 'Poslat účetní opravenou verzi?', [
          { text: 'Ne', style: 'cancel', onPress: onClose },
          {
            text: 'Poslat opravu',
            onPress: async () => {
              try {
                await sendSingle(updated, settings.accountantEmail, true);
              } catch (e: any) {
                Alert.alert('Odeslání selhalo', e.message);
              }
              onClose();
            },
          },
        ]);
      } else {
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Uložení selhalo', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Doklad</Text>
        <Image source={{ uri: doc.photoUri }} style={styles.photo} resizeMode="contain" />

        {doc.status === 'zpracovava' && (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.bannerText}>{doc.step}</Text>
          </View>
        )}
        {doc.status === 'chyba' && (
          <View style={[styles.banner, { backgroundColor: colors.warnBg }]}>
            <Text style={[styles.bannerText, { color: colors.error }]}>{doc.error}</Text>
            <Pressable style={styles.retry} onPress={() => processDoklad(doc.id)}>
              <Text style={styles.retryText}>Zkusit znovu</Text>
            </Pressable>
          </View>
        )}
        {doc.status === 'hotovo' && (
          <Text style={styles.ok}>
            {doc.sentAt
              ? `✓ Odesláno účetní ${new Date(doc.sentAt).toLocaleString('cs-CZ')}`
              : `● Uloženo, odešle se souhrnně za ${periodLabel(doc.period)}`}
          </Text>
        )}
        {doc.driveLink && (
          <Pressable onPress={() => Linking.openURL(doc.driveLink!)}>
            <Text style={styles.link}>Fotka na Google Disku ↗</Text>
          </Pressable>
        )}
        {data?.ares_overeno && <Text style={styles.ok}>✓ Dodavatel ověřen v ARES</Text>}

        {data && (
          <>
            <Field label="Dodavatel" value={data.dodavatel?.nazev ?? ''}
              onChange={(v) => setDod({ nazev: v })} flagged={flagged('nazev')} />
            <Field label="IČO" value={data.dodavatel?.ico ?? ''}
              onChange={(v) => setDod({ ico: v || null })} flagged={flagged('ico')} keyboard="numeric" />
            <Field label="DIČ" value={data.dodavatel?.dic ?? ''}
              onChange={(v) => setDod({ dic: v || null })} flagged={flagged('dic')} />
            <Field label="Datum vystavení / DUZP (RRRR-MM-DD)" value={data.datum_vystaveni ?? ''}
              onChange={(v) => set({ datum_vystaveni: v || null })} flagged={flagged('datum_vystaveni')} />
            <Field label="Číslo dokladu" value={data.cislo_dokladu ?? ''}
              onChange={(v) => set({ cislo_dokladu: v || null })} flagged={flagged('cislo_dokladu')} />
            <Field label="Variabilní symbol" value={data.variabilni_symbol ?? ''}
              onChange={(v) => set({ variabilni_symbol: v || null })} flagged={flagged('variabilni_symbol')} />
            <Field label={`Celkem (${data.mena})`}
              value={data.castka_celkem != null ? String(data.castka_celkem) : ''}
              onChange={(v) => set({ castka_celkem: num(v) })}
              flagged={flagged('castka_celkem')} keyboard="numeric" />

            <Text style={styles.fieldLabel}>Rozpis DPH</Text>
            {data.dph_rozpis.length === 0 && <Text style={styles.note}>Bez rozpisu DPH</Text>}
            {data.dph_rozpis.map((r) => (
              <Text key={r.sazba} style={styles.dph}>
                {r.sazba} % — základ {fmtKc(r.zaklad)}, DPH {fmtKc(r.dph)}
              </Text>
            ))}

            {data.poznamka_extrakce ? (
              <Text style={styles.note}>Poznámka AI: {data.poznamka_extrakce}</Text>
            ) : null}
            {doc.aiUsage && (
              <Text style={styles.usage}>
                Přečetl {doc.aiProvider?.split('/')[1] ?? 'AI'} ·{' '}
                {doc.aiUsage.inputTokens.toLocaleString('cs-CZ')} + {doc.aiUsage.outputTokens.toLocaleString('cs-CZ')} tokenů
                {doc.aiUsage.costCzk != null
                  ? ` · ${fmtCzkSmall(doc.aiUsage.costCzk)} (kurz ČNB ${doc.aiUsage.usdCzk.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} Kč/USD)`
                  : ' · cena modelu není v ceníku'}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Zpět</Text>
        </Pressable>
        {data && doc.status !== 'zpracovava' && (
          <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Uložit opravy</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 },
  photo: {
    width: '100%', height: 260, backgroundColor: '#000', borderRadius: 12, marginBottom: 12,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card,
    borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  bannerText: { flex: 1, color: colors.text },
  retry: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  ok: { color: colors.ok, marginBottom: 6 },
  link: { color: colors.primary, marginBottom: 12, fontWeight: '600' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  fieldLabelWarn: { color: colors.warn, fontWeight: '600' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text,
  },
  inputWarn: { borderColor: colors.warn, backgroundColor: colors.warnBg },
  dph: { color: colors.text, marginBottom: 4 },
  note: { color: colors.muted, marginTop: 8, fontStyle: 'italic' },
  usage: { color: colors.muted, marginTop: 12, fontSize: 13 },
  actions: {
    flexDirection: 'row', padding: 16, gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  cancel: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
