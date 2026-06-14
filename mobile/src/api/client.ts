import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.vizhub.pro';

export type ProductListItem = {
  id: number;
  title: string;
  article?: string;
  image?: string | null;
  model_glb?: string | null;
};

export async function fetchProducts(): Promise<ProductListItem[]> {
  const { data } = await axios.get(`${API_URL}/api/products/`, {
    params: { page_size: 40, catalog_visible_3d: true },
  });
  const rows = Array.isArray(data?.results) ? data.results : data;
  return (rows || []).map((p: Record<string, unknown>) => ({
    id: p.id as number,
    title: String(p.title || ''),
    article: p.article ? String(p.article) : undefined,
    image: (p.image as string) || null,
    model_glb: (p.model_glb as string) || null,
  }));
}

export function getApkInfoUrl() {
  return `${API_URL}/api/mobile/app-info/`;
}
