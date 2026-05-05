import type { ProductFilters } from '@/types'

export type CatalogViewMode = '2d' | '3d'

const FILTER_STRING_KEYS: (keyof ProductFilters)[] = [
	'search',
	'category',
	'material',
	'style',
	'color',
	'color_hue',
	'brand',
	'country',
	'availability',
	'ordering',
]

const FILTER_NUM_KEYS: (keyof ProductFilters)[] = [
	'price_min',
	'price_max',
	'width_min',
	'width_max',
	'depth_min',
	'depth_max',
]

export function parseCatalogSearchParams(
	params: URLSearchParams
): { filters: ProductFilters; view: CatalogViewMode; page: number } {
	const filters: ProductFilters = {}

	for (const key of FILTER_STRING_KEYS) {
		const v = params.get(key)?.trim()
		if (v) (filters as Record<string, string>)[key] = v
	}
	for (const key of FILTER_NUM_KEYS) {
		const raw = params.get(key)
		if (raw == null || raw === '') continue
		const n = Number(raw)
		if (Number.isFinite(n)) (filters as Record<string, number>)[key] = n
	}

	const v = params.get('view')
	const view: CatalogViewMode = v === '2d' ? '2d' : '3d'
	const p = Number(params.get('page') || '1')
	const page = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1

	return { filters, view, page }
}

export function buildCatalogSearchParams(
	filters: ProductFilters,
	view: CatalogViewMode,
	page: number
): string {
	const q = new URLSearchParams()

	for (const key of FILTER_STRING_KEYS) {
		const v = filters[key]
		if (v !== undefined && v !== null && String(v).trim() !== '') {
			q.set(key, String(v))
		}
	}
	for (const key of FILTER_NUM_KEYS) {
		const v = filters[key]
		if (typeof v === 'number' && Number.isFinite(v)) {
			q.set(key, String(v))
		}
	}

	if (view === '2d') q.set('view', '2d')
	if (page > 1 && view === '3d') q.set('page', String(page))

	return q.toString()
}
