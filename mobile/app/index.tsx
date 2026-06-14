import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchCategories, fetchProducts } from '../src/api/client';
import CategoryFilter from '../src/components/CategoryFilter';
import ProductCard from '../src/components/ProductCard';
import type { Category, ProductListItem } from '../src/types/catalog';

export default function CatalogScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await fetchProducts({
        category: selectedCategoryId ?? undefined,
        search: search || undefined,
        page_size: 80,
      });
      setItems(rows);
    } catch {
      setError('Не удалось загрузить каталог');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategoryId, search]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const onSubmitSearch = () => setSearch(searchDraft.trim());

  const header = (
    <View style={styles.header}>
      <Text style={styles.subtitle}>3D каталог · примерка в AR</Text>
      <TextInput
        style={styles.search}
        placeholder="Поиск по названию, артикулу…"
        placeholderTextColor="#9ca3af"
        value={searchDraft}
        onChangeText={setSearchDraft}
        onSubmitEditing={onSubmitSearch}
        returnKeyType="search"
      />
      {categories.length > 0 ? (
        <CategoryFilter
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
      ) : null}
      {!loading && !error ? (
        <Text style={styles.count}>
          {items.length} {items.length === 1 ? 'товар' : items.length < 5 ? 'товара' : 'товаров'} с 3D
        </Text>
      ) : null}
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={{ marginTop: 24 }}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={item => String(item.id)}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadProducts({ refresh: true })} />
      }
      renderItem={({ item }) => <ProductCard item={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>В этой категории нет товаров с 3D моделью</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  header: { gap: 0, marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  search: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
  },
  count: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  list: { padding: 12, gap: 10, paddingBottom: 24 },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 32,
    fontSize: 15,
  },
});
