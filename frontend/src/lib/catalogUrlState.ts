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

/** Совпадает с backend/apps/catalog/views.py (TOTAL 460, near_full_floor TOTAL−42). */
const COLOR_SCALE_TOTAL = 460
const COLOR_HUE_NEAR_FULL_FLOOR = COLOR_SCALE_TOTAL - 42

/**
 * Убираем из состояния «почти весь» диапазон цвета (напр. 0–420 в URL): иначе запросы к API тормозят.
 * Возвращает undefined — параметр не добавлять в фильтры (как «не выбран цвет»).
 */
function normalizeNearFullColorHueParam(raw: string): string | undefined {
	const parts = raw.trim().split('-')
	if (parts.length !== 2) return raw
	const min = Number(parts[0])
	const max = Number(parts[1])
	if (!Number.isFinite(min) || !Number.isFinite(max)) return raw
	let lo = Math.max(0, Math.min(COLOR_SCALE_TOTAL, min))
	let hi = Math.max(0, Math.min(COLOR_SCALE_TOTAL, max))
	if (lo > hi) [lo, hi] = [hi, lo]
	if (lo <= 0 && hi >= COLOR_HUE_NEAR_FULL_FLOOR) return undefined
	return `${lo}-${hi}`
}

export function parseCatalogSearchParams(
	params: URLSearchParams
): { filters: ProductFilters; view: CatalogViewMode; page: number } {
	const filters: ProductFilters = {}

	for (const key of FILTER_STRING_KEYS) {
		const v = params.get(key)?.trim()
		if (!v) continue
		if (key === 'category') {
			const ids = v
				.split(',')
				.map((s) => parseInt(s.trim(), 10))
				.filter((n) => Number.isFinite(n) && n > 0)
			if (ids.length) {
				filters.category = ids.join(',')
			}
			continue
		}
		if (key === 'color_hue') {
			const normalized = normalizeNearFullColorHueParam(v)
			if (!normalized) continue
			;(filters as Record<string, string>)[key] = normalized
			continue
		}
		;(filters as Record<string, string>)[key] = v
	}
	for (const key of FILTER_NUM_KEYS) {
		const raw = params.get(key)
		if (raw == null || raw === '') continue
		const n = Number(raw)
		if (Number.isFinite(n)) (filters as Record<string, number>)[key] = n
	}

	const v = params.get('view')
	// По умолчанию 2D — быстрый каталог с PNG; 3D только по ?view=3d
	const view: CatalogViewMode = v === '3d' ? '3d' : '2d'
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
		if (v === undefined || v === null || String(v).trim() === '') continue
		if (key === 'category') {
			const ids = String(v)
				.split(',')
				.map((s) => parseInt(s.trim(), 10))
				.filter((n) => Number.isFinite(n) && n > 0)
			if (ids.length) q.set('category', ids.join(','))
			continue
		}
		q.set(key, String(v))
	}
	for (const key of FILTER_NUM_KEYS) {
		const v = filters[key]
		if (typeof v === 'number' && Number.isFinite(v)) {
			q.set(key, String(v))
		}
	}

	if (view === '3d') q.set('view', '3d')
	if (page > 1 && view === '3d') q.set('page', String(page))

	return q.toString()
}

/** Сравнение без учёта порядка параметров (иначе лишний router.replace и сброс состояния). */
export function catalogQueryStringsEqual(a: string, b: string): boolean {
	if (a === b) return true
	const normalize = (raw: string) => {
		const p = new URLSearchParams(raw)
		return Array.from(p.entries())
			.sort(([k1], [k2]) => (k1 < k2 ? -1 : k1 > k2 ? 1 : 0))
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&')
	}
	return normalize(a) === normalize(b)
}

const CATALOG_LAST_QUERY_KEY = 'catalog:lastQuery'

/** Событие: обновить href ссылок «Каталог» в шапке/нижней навигации (Next router.replace не шлёт popstate). */
export const CATALOG_NAV_HREF_REFRESH = 'catalog-nav-href-refresh'

export function notifyCatalogNavHrefRefresh(): void {
	if (typeof window === 'undefined') return
	try {
		window.dispatchEvent(new Event(CATALOG_NAV_HREF_REFRESH))
	} catch {
		/* ignore */
	}
}

export function persistCatalogQueryForBackNavigation(queryWithoutQuestion: string): void {
	if (typeof window === 'undefined') return
	try {
		if (queryWithoutQuestion) {
			window.sessionStorage.setItem(CATALOG_LAST_QUERY_KEY, queryWithoutQuestion)
		} else {
			window.sessionStorage.removeItem(CATALOG_LAST_QUERY_KEY)
		}
	} catch {
		/* ignore */
	}
}

export function getLastCatalogQueryForBackNavigation(): string {
	if (typeof window === 'undefined') return ''
	try {
		return window.sessionStorage.getItem(CATALOG_LAST_QUERY_KEY) || ''
	} catch {
		return ''
	}
}
