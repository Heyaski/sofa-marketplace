import { useCallback, useEffect, useState } from 'react'
import { basketService, categoryService, productService } from '../services/api'
import { Basket, Category, Product, ProductFilters } from '../types'

// Универсальная функция для обработки форматов ответов (с results или без)
const extractResults = (response: any) => {
	if (Array.isArray(response)) return response
	if (response && Array.isArray(response.results)) return response.results
	return []
}

export type ProductsPaginationMode = 'infinite' | 'paged'
const PRODUCTS_CACHE_TTL_MS = 60_000
const firstPageProductsCache = new Map<
	string,
	{ products: Product[]; hasMore: boolean; totalPages: number; cachedAt: number }
>()

// ---------------------------
// 🛍️ useProducts (пагинация: «загрузить ещё» или постранично)
// ---------------------------
export const useProducts = (
	filters?: ProductFilters,
	options?: { paginationMode?: ProductsPaginationMode }
) => {
	const paginationMode: ProductsPaginationMode = options?.paginationMode ?? 'infinite'
	const [products, setProducts] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [nextPage, setNextPage] = useState<number | null>(2)
	const [displayedPage, setDisplayedPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [totalPages, setTotalPages] = useState(1)

	const filtersKey = JSON.stringify(filters || {})
	const firstPageCacheKey = `${paginationMode}:${filtersKey}`

	const fetchProducts = useCallback(
		async (page: number = 1, append: boolean = false) => {
			try {
				const useAppend = paginationMode === 'infinite' && append
				if (useAppend) {
					setLoadingMore(true)
				} else {
					// Не блокируем сетку повторно, если карточки уже есть:
					// пользователь должен видеть товары сразу, а 3D догружаются отдельно.
					setLoading(products.length === 0)
				}
				setError(null)
				if (filters && Object.keys(filters).length > 0) {
					console.log('Применяемые фильтры:', filters)
				}
				const response = await productService.getProducts(filters, page, 12)

				let productsData: Product[] = []
				let next: number | null = null

				if (response && Array.isArray(response.results)) {
					productsData = response.results
					const count = typeof response.count === 'number' ? response.count : 0
					const pageSizeValue = 12
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
					setProducts(prev => [...prev, ...productsData])
				} else {
					setProducts(productsData)
					if (page === 1) {
						firstPageProductsCache.set(firstPageCacheKey, {
							products: productsData,
							hasMore: next !== null,
							totalPages:
								response && Array.isArray(response.results)
									? Math.max(1, Math.ceil((typeof response.count === 'number' ? response.count : 0) / 12))
									: 1,
							cachedAt: Date.now(),
						})
					}
				}

				setNextPage(next)
				if (paginationMode === 'paged') {
					setDisplayedPage(page)
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
			} finally {
				setLoading(false)
				setLoadingMore(false)
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- фильтры через filtersKey
		[filtersKey, paginationMode, products.length, firstPageCacheKey]
	)

	useEffect(() => {
		setDisplayedPage(1)
		setNextPage(2)
		setTotalPages(1)

		const cached = firstPageProductsCache.get(firstPageCacheKey)
		if (cached && Date.now() - cached.cachedAt < PRODUCTS_CACHE_TTL_MS) {
			setProducts(cached.products)
			setHasMore(cached.hasMore)
			setTotalPages(cached.totalPages)
			setLoading(false)
		}

		fetchProducts(1, false)
	}, [fetchProducts, firstPageCacheKey])

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
	const [categories, setCategories] = useState<Category[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchCategories = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const response = await categoryService.getCategories()
			const categoriesData = extractResults(response)
			setCategories(categoriesData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки категорий')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchCategories()
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
