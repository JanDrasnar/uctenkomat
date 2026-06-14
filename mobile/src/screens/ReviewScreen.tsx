import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { Doklad, DokladData } from '../types';
import { API_BASE_URL, saveDoklad } from '../api';
import { colors } from '../theme';

// Pole, která chce uživatel typicky kontrolovat/opravovat.
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

export default function ReviewScreen({
  doklad, onDone, onCancel,
}: {
  doklad: Doklad;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<DokladData>(doklad.data);
  const [saving, setSaving] = useState(false);

  const flagged = (name: string) => data.pole_ke_kontrole?.includes(name);
  const set = (patch: Partial<DokladData>) => setData((d) => ({ ...d, ...patch }));
  const setDod = (patch: Partial<DokladData['dodavatel']>) =>
    setData((d) => ({ ...d, dodavatel: { ...d.dodavatel, ...patch } }));

  async function save() {
    setSaving(true);
    try {
      await saveDoklad(doklad.id, data);
      onDone();
    } catch (e: any) {
      Alert.alert('Chyba', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Zkontrolujte doklad</Text>

        <Image
          source={{ uri: `${API_BASE_URL}${doklad.imageUrl}` }}
          style={styles.photo}
          resizeMode="contain"
        />

        {data.qr_platba_nalezena && (
          <Text style={styles.qr}>✓ Nalezena QR Platba — částka a VS ověřeny</Text>
        )}
        {data.ares_overeno && (
          <Text style={styles.ares}>✓ Dodavatel ověřen v ARES</Text>
        )}

        <Field label="Dodavatel" value={data.dodavatel?.nazev ?? ''}
          onChange={(v) => setDod({ nazev: v })} flagged={flagged('nazev')} />
        <Field label="IČO" value={data.dodavatel?.ico ?? ''}
          onChange={(v) => setDod({ ico: v })} flagged={flagged('ico')} keyboard="numeric" />
        <Field label="Datum vystavení (RRRR-MM-DD)" value={data.datum_vystaveni ?? ''}
          onChange={(v) => set({ datum_vystaveni: v })} flagged={flagged('datum_vystaveni')} />
        <Field label="Celkem (Kč)" value={data.castka_celkem != null ? String(data.castka_celkem) : ''}
          onChange={(v) => set({ castka_celkem: v ? Number(v.replace(',', '.')) : null })}
          flagged={flagged('castka_celkem')} keyboard="numeric" />
        <Field label="Variabilní symbol" value={data.variabilni_symbol ?? ''}
          onChange={(v) => set({ variabilni_symbol: v })} />

        {data.poznamka_extrakce ? (
          <Text style={styles.note}>Poznámka: {data.poznamka_extrakce}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Zpět</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveText}>Uložit do období</Text>}
        </Pressable>
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
  qr: { color: colors.ok, marginBottom: 4 },
  ares: { color: colors.ok, marginBottom: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  fieldLabelWarn: { color: colors.warn, fontWeight: '600' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text,
  },
  inputWarn: { borderColor: colors.warn, backgroundColor: colors.warnBg },
  note: { color: colors.muted, marginTop: 8, fontStyle: 'italic' },
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
