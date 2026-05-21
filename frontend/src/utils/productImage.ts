import { config } from '@/config'
import type { Product } from '@/types'

function absolutize(url: string): string {
	const u = url.trim()
	if (u.startsWith('http://') || u.startsWith('https://')) return u
	const base = config.API_URL.replace(/\/$/, '')
	if (u.startsWith('/')) return `${base}${u}`
	return `${base}/media/${u.replace(/^\//, '')}`
}

function isHttpUrl(url: string | null | undefined): boolean {
	if (!url || !String(url).trim()) return false
	return /^https?:\/\//i.test(String(url).trim())
}

/** Первое доступное изображение товара для режима 2D в каталоге */
export function getProductPrimaryImageUrl(product: Product): string | null {
	if (product.image && isHttpUrl(product.image)) return absolutize(product.image)
	if (product.image && product.image.startsWith('/')) return absolutize(product.image)
	if (product.photo_url && isHttpUrl(product.photo_url)) return absolutize(product.photo_url)
	const fromImages = product.images?.[0]?.image_url
	if (fromImages) return absolutize(fromImages)
	const fromAssets = product.asset_images?.[0]?.file_url
	if (fromAssets) return absolutize(fromAssets)
	return null
}
