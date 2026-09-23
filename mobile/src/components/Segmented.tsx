import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function Segmented<T extends string>({
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

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, padding: 3,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  segmentTextActive: { color: colors.primaryText, fontWeight: '600' },
});
