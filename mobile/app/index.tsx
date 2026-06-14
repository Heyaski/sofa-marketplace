import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { fetchProducts, ProductListItem } from '../src/api/client';

export default function CatalogScreen() {
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setItems)
      .catch(() => setError('Не удалось загрузить каталог'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => (
        <Link href={`/product/${item.id}`} asChild>
          <Pressable style={styles.card}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.title}</Text>
              {item.article ? <Text style={styles.meta}>{item.article}</Text> : null}
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#f3f4f6' },
  cardBody: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#6b7280', marginTop: 4 },
});
