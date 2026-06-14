export type Category = {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  parent_category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

export type ProductListItem = {
  id: number;
  title: string;
  title_display?: string;
  article?: string;
  image?: string | null;
  price?: string;
  width?: string;
  height?: string;
  depth?: string;
  model_glb?: string | null;
  model_ar_glb?: string | null;
  model_3d_id?: string;
  category?: Category | null;
};

export type ProductDetail = ProductListItem & {
  description?: string;
  material?: string;
  style?: string;
  color?: string;
  brand?: string;
  model_usdz?: string;
  model_rfa_glb_preview?: string;
  asset_3d_models?: Array<{
    asset_id: string;
    file_type: string;
    file_url: string;
    file_ext: string;
    description?: string;
  }>;
};

export type ProductFilters = {
  category?: number;
  search?: string;
  page?: number;
  page_size?: number;
};
