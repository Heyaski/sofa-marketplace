import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, Pressable, Linking } from 'react-native';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Товар #{id}</Text>
      <Text style={styles.hint}>
        AR «Примерить» — следующий этап: ARCore / ARKit + GLB из API.
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => Linking.openURL(`https://vizhub.pro/products/${id}`)}
      >
        <Text style={styles.buttonText}>Открыть на сайте</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.buttonPrimary]} disabled>
        <Text style={styles.buttonTextPrimary}>Примерить в AR (скоро)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  hint: { color: '#6b7280', lineHeight: 22 },
  button: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#111827', borderColor: '#111827' },
  buttonText: { fontWeight: '600' },
  buttonTextPrimary: { color: '#fff', fontWeight: '600' },
});
