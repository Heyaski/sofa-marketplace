import type { Product } from '@/types'
import { config } from '@/config'

function normalizeModelUrl(url: string): string {
	try {
		if (url.startsWith('/')) {
			return encodeURI(url)
		}
		const parsed = new URL(url)
		parsed.pathname = parsed.pathname
			.split('/')
			.map(part => encodeURIComponent(decodeURIComponent(part)))
			.join('/')
		return parsed.toString()
	} catch {
		return encodeURI(url)
	}
}

/** Относительный путь или ключ S3 → абсолютный URL API. */
export function absolutizeModelUrl(url: string): string {
	const u = url.trim()
	if (!u) return u
	if (/^https?:\/\//i.test(u)) {
		return normalizeModelUrl(u)
	}
	const base = config.API_URL.replace(/\/$/, '')
	if (u.startsWith('/')) {
		return normalizeModelUrl(`${base}${u}`)
	}
	return normalizeModelUrl(`${base}/media/${u.replace(/^\//, '')}`)
}

function isUsableModelRef(value: string | null | undefined): boolean {
	return Boolean(value && String(value).trim())
}

function urlHasExtension(url: string, ext: string): boolean {
	return url.toLowerCase().split('?')[0].endsWith(ext)
}

/** Путь /media/* на том же домене, что и сайт (rewrites в next.config). */
export function preferSameOriginMediaUrl(url: string): string {
	if (!url) return url
	try {
		const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : config.API_URL)
		const api = new URL(config.API_URL.replace(/\/$/, '') + '/')
		if (parsed.host === api.host && parsed.pathname.startsWith('/media/')) {
			return parsed.pathname + parsed.search
		}
	} catch {
		/* ignore */
	}
	if (url.startsWith('/media/')) return url
	return url
}

/** USDZ — единственный формат AR «в комнату» на iPhone (Quick Look). */
export function resolveUsdzUrl(product: Product): string | null {
	const candidates: string[] = []
	if (product.model_usdz && isUsableModelRef(product.model_usdz)) {
		candidates.push(absolutizeModelUrl(product.model_usdz))
	}
	for (const asset of product.asset_3d_models ?? []) {
		if (!asset.file_url) continue
		const ext = (asset.file_ext || '').toLowerCase()
		const url = absolutizeModelUrl(asset.file_url)
		if (ext === 'usdz' || urlHasExtension(url, '.usdz')) {
			candidates.push(url)
		}
	}
	return candidates.find(u => urlHasExtension(u, '.usdz')) ?? null
}

/** Same-origin URL для Quick Look (прокси /api/ar-model). */
export function sameOriginArModelUrl(productId: number, format: 'usdz' | 'glb' = 'usdz'): string {
	return `/api/ar-model/${productId}?format=${format}`
}

/** iPhone: AR в комнату из GLB (USDZ генерируется на сервере автоматически). */
export function canUseIosRoomAr(product: Product): boolean {
	return resolveGlbUrl(product) !== null || resolveUsdzUrl(product) !== null
}

/** GLB / GLTF для model-viewer (3D и AR на Android). */
export function resolveGlbUrl(product: Product): string | null {
	const candidates: string[] = []
	if (product.model_glb && isUsableModelRef(product.model_glb)) {
		candidates.push(absolutizeModelUrl(product.model_glb))
	}
	if (product.model_ar_glb && isUsableModelRef(product.model_ar_glb)) {
		candidates.push(absolutizeModelUrl(product.model_ar_glb))
	}
	if (product.model_rfa_glb_preview && isUsableModelRef(product.model_rfa_glb_preview)) {
		candidates.push(absolutizeModelUrl(product.model_rfa_glb_preview))
	}
	for (const asset of product.asset_3d_models ?? []) {
		if (!asset.file_url) continue
		const ext = (asset.file_ext || '').toLowerCase()
		const url = absolutizeModelUrl(asset.file_url)
		if (['glb', 'gltf'].includes(ext) || /\.(glb|gltf)(\?|$)/i.test(url)) {
			candidates.push(url)
		}
	}
	return candidates.find(u => /\.(glb|gltf)(\?|$)/i.test(u)) ?? null
}

/** FBX — только просмотр в Three.js (Safari не ставит FBX в комнату). */
export function resolveFbxUrl(product: Product): string | null {
	const candidates: string[] = []
	if (product.model_fbx && isUsableModelRef(product.model_fbx)) {
		candidates.push(absolutizeModelUrl(product.model_fbx))
	}
	for (const asset of product.asset_3d_models ?? []) {
		if (!asset.file_url) continue
		const ext = (asset.file_ext || '').toLowerCase()
		const url = absolutizeModelUrl(asset.file_url)
		if (ext === 'fbx' || urlHasExtension(url, '.fbx')) {
			candidates.push(url)
		}
	}
	return candidates.find(u => urlHasExtension(u, '.fbx')) ?? null
}

export function hasArModel(product: Product): boolean {
	return resolveGlbUrl(product) !== null || resolveFbxUrl(product) !== null
}

export function isIosDevice(): boolean {
	if (typeof navigator === 'undefined') return false
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	)
}
