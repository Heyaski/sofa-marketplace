import { useCallback, useEffect, useState } from 'react'
import { basketService, categoryService, productService } from '../services/api'
import { Basket, Category, Product, ProductFilters } from '../types'

// Универсальная функция для обработки форматов ответов (с results или без)
const extractResults = (response: any) => {
	if (Array.isArray(response)) return response
	if (response && Array.isArray(response.results)) return response.results
	return []
}

// ---------------------------
// 🛍️ useProducts (с пагинацией)
// ---------------------------
export const useProducts = (filters?: ProductFilters, loadMore?: boolean) => {
	const [products, setProducts] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [nextPage, setNextPage] = useState<number | null>(2)
	const [hasMore, setHasMore] = useState(true)

	const fetchProducts = useCallback(async (page: number = 1, append: boolean = false) => {
		try {
			if (append) {
				setLoadingMore(true)
			} else {
				setLoading(true)
			}
			setError(null)
			// Отладочный вывод фильтров
			if (filters && Object.keys(filters).length > 0) {
				console.log('Применяемые фильтры:', filters)
			}
			const response = await productService.getProducts(filters, page, 12)
			
			// Обрабатываем пагинированный ответ
			let productsData: Product[] = []
			let next: number | null = null
			
			if (response && Array.isArray(response.results)) {
				// Пагинированный ответ
				productsData = response.results
				next = response.next ? page + 1 : null
				setHasMore(response.next !== null && response.next !== undefined)
			} else if (Array.isArray(response)) {
				// Обычный массив (для обратной совместимости)
				productsData = response
				setHasMore(false)
			} else {
				productsData = extractResults(response)
				setHasMore(false)
			}
			
			if (append) {
				setProducts(prev => [...prev, ...productsData])
			} else {
				setProducts(productsData)
			}
			
			setNextPage(next)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
		} finally {
			setLoading(false)
			setLoadingMore(false)
		}
	}, [JSON.stringify(filters || {})])

	useEffect(() => {
		fetchProducts(1, false)
	}, [fetchProducts])

	const loadMoreProducts = useCallback(() => {
		if (nextPage && hasMore && !loadingMore) {
			fetchProducts(nextPage, true)
		}
	}, [nextPage, hasMore, loadingMore, fetchProducts])

	return { 
		products, 
		loading, 
		loadingMore,
		error, 
		hasMore,
		loadMore: loadMoreProducts,
		refetch: () => fetchProducts(1, false)
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
