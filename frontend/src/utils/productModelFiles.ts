import type { Product } from '@/types'
import { config } from '@/config'

function absolutize(url: string): string {
	const u = url.trim()
	if (u.startsWith('http://') || u.startsWith('https://')) return u
	const base = config.API_URL.replace(/\/$/, '')
	if (u.startsWith('/')) return `${base}${u}`
	return `${base}/media/${u.replace(/^\//, '')}`
}

/** URL файла .ifc для просмотра в браузере (поле или FileAsset). */
export function getIfcViewerUrl(product: Product): string | null {
	const candidates: string[] = []

	for (const asset of product.asset_3d_models || []) {
		const ext = (asset.file_ext || '').toLowerCase()
		const u = (asset.file_url || '').toLowerCase()
		if (ext === 'ifc' || u.endsWith('.ifc') || u.includes('.ifc?')) {
			if (asset.file_url) candidates.push(absolutize(asset.file_url))
		}
	}

	const mr = (product.model_rfa || '').trim()
	if (mr) {
		const low = mr.toLowerCase()
		if (low.split('?')[0].endsWith('.ifc') || low.includes('.ifc?')) {
			candidates.push(absolutize(mr))
		}
	}

	return candidates[0] ?? null
}

function isRfaPath(urlOrPath: string): boolean {
	const base = urlOrPath.split('?')[0].toLowerCase()
	return base.endsWith('.rfa')
}

/** Есть ли скачиваемый .rfa (presign только этот формат). */
export function hasDownloadableRfa(product: Product): boolean {
	const mr = (product.model_rfa || '').trim()
	if (mr && isRfaPath(mr)) return true
	return (product.asset_3d_models || []).some((asset) => {
		const ext = (asset.file_ext || '').toLowerCase()
		if (ext === 'rfa') return true
		const url = asset.file_url || ''
		const u = url.toLowerCase()
		return u.split('?')[0].endsWith('.rfa') || u.includes('.rfa?')
	})
}
