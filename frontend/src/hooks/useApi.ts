
import { useEffect, useState } from 'react'
import { basketService, categoryService, productService } from '../services/api'
import { Basket, Category, Product, ProductFilters } from '../types'

// Универсальная функция для обработки форматов ответов (с results или без)
const extractResults = (response: any) => {
	if (Array.isArray(response)) return response
	if (response && Array.isArray(response.results)) return response.results
	return []
}

// ---------------------------
// 🛍️ useProducts
// ---------------------------
export const useProducts = (filters?: ProductFilters) => {
	const [products, setProducts] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchProducts = async () => {
		try {
			setLoading(true)
			setError(null)
			const response = await productService.getProducts(filters)
			const productsData = extractResults(response)
			setProducts(productsData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchProducts()
	}, [filters])

	return { products, loading, error, refetch: fetchProducts }
}

// ---------------------------
// 🧩 useCategories
// ---------------------------
export const useCategories = () => {
	const [categories, setCategories] = useState<Category[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchCategories = async () => {
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
	}

	useEffect(() => {
		fetchCategories()
	}, [])

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

	return { baskets, loading, error, createBasket, addToBasket, refetch: fetchBaskets }
}


// ---------------------------
// 🎯 useProduct (один товар)
// ---------------------------
export const useProduct = (id: number) => {
	const [product, setProduct] = useState<Product | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchProduct = async () => {
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
	}

	useEffect(() => {
		if (id) {
			fetchProduct()
		}
	}, [id])

	return { product, loading, error, refetch: fetchProduct }
}