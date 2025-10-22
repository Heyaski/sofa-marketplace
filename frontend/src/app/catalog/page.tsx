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

export default function CatalogPage() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)
	const [activeCategory, setActiveCategory] = useState('')
	const [selectedCategory, setSelectedCategory] = useState('')
	const [priceRange, setPriceRange] = useState([0, 999999])
	const [scrollPosition, setScrollPosition] = useState(0)
	const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
	const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Фильтры для API
	const [filters, setFilters] = useState<ProductFilters>({})

	// Загружаем данные с API
	const {
		products,
		loading: productsLoading,
		error: productsError,
	} = useProducts(filters)
	const {
		categories,
		loading: categoriesLoading,
		error: categoriesError,
	} = useCategories()
	const { baskets, createBasket, addToBasket } = useBaskets()

	const handleAddToCart = (productId: number, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = async (cartId: number) => {
		if (selectedProduct) {
			try {
				await addToBasket(cartId, selectedProduct.id, 1, selectedProduct.format)
				console.log(
					`Adding product ${selectedProduct.id} with format ${selectedProduct.format} to cart ${cartId}`
				)
			} catch (error) {
				console.error('Error adding to cart:', error)
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
			console.log(`Creating new cart: ${cartName}`)
		} catch (error) {
			console.error('Error creating cart:', error)
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
		// Очищаем предыдущий таймаут
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
		// Добавляем задержку перед скрытием dropdown
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredCategory(null)
		}, 150) // 150ms задержка
	}

	const handleDropdownEnter = () => {
		// Очищаем таймаут при наведении на dropdown
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
		}
	}

	const handleDropdownLeave = () => {
		// Скрываем dropdown при уходе с него
		setHoveredCategory(null)
	}

	// Очистка таймаута при размонтировании компонента
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
				{/* Breadcrumbs */}
				<div className='mb-6'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* Categories Slider */}
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
								categories.map(category => (
									<div
										key={category.id}
										className='relative group flex-shrink-0'
										ref={el => {
											categoryRefs.current[category.name] = el
										}}
									>
										<button
											className='whitespace-nowrap px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 bg-white text-black hover:bg-gray2 focus:outline-none'
											onClick={() =>
												setFilters({ ...filters, category: category.id })
											}
											onMouseEnter={e => handleCategoryHover(category.name, e)}
											onMouseLeave={handleCategoryLeave}
										>
											<span>{category.name}</span>
											<Image
												src='/img/arrow-down.svg'
												alt='Arrow'
												width={16}
												height={16}
												className='w-4 h-4'
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

				{/* Catalog Block */}
				<div className='bg-white rounded-xl p-8'>
					{/* Title */}
					<h1 className='text-3xl font-bold text-black mb-8'>Каталог</h1>

					{/* Filters */}
					<div className='flex items-center justify-between mb-4'>
						{/* Left side - Filters */}
						<div className='flex items-center gap-3'>
							<span className='text-black font-medium'>Фильтр</span>

							{/* Price Filter */}
							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e =>
									setPriceRange([parseInt(e.target.value), priceRange[1]])
								}
							>
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
								{categories.map(cat => (
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

						{/* Right side - Sorting */}
						<div className='flex items-center'>
							<span className='text-black font-medium mr-2 text-sm'>
								Сортировка:
							</span>
							<select className='w-40 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>возрастанию цены</option>
							</select>
						</div>
					</div>

					{/* Gray line */}
					<div className='border-t border-gray2 mb-8'></div>

					{/* Products Grid */}
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
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
							{products.map(product => (
								<ProductCard
									key={product.id}
									product={product}
									onAddToCart={handleAddToCart}
								/>
							))}
						</div>
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
