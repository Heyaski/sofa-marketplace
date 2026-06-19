import type { Product } from '@/types'

function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim())
}

/** USDZ для AR Quick Look в Safari (iOS). */
export function resolveUsdzUrl(product: Product): string | null {
	if (product.model_usdz && isHttpUrl(product.model_usdz)) {
		return product.model_usdz.trim()
	}
	for (const asset of product.asset_3d_models ?? []) {
		const ext = (asset.file_ext || '').toLowerCase()
		if (ext === 'usdz' && asset.file_url && isHttpUrl(asset.file_url)) {
			return asset.file_url.trim()
		}
	}
	return null
}

/** GLB для превью / запасной AR (Android Scene Viewer в этом же веб-приложении). */
export function resolveGlbUrl(product: Product): string | null {
	const candidates: string[] = []
	if (product.model_glb && isHttpUrl(product.model_glb)) candidates.push(product.model_glb.trim())
	if (product.model_ar_glb && isHttpUrl(product.model_ar_glb)) {
		candidates.push(product.model_ar_glb.trim())
	}
	if (product.model_rfa_glb_preview && isHttpUrl(product.model_rfa_glb_preview)) {
		candidates.push(product.model_rfa_glb_preview.trim())
	}
	for (const asset of product.asset_3d_models ?? []) {
		const ext = (asset.file_ext || '').toLowerCase()
		if (['glb', 'gltf'].includes(ext) && asset.file_url && isHttpUrl(asset.file_url)) {
			candidates.push(asset.file_url.trim())
		}
	}
	return candidates[0] ?? null
}

export function hasArModel(product: Product): boolean {
	return resolveUsdzUrl(product) !== null || resolveGlbUrl(product) !== null
}

export function isIosDevice(): boolean {
	if (typeof navigator === 'undefined') return false
	return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
