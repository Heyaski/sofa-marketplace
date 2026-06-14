import axios from 'axios';
import type { Category, ProductDetail, ProductFilters, ProductListItem } from '../types/catalog';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.vizhub.pro';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

function mapProduct(row: Record<string, unknown>): ProductListItem {
  return {
    id: row.id as number,
    title: String(row.title || ''),
    title_display: row.title_display ? String(row.title_display) : undefined,
    article: row.article ? String(row.article) : undefined,
    image: (row.image as string) || (row.photo_url as string) || null,
    price: row.price != null ? String(row.price) : undefined,
    width: row.width != null ? String(row.width) : undefined,
    height: row.height != null ? String(row.height) : undefined,
    depth: row.depth != null ? String(row.depth) : undefined,
    model_glb: (row.model_glb as string) || null,
    model_ar_glb: (row.model_ar_glb as string) || null,
    model_3d_id: row.model_3d_id ? String(row.model_3d_id) : undefined,
    category: (row.category as Category) || null,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/categories/');
  return Array.isArray(data) ? data : [];
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  const params: Record<string, string | number> = {
    list_mode: '3d',
    page_size: filters.page_size ?? 60,
    page: filters.page ?? 1,
  };
  if (filters.category) {
    params.category = String(filters.category);
  }
  if (filters.search?.trim()) {
    params.search = filters.search.trim();
  }

  const { data } = await api.get('/api/products/', { params });
  const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  return rows.map((row: Record<string, unknown>) => mapProduct(row));
}

export async function fetchProduct(id: number): Promise<ProductDetail> {
  const { data } = await api.get<Record<string, unknown>>(`/api/products/${id}/`);
  const base = mapProduct(data);
  return {
    ...base,
    description: data.description ? String(data.description) : undefined,
    material: data.material ? String(data.material) : undefined,
    style: data.style ? String(data.style) : undefined,
    color: data.color ? String(data.color) : undefined,
    brand: data.brand ? String(data.brand) : undefined,
    model_usdz: data.model_usdz ? String(data.model_usdz) : undefined,
    model_rfa_glb_preview: data.model_rfa_glb_preview
      ? String(data.model_rfa_glb_preview)
      : undefined,
    asset_3d_models: Array.isArray(data.asset_3d_models)
      ? (data.asset_3d_models as ProductDetail['asset_3d_models'])
      : undefined,
  };
}

export function getApkInfoUrl() {
  return `${API_URL}/api/mobile/app-info/`;
}
