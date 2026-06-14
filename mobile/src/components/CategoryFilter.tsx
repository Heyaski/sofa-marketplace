import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../types/catalog';

type Props = {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
};

type CategoryGroup = {
  root: Category;
  children: Category[];
};

function buildGroups(categories: Category[]): CategoryGroup[] {
  const byParent = new Map<number | 'root', Category[]>();
  for (const cat of categories) {
    const key = cat.parent ?? 'root';
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }

  const roots = (byParent.get('root') ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return roots.map(root => ({
    root,
    children: (byParent.get(root.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
  }));
}

function Chip({
  label,
  active,
  onPress,
  compact,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CategoryFilter({ categories, selectedCategoryId, onSelectCategory }: Props) {
  const groups = useMemo(() => buildGroups(categories), [categories]);

  const activeGroup = useMemo(() => {
    if (!selectedCategoryId) return null;
    for (const group of groups) {
      if (group.root.id === selectedCategoryId) return group;
      if (group.children.some(c => c.id === selectedCategoryId)) return group;
    }
    return null;
  }, [groups, selectedCategoryId]);

  const subcategories = activeGroup?.children ?? [];

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip
          label="Все"
          active={selectedCategoryId === null}
          onPress={() => onSelectCategory(null)}
        />
        {groups.map(({ root }) => (
          <Chip
            key={root.id}
            label={root.name}
            active={
              selectedCategoryId === root.id ||
              (activeGroup?.root.id === root.id && selectedCategoryId !== null)
            }
            onPress={() => onSelectCategory(root.id)}
          />
        ))}
      </ScrollView>

      {subcategories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subRow}
        >
          <Chip
            label={`Все: ${activeGroup?.root.name}`}
            active={selectedCategoryId === activeGroup?.root.id}
            onPress={() => onSelectCategory(activeGroup!.root.id)}
            compact
          />
          {subcategories.map(child => (
            <Chip
              key={child.id}
              label={child.name}
              active={selectedCategoryId === child.id}
              onPress={() => onSelectCategory(child.id)}
              compact
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    alignItems: 'center',
  },
  subRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    maxWidth: 180,
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
});
