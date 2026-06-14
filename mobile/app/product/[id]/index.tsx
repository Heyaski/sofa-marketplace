import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProduct } from '../../../src/api/client';
import type { ProductDetail } from '../../../src/types/catalog';
import { has3dModel, resolveModelGlbUrl } from '../../../src/utils/modelUrl';

function formatPrice(price?: string): string | null {
  if (!price) return null;
  const num = Number(price);
  if (!Number.isFinite(num)) return null;
  return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const productId = Number(id);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(productId)) {
      setError('Некорректный товар');
      setLoading(false);
      return;
    }
    fetchProduct(productId)
      .then(setProduct)
      .catch(() => setError('Не удалось загрузить товар'))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.center}>
        <Text>{error || 'Товар не найден'}</Text>
      </View>
    );
  }

  const title = product.title_display || product.title;
  const price = formatPrice(product.price);
  const modelUrl = resolveModelGlbUrl(product);
  const canAr = has3dModel(product);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]} />
      )}

      <Text style={styles.title}>{title}</Text>
      {product.article ? <Text style={styles.meta}>Артикул: {product.article}</Text> : null}
      {price ? <Text style={styles.price}>{price}</Text> : null}

      {product.width || product.depth || product.height ? (
        <Text style={styles.meta}>
          Размеры: {[product.width, product.depth, product.height].filter(Boolean).join(' × ')} см
        </Text>
      ) : null}

      {product.material ? <Text style={styles.meta}>Материал: {product.material}</Text> : null}
      {product.color ? <Text style={styles.meta}>Цвет: {product.color}</Text> : null}

      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      {canAr && modelUrl ? (
        <Pressable
          style={styles.buttonPrimary}
          onPress={() =>
            router.push({
              pathname: '/product/[id]/ar',
              params: { id: String(product.id), modelUrl, title },
            })
          }
        >
          <Text style={styles.buttonPrimaryText}>Примерить в AR</Text>
        </Pressable>
      ) : (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>3D модель для этого товара пока недоступна</Text>
        </View>
      )}

      <Pressable
        style={styles.button}
        onPress={() => Linking.openURL(`https://www.vizhub.pro/product/${product.id}`)}
      >
        <Text style={styles.buttonText}>Открыть на сайте</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f3f4f6' },
  heroPlaceholder: { backgroundColor: '#e5e7eb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  price: { fontSize: 20, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 14, color: '#6b7280' },
  description: { fontSize: 15, lineHeight: 22, color: '#374151', marginTop: 4 },
  buttonPrimary: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  buttonPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  button: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', color: '#111827' },
  warnBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  warnText: { color: '#92400e', fontSize: 14 },
});
