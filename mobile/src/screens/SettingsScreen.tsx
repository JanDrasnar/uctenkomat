import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { getAccountantEmail, setAccountantEmail } from '../settings';
import { colors } from '../theme';

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAccountantEmail().then((e) => {
      setEmail(e);
      setLoading(false);
    });
  }, []);

  async function save() {
    const trimmed = email.trim();
    if (trimmed && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      Alert.alert('Neplatný e-mail', 'Zadejte platnou e-mailovou adresu účetní.');
      return;
    }
    setSaving(true);
    try {
      await setAccountantEmail(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nastavení</Text>

      <Text style={styles.label}>E-mail účetní</Text>
      <Text style={styles.hint}>Kam se posílají doklady za období.</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      ) : (
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ucetni@firma.cz"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <View style={styles.actions}>
        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Zpět</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={save} disabled={saving || loading}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Uložit</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 8 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancel: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
