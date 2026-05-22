import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { basketService, categoryService, productService } from '../services/api'
import { Basket, Category, Product, ProductFilters } from '../types'
import { mergeProductMediaFromPrevious } from '@/utils/mergeProductMedia'

// Универсальная функция для обработки форматов ответов (с results или без)
const extractResults = (response: any) => {
	if (Array.isArray(response)) return response
	if (response && Array.isArray(response.results)) return response.results
	return []
}

export type ProductsPaginationMode = 'infinite' | 'paged'
/** Ключ списка каталога: 2D (фото) и 3D (model-viewer) — отдельные кэш и состояние. */
export type CatalogListKey = '2d' | '3d'
const PRODUCTS_CACHE_TTL_MS = 60_000
const firstPageProductsCache = new Map<
	string,
	{ products: Product[]; hasMore: boolean; totalPages: number; cachedAt: number }
>()
let categoriesCache: { data: Category[]; cachedAt: number } | null = null
const CATEGORIES_CACHE_TTL_MS = 300_000

// ---------------------------
// 🛍️ useProducts (пагинация: «загрузить ещё» или постранично)
// ---------------------------
export const useProducts = (
	filters?: ProductFilters,
	options?: {
		paginationMode?: ProductsPaginationMode
		forcedPage?: number
		onPageChange?: (page: number) => void
		/** 2d | 3d — раздельные списки; не путать кэш и ответы API. */
		catalogListKey?: CatalogListKey
		/** false — не запрашивать API (пока пользователь не открыл этот режим). */
		enabled?: boolean
	}
) => {
	const paginationMode: ProductsPaginationMode = options?.paginationMode ?? 'infinite'
	const forcedPage = options?.forcedPage
	const catalogListKey = options?.catalogListKey ?? 'default'
	const enabled = options?.enabled !== false
	const onPageChangeRef = useRef(options?.onPageChange)
	onPageChangeRef.current = options?.onPageChange
	const filtersRef = useRef(filters)
	filtersRef.current = filters
	const forcedPageRef = useRef(forcedPage)
	forcedPageRef.current = forcedPage
	const [products, setProducts] = useState<Product[]>([])
	const productsCountRef = useRef(0)
	useEffect(() => {
		productsCountRef.current = products.length
	}, [products.length])
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [nextPage, setNextPage] = useState<number | null>(2)
	const [displayedPage, setDisplayedPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [totalPages, setTotalPages] = useState(1)

	const filtersKey = JSON.stringify(filters || {})
	const firstPageCacheKey = `v8:${catalogListKey}:${paginationMode}:${filtersKey}`
	const listFingerprint = `${filtersKey}|${paginationMode}|${forcedPage ?? ''}`
	const fingerprintLiveRef = useRef(listFingerprint)
	fingerprintLiveRef.current = listFingerprint

	const fetchProducts = useCallback(
		async (
			page: number = 1,
			append: boolean = false,
			requestOpts?: { signal?: AbortSignal }
		) => {
			const fingerprintAtStart = fingerprintLiveRef.current
			try {
				const useAppend = paginationMode === 'infinite' && append
				if (useAppend) {
					setLoadingMore(true)
				} else {
					// Первый заход — полный экран. Смена фильтров / страницы при уже открытой сетке — без «вечной» загрузки.
					if (paginationMode === 'paged' && page > 1) {
						setLoading(true)
					} else if (productsCountRef.current === 0) {
						setLoading(true)
					} else {
						setLoading(false)
					}
				}
				setError(null)
				const pageSizeValue = 20
				const response = await productService.getProducts(
					filtersRef.current,
					page,
					pageSizeValue,
					requestOpts?.signal !== undefined ? { signal: requestOpts.signal } : undefined
				)

				// Поздний ответ другого запроса (фильтры / страница) — не переписываем актуальный список.
				if (fingerprintLiveRef.current !== fingerprintAtStart) {
					return
				}

				let productsData: Product[] = []
				let next: number | null = null

				if (response && Array.isArray(response.results)) {
					productsData = response.results
					const count = typeof response.count === 'number' ? response.count : 0
					const computedTotalPages = Math.max(1, Math.ceil(count / pageSizeValue))
					setTotalPages(computedTotalPages)
					const hasNext =
						response.next !== null &&
						response.next !== undefined &&
						response.next !== ''
					setHasMore(hasNext)
					next = hasNext ? page + 1 : null
				} else if (Array.isArray(response)) {
					productsData = response
					setTotalPages(1)
					setHasMore(false)
				} else {
					productsData = extractResults(response)
					setTotalPages(1)
					setHasMore(false)
				}

				if (useAppend) {
					setProducts(prev => [
						...prev,
						...mergeProductMediaFromPrevious(productsData, prev),
					])
				} else {
					setProducts(prev => {
						const merged = mergeProductMediaFromPrevious(productsData, prev)
						if (page === 1) {
							firstPageProductsCache.set(firstPageCacheKey, {
								products: merged,
								hasMore: next !== null,
								totalPages:
									response && Array.isArray(response.results)
										? Math.max(
												1,
												Math.ceil(
													(typeof response.count === 'number' ? response.count : 0) /
														pageSizeValue
												)
											)
										: 1,
								cachedAt: Date.now(),
							})
						}
						return merged
					})
				}

				setNextPage(next)
				if (paginationMode === 'paged') {
					setDisplayedPage(page)
					const urlPage = forcedPageRef.current ?? 1
					if (urlPage !== page) {
						onPageChangeRef.current?.(page)
					}
				}
			} catch (err) {
				const canceled =
					(requestOpts?.signal?.aborted === true) ||
					axios.isCancel(err)
				if (canceled || fingerprintLiveRef.current !== fingerprintAtStart) {
					return
				}
				setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
			} finally {
				setLoading(false)
				setLoadingMore(false)
			}
		},
		[paginationMode, firstPageCacheKey]
	)

	useEffect(() => {
		if (!enabled) {
			setLoading(false)
			setLoadingMore(false)
			return
		}

		const ac = new AbortController()
		const startPage =
			paginationMode === 'paged' && forcedPage != null && forcedPage >= 1
				? Math.floor(forcedPage)
				: 1
		if (paginationMode !== 'paged') {
			setDisplayedPage(1)
			setNextPage(2)
		} else {
			setDisplayedPage(startPage)
			setNextPage(startPage + 1)
		}
		setTotalPages(1)

		const cached = firstPageProductsCache.get(firstPageCacheKey)
		if (
			cached &&
			Date.now() - cached.cachedAt < PRODUCTS_CACHE_TTL_MS &&
			startPage === 1
		) {
			setProducts(prev => mergeProductMediaFromPrevious(cached.products, prev))
			setHasMore(cached.hasMore)
			setTotalPages(cached.totalPages)
			setLoading(false)
		} else {
			// Не очищаем сетку до ответа API — меньше визуального «рывка» при смене категории.
		}

		void fetchProducts(startPage, false, { signal: ac.signal })

		return () => {
			ac.abort()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- fetchProducts стабилен через refs
	}, [enabled, filtersKey, paginationMode, forcedPage, catalogListKey])

	const loadMore = useCallback(() => {
		if (paginationMode !== 'infinite') return
		if (nextPage && hasMore && !loadingMore && !loading) {
			fetchProducts(nextPage, true)
		}
	}, [paginationMode, nextPage, hasMore, loadingMore, loading, fetchProducts])

	const loadNextPage = useCallback(() => {
		if (paginationMode !== 'paged') return
		if (!hasMore || loadingMore || loading) return
		fetchProducts(displayedPage + 1, false)
	}, [paginationMode, hasMore, loadingMore, loading, displayedPage, fetchProducts])

	const loadPrevPage = useCallback(() => {
		if (paginationMode !== 'paged') return
		if (displayedPage <= 1 || loadingMore || loading) return
		fetchProducts(displayedPage - 1, false)
	}, [paginationMode, displayedPage, loadingMore, loading, fetchProducts])

	const hasPrev = paginationMode === 'paged' && displayedPage > 1

	return {
		products,
		loading,
		loadingMore,
		error,
		hasMore,
		hasPrev,
		currentPage: displayedPage,
		totalPages,
		loadMore,
		loadNextPage,
		loadPrevPage,
		refetch: () => fetchProducts(1, false),
	}
}

// ---------------------------
// 🧩 useCategories
// ---------------------------
export const useCategories = () => {
	const [categories, setCategories] = useState<Category[]>(() =>
		categoriesCache && Date.now() - categoriesCache.cachedAt < CATEGORIES_CACHE_TTL_MS
			? categoriesCache.data
			: []
	)
	const [loading, setLoading] = useState(
		() =>
			!(
				categoriesCache &&
				Date.now() - categoriesCache.cachedAt < CATEGORIES_CACHE_TTL_MS
			)
	)
	const [error, setError] = useState<string | null>(null)

	const fetchCategories = useCallback(async () => {
		if (
			categoriesCache &&
			Date.now() - categoriesCache.cachedAt < CATEGORIES_CACHE_TTL_MS
		) {
			setCategories(categoriesCache.data)
			setLoading(false)
			return
		}
		try {
			setLoading(true)
			setError(null)
			const response = await categoryService.getCategories()
			const categoriesData = extractResults(response)
			categoriesCache = { data: categoriesData, cachedAt: Date.now() }
			setCategories(categoriesData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки категорий')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchCategories()
	}, [fetchCategories])

	return { categories, loading, error, refetch: fetchCategories }
}

// ---------------------------
// 🧺 useBaskets
// ---------------------------
export const useBaskets = () => {
	const [baskets, setBaskets] = useState<Basket[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchBaskets = async () => {
		try {
			setLoading(true)
			setError(null)
			const response = await basketService.getBaskets()
			const basketsData = Array.isArray(response.results)
				? response.results
				: Array.isArray(response)
				? response
				: []
			setBaskets(basketsData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки корзин')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchBaskets()
	}, [])

	const createBasket = async (name: string) => {
		try {
			const newBasket = await basketService.createBasket(name)
			await fetchBaskets()
			return newBasket
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка создания корзины')
			throw err
		}
	}

	const addToBasket = async (
		basketId: number,
		productId: number,
		quantity: number = 1,
		format?: string
	) => {
		try {
			await basketService.addToBasket(basketId, productId, quantity, format)
			await fetchBaskets()
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Ошибка добавления в корзину'
			)
			throw err
		}
	}

	return {
		baskets,
		loading,
		error,
		createBasket,
		addToBasket,
		refetch: fetchBaskets,
	}
}

// ---------------------------
// 🎯 useProduct (один товар)
// ---------------------------
export const useProduct = (id: number) => {
	const [product, setProduct] = useState<Product | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchProduct = useCallback(async () => {
		if (!id) return
		try {
			setLoading(true)
			setError(null)
			const productData = await productService.getProduct(id)
			setProduct(productData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки продукта')
		} finally {
			setLoading(false)
		}
	}, [id])

	useEffect(() => {
		fetchProduct()
	}, [fetchProduct])

	return { product, loading, error, refetch: fetchProduct }
}
