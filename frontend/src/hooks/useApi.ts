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

	const filtersKey = JSON.stringify(filters || {})

	const fetchProducts = useCallback(
		async (page: number = 1, append: boolean = false) => {
			try {
				const useAppend = paginationMode === 'infinite' && append
				if (useAppend) {
					setLoadingMore(true)
				} else {
					setLoading(true)
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
					const hasNext =
						response.next !== null &&
						response.next !== undefined &&
						response.next !== ''
					setHasMore(hasNext)
					next = hasNext ? page + 1 : null
				} else if (Array.isArray(response)) {
					productsData = response
					setHasMore(false)
				} else {
					productsData = extractResults(response)
					setHasMore(false)
				}

				if (useAppend) {
					setProducts(prev => [...prev, ...productsData])
				} else {
					setProducts(productsData)
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
		[filtersKey, paginationMode]
	)

	useEffect(() => {
		setDisplayedPage(1)
		setNextPage(2)
		fetchProducts(1, false)
	}, [fetchProducts])

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
