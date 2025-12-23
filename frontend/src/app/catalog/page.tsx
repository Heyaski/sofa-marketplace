'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { useBaskets, useCategories, useProducts } from '@/hooks/useApi'
import { ProductFilters } from '@/types'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

// 💡 Типы для категорий и продуктов (чтобы не было ошибок типов)
interface Category {
	id: number
	name: string
	slug: string
	image?: string | null
	parent?: number | null
}

interface Product {
	id: number
	title: string
	price: string
	description: string
	image?: string | null
	category: Category
	material?: string
	style?: string
	color?: string
	is_active?: boolean
}

export default function CatalogPage() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)
	const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
	const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const [filters, setFilters] = useState<ProductFilters>({})

	// ✅ API хуки с пагинацией
	const {
		products,
		loading: productsLoading,
		loadingMore,
		error: productsError,
		hasMore,
		loadMore,
	} = useProducts(filters)
	const {
		categories,
		loading: categoriesLoading,
		error: categoriesError,
	} = useCategories()
	const { createBasket, addToBasket } = useBaskets()

	const handleAddToCart = (productId: number, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = async (cartId: number) => {
		if (selectedProduct) {
			try {
				await addToBasket(cartId, selectedProduct.id, 1, selectedProduct.format)
				console.log(
					`Добавлен товар ${selectedProduct.id} (${selectedProduct.format}) в корзину ${cartId}`
				)
			} catch (error) {
				console.error('Ошибка при добавлении в корзину:', error)
			}
		}
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const handleCreateNewCart = async (cartName: string) => {
		try {
			const newBasket = await createBasket(cartName)
			if (selectedProduct) {
				await addToBasket(
					newBasket.id,
					selectedProduct.id,
					1,
					selectedProduct.format
				)
			}
			console.log(`Создана новая корзина: ${cartName}`)
		} catch (error) {
			console.error('Ошибка при создании корзины:', error)
		}
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const scrollLeft = () => {
		const container = document.getElementById('categories-slider')
		if (container) {
			container.scrollBy({ left: -200, behavior: 'smooth' })
		}
	}

	const scrollRight = () => {
		const container = document.getElementById('categories-slider')
		if (container) {
			container.scrollBy({ left: 200, behavior: 'smooth' })
		}
	}

	const handleCategoryHover = (
		categoryName: string,
		event: React.MouseEvent
	) => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
		}

		const rect = event.currentTarget.getBoundingClientRect()
		setDropdownPosition({
			top: rect.bottom + window.scrollY + 4,
			left: rect.left + window.scrollX,
		})
		setHoveredCategory(categoryName)
	}

	const handleCategoryLeave = () => {
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredCategory(null)
		}, 150)
	}

	useEffect(() => {
		return () => {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current)
			}
		}
	}, [])

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-visible'>
				{/* 🧭 Хлебные крошки */}
				<div className='mb-6'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* 🏷️ Слайдер категорий */}
				<div className='mb-8 overflow-visible'>
					<div className='flex items-center space-x-4 overflow-visible'>
						<button
							onClick={scrollLeft}
							className='p-2 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm'
						>
							<ChevronLeftIcon className='w-5 h-5 text-gray-600' />
						</button>

						<div
							id='categories-slider'
							className='flex space-x-4 overflow-x-hidden overflow-y-visible flex-1 scrollbar-hide'
							style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
						>
							{categoriesLoading ? (
								<div className='text-center py-4'>Загрузка категорий...</div>
							) : categoriesError ? (
								<div className='text-center py-4 text-red-500'>
									Ошибка загрузки категорий
								</div>
							) : categories && categories.length > 0 ? (
								categories.map((category: Category) => (
									<div
										key={category.id}
										className='relative group flex-shrink-0'
										ref={el => {
											categoryRefs.current[category.name] = el
										}}
									>
										<button
											className='whitespace-nowrap px-4 py-2 rounded-lg transition-all flex items-center space-x-2 bg-white text-black hover:bg-gray2 focus:outline-none shadow-sm'
											onClick={() =>
												setFilters({ ...filters, category: category.id })
											}
											onMouseEnter={e =>
												handleCategoryHover(category.name, e)
											}
											onMouseLeave={handleCategoryLeave}
										>
											{/* 🖼️ Миниатюра категории */}
											{category.image && typeof category.image === 'string' ? (
												<Image
													src={category.image}
													alt={category.name || 'Категория'}
													width={24}
													height={24}
													className='w-6 h-6 object-cover rounded-md shadow-sm'
													unoptimized
												/>
											) : (
												<Image
													src='/img/no-image.svg'
													alt='Нет изображения'
													width={24}
													height={24}
													className='w-6 h-6 opacity-40'
												/>
											)}

											<span className='text-sm font-medium'>
												{category.name}
											</span>

											<Image
												src='/img/arrow-down.svg'
												alt='Arrow'
												width={16}
												height={16}
												className='w-4 h-4 opacity-60'
											/>
										</button>
									</div>
								))
							) : (
								<div className='text-center py-4 text-gray-500'>
									Категории не найдены
								</div>
							)}
						</div>

						<button
							onClick={scrollRight}
							className='p-2 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm'
						>
							<ChevronRightIcon className='w-5 h-5 text-gray-600' />
						</button>
					</div>
				</div>

				{/* 📦 Каталог товаров */}
				<div className='bg-white rounded-xl p-8'>
					<h1 className='text-3xl font-bold text-black mb-8'>Каталог</h1>

					{/* ⚙️ Фильтры */}
					<div className='flex items-center justify-between mb-4'>
						<div className='flex items-center gap-3'>
							<span className='text-black font-medium'>Фильтр</span>

							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Цена</option>
							</select>

							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e =>
									setFilters({
										...filters,
										category: e.target.value
											? parseInt(e.target.value)
											: undefined,
									})
								}
								value={filters.category || ''}
							>
								<option value=''>Категория</option>
								{categories?.map(cat => (
									<option key={cat.id} value={cat.id}>
										{cat.name}
									</option>
								))}
							</select>

							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e =>
									setFilters({ ...filters, style: e.target.value || undefined })
								}
								value={filters.style || ''}
							>
								<option value=''>Стиль</option>
								<option value='Современный'>Современный</option>
								<option value='Классический'>Классический</option>
								<option value='Минимализм'>Минимализм</option>
							</select>

							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e =>
									setFilters({ ...filters, color: e.target.value || undefined })
								}
								value={filters.color || ''}
							>
								<option value=''>Цвет</option>
								<option value='Белый'>Белый</option>
								<option value='Черный'>Черный</option>
								<option value='Коричневый'>Коричневый</option>
								<option value='Серый'>Серый</option>
							</select>

							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Габариты</option>
							</select>
						</div>

						<div className='flex items-center'>
							<span className='text-black font-medium mr-2 text-sm'>
								Сортировка:
							</span>
							<select className='w-40 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>возрастанию цены</option>
							</select>
						</div>
					</div>

					<div className='border-t border-gray2 mb-8'></div>

					{/* 🛋️ Сетка товаров */}
					{productsLoading ? (
						<div className='text-center py-8'>Загрузка продуктов...</div>
					) : productsError ? (
						<div className='text-center py-8 text-red-500'>
							Ошибка загрузки продуктов: {productsError}
						</div>
					) : !products || products.length === 0 ? (
						<div className='text-center py-8 text-gray-500'>
							Продукты не найдены
						</div>
					) : (
						<>
							<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
								{products.map(product => (
									<ProductCard
										key={product.id}
										product={product}
										onAddToCart={handleAddToCart}
									/>
								))}
							</div>
							{hasMore && (
								<div className='mt-8 flex justify-center'>
									<button
										onClick={loadMore}
										disabled={loadingMore}
										className='bg-main1 text-white px-8 py-3 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
									>
										{loadingMore ? 'Загрузка...' : 'Загрузить еще'}
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</main>

			<Footer />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => {
					setIsCartModalOpen(false)
					setSelectedProduct(null)
				}}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>
		</div>
	)
}
