import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'

/** Сохранить URL фото/превью из предыдущего состояния, если в новом ответе API их нет (гонка 3D↔2D, устаревший кэш). */
export function mergeProductMediaFromPrevious(
	incoming: Product[],
	previous: Product[]
): Product[] {
	if (!previous.length) return incoming
	const prevById = new Map(previous.map(p => [p.id, p]))
	return incoming.map(p => {
		const old = prevById.get(p.id)
		if (!old || getProductPrimaryImageUrl(p)) return p
		if (!getProductPrimaryImageUrl(old)) return p
		return {
			...p,
			image: p.image ?? old.image,
			photo_url: p.photo_url ?? old.photo_url,
			images: p.images?.length ? p.images : old.images,
			asset_images: p.asset_images?.length ? p.asset_images : old.asset_images,
		}
	})
}
