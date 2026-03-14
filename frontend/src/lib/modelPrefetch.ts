import { productService } from '../services/api'
import { Product, ProductFilters } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']
const GLB_CACHE_NAME = 'vizhub-glb-models'
const GLB_VERSION = 'v=opt4'
const PREFETCH_COUNT = 6

function getModelUrl(product: Product): string | null {
	if (!product) return null
	let url: string | null = null
	if (product.model_glb) url = product.model_glb
	else if (product.asset_3d_models && product.asset_3d_models.length > 0) {
		const first = product.asset_3d_models[0]
		if (first?.file_url) {
			const u = first.file_url.toLowerCase()
			const ext = u.substring(u.lastIndexOf('.') + 1).split('?')[0]
			if (MODEL_VIEWER_FORMATS.includes(ext)) url = first.file_url
		}
	}
	if (!url) return null
	return url + (url.includes('?') ? '&' : '?') + GLB_VERSION
}

async function prefetchUrl(url: string): Promise<void> {
	if (typeof caches === 'undefined') return
	try {
		if (await caches.match(url)) return
		const res = await fetch(url, { mode: 'cors' })
		if (!res.ok) return
		const cache = await caches.open(GLB_CACHE_NAME)
		await cache.put(url, res)
	} catch {
		/* ignore */
	}
}

async function prefetchModelsForProducts(results: Product[]): Promise<void> {
	if (!results?.length) return
	const urls = results.map(getModelUrl).filter((u): u is string => !!u)
	await Promise.all(urls.slice(0, PREFETCH_COUNT).map(prefetchUrl))
}

export async function prefetchFirstModels(): Promise<void> {
	try {
		const { results } = await productService.getProducts(undefined, 1, PREFETCH_COUNT)
		await prefetchModelsForProducts(results || [])
	} catch {
		/* ignore */
	}
}

export async function prefetchModelsForFilters(filters: ProductFilters): Promise<void> {
	try {
		const { results } = await productService.getProducts(filters, 1, PREFETCH_COUNT)
		await prefetchModelsForProducts(results || [])
	} catch {
		/* ignore */
	}
}
