import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { getProductModelUrlCandidates } from '@/components/ProductModelViewer'

function mergeOneProduct(incoming: Product, old: Product): Product {
	let merged: Product = incoming

	if (!getProductPrimaryImageUrl(incoming) && getProductPrimaryImageUrl(old)) {
		merged = {
			...merged,
			image: merged.image ?? old.image,
			photo_url: merged.photo_url ?? old.photo_url,
			images: merged.images?.length ? merged.images : old.images,
			asset_images: merged.asset_images?.length ? merged.asset_images : old.asset_images,
		}
	}

	const incomingModels = getProductModelUrlCandidates(incoming)
	const oldModels = getProductModelUrlCandidates(old)
	if (incomingModels.length === 0 && oldModels.length > 0) {
		merged = {
			...merged,
			model_glb: merged.model_glb ?? old.model_glb,
			model_rfa_glb_preview: merged.model_rfa_glb_preview ?? old.model_rfa_glb_preview,
			model_ar_glb: merged.model_ar_glb ?? old.model_ar_glb,
			asset_3d_models: merged.asset_3d_models?.length
				? merged.asset_3d_models
				: old.asset_3d_models,
		}
	}

	return merged
}

/** Сохранить URL фото и 3D из предыдущего состояния, если в новом ответе API их нет (гонки запросов, кэш). */
export function mergeProductMediaFromPrevious(
	incoming: Product[],
	previous: Product[]
): Product[] {
	if (!previous.length) return incoming
	const prevById = new Map(previous.map(p => [p.id, p]))
	return incoming.map(p => {
		const old = prevById.get(p.id)
		if (!old) return p
		return mergeOneProduct(p, old)
	})
}
