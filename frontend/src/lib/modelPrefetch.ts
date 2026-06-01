import { getProductModelUrlCandidates } from '../components/ProductModelViewer'
import { productService } from '../services/api'
import { Product, ProductFilters } from '../types'
import { prefetchGlbModels } from './glbModelCache'

const PREFETCH_COUNT = 12

function primaryModelUrls(products: Product[]): string[] {
	return products
		.map((p) => getProductModelUrlCandidates(p)[0])
		.filter((u): u is string => !!u)
}

export async function prefetchModelsForProducts(results: Product[]): Promise<void> {
	if (!results?.length) return
	prefetchGlbModels(primaryModelUrls(results).slice(0, PREFETCH_COUNT))
}

export async function prefetchFirstModels(): Promise<void> {
	try {
		const { results } = await productService.getProducts(
			{ list_mode: '3d' },
			1,
			PREFETCH_COUNT
		)
		await prefetchModelsForProducts(results || [])
	} catch {
		/* ignore */
	}
}

export async function prefetchModelsForFilters(filters: ProductFilters): Promise<void> {
	try {
		const { results } = await productService.getProducts(
			{ ...filters, list_mode: '3d' },
			1,
			PREFETCH_COUNT
		)
		await prefetchModelsForProducts(results || [])
	} catch {
		/* ignore */
	}
}
