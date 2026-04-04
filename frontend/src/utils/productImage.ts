import { config } from '@/config'
import type { Product } from '@/types'

function absolutize(url: string): string {
	const u = url.trim()
	if (u.startsWith('http://') || u.startsWith('https://')) return u
	const base = config.API_URL.replace(/\/$/, '')
	if (u.startsWith('/')) return `${base}${u}`
	return `${base}/media/${u.replace(/^\//, '')}`
}

/** Первое доступное изображение товара для режима 2D в каталоге */
export function getProductPrimaryImageUrl(product: Product): string | null {
	if (product.image) return product.image
	if (product.photo_url) return product.photo_url
	const fromImages = product.images?.[0]?.image_url
	if (fromImages) return absolutize(fromImages)
	const fromAssets = product.asset_images?.[0]?.file_url
	if (fromAssets) return absolutize(fromAssets)
	return null
}
