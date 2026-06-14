import type { ProductDetail, ProductListItem } from '../types/catalog';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Приоритет URL для AR/3D — как на вебе. */
export function resolveModelGlbUrl(product: ProductListItem | ProductDetail): string | null {
  const detail = product as ProductDetail;
  const candidates: string[] = [];

  if (product.model_glb && isHttpUrl(product.model_glb)) {
    candidates.push(product.model_glb.trim());
  }
  if (detail.model_rfa_glb_preview && isHttpUrl(detail.model_rfa_glb_preview)) {
    candidates.push(detail.model_rfa_glb_preview.trim());
  }
  if (product.model_ar_glb && isHttpUrl(product.model_ar_glb)) {
    candidates.push(product.model_ar_glb.trim());
  }

  const assets = detail.asset_3d_models ?? [];
  for (const asset of assets) {
    const ext = (asset.file_ext || '').toLowerCase();
    if (['glb', 'gltf'].includes(ext) && asset.file_url && isHttpUrl(asset.file_url)) {
      candidates.push(asset.file_url.trim());
    }
  }

  return candidates[0] ?? null;
}

export function has3dModel(product: ProductListItem | ProductDetail): boolean {
  return resolveModelGlbUrl(product) !== null;
}

/** Google Scene Viewer (ARCore) — запасной вариант на Android. */
export function buildSceneViewerUrl(glbUrl: string): string {
  const file = encodeURIComponent(glbUrl);
  const fallback = encodeURIComponent(glbUrl);
  return (
    `intent://arvr.google.com/scene-viewer/1.0?file=${file}&mode=ar_preferred` +
    `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${fallback};end;`
  );
}
