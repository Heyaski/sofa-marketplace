import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { ProductListItem } from '../types/catalog';
import { has3dModel } from '../utils/modelUrl';

type Props = {
  item: ProductListItem;
};

function formatPrice(price?: string): string | null {
  if (!price) return null;
  const num = Number(price);
  if (!Number.isFinite(num)) return null;
  return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
}

export default function ProductCard({ item }: Props) {
  const title = item.title_display || item.title;
  const price = formatPrice(item.price);
  const canAr = has3dModel(item);

  return (
    <Link href={`/product/${item.id}`} asChild>
      <Pressable style={styles.card}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {item.article ? <Text style={styles.meta}>Арт. {item.article}</Text> : null}
          {price ? <Text style={styles.price}>{price}</Text> : null}
          {item.width && item.depth ? (
            <Text style={styles.meta}>
              {item.width}×{item.depth} см
            </Text>
          ) : null}
        </View>
        {canAr ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3D</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#f3f4f6' },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280' },
  price: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
  badge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
});
