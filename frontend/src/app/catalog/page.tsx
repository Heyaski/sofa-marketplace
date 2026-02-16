'use client'

import BottomNav from '@/components/BottomNav'
import CartModal from '@/components/CartModal'
import DimensionsFilter from '@/components/DimensionsFilter'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import MultiSelectFilter from '@/components/MultiSelectFilter'
import PriceFilter from '@/components/PriceFilter'
import RGBRangeFilter from '@/components/RGBRangeFilter'
import ProductCard from '@/components/ProductCard'
import { useBaskets, useCategories, useProducts } from '@/hooks/useApi'
import { productService } from '@/services/api'
import { Category, Product, ProductFilters } from '@/types'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

function CatalogContent() {
	const searchParams = useSearchParams()
	const searchFromUrl = searchParams.get('search') || ''
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)
	const [filters, setFilters] = useState<ProductFilters>({})
	const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(10)
	const [openFilter, setOpenFilter] = useState<string | null>(null)

	// Синхронизация поиска из URL с фильтрами
	useEffect(() => {
		setFilters(prev => ({
			...prev,
			search: searchFromUrl || undefined,
		}))
	}, [searchFromUrl])

	// ✅ API хуки с пагинацией
	const {
		products,
		loading: productsLoading,
		loadingMore,
		error: productsError,
		hasMore,
		loadMore,
	} = useProducts(filters)
	
	// Получаем все продукты без фильтров для вычисления диапазонов
	const [allProductsForRanges, setAllProductsForRanges] = useState<Product[]>([])
	
	useEffect(() => {
		const fetchAllProducts = async () => {
			try {
				// Загружаем все товары с большим page_size для вычисления диапазонов
				const response = await productService.getProducts(undefined, 1, 1000)
				if (response && Array.isArray(response.results)) {
					setAllProductsForRanges(response.results)
				} else if (Array.isArray(response)) {
					setAllProductsForRanges(response)
				}
			} catch (err) {
				console.error('Ошибка загрузки всех товаров для диапазонов:', err)
			}
		}
		fetchAllProducts()
	}, [])
	
	const {
		categories,
		loading: categoriesLoading,
		error: categoriesError,
	} = useCategories()
	const { createBasket, addToBasket } = useBaskets()

	// Вычисляем диапазоны и уникальные значения из всех продуктов
	const filterRanges = useMemo(() => {
		if (!allProductsForRanges || allProductsForRanges.length === 0) {
			return {
				price: { min: 0, max: 100000 },
				width: { min: 0, max: 500 },
				depth: { min: 0, max: 500 },
				materials: [] as string[],
				styles: [] as string[],
				colors: [] as string[],
				brands: [] as string[],
			}
		}

		const prices = allProductsForRanges.map(p => typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0).filter(p => p > 0)
		const widths = allProductsForRanges.map(p => p.width).filter((w): w is number => w !== null && w !== undefined && w > 0)
		const depths = allProductsForRanges.map(p => p.depth).filter((d): d is number => d !== null && d !== undefined && d > 0)
		
		// Разделяем множественные значения (например, "черный, красный" -> ["черный", "красный"])
		const allMaterials: string[] = []
		allProductsForRanges.forEach(p => {
			if (p.material && p.material.trim()) {
				// Разделяем по запятой и убираем пробелы
				const materials = p.material.split(',').map(m => m.trim()).filter(m => m.length > 0)
				allMaterials.push(...materials)
			}
		})
		const materials = Array.from(new Set(allMaterials)).sort()

		const allStyles: string[] = []
		allProductsForRanges.forEach(p => {
			if (p.style && p.style.trim()) {
				const styles = p.style.split(',').map(s => s.trim()).filter(s => s.length > 0)
				allStyles.push(...styles)
			}
		})
		const styles = Array.from(new Set(allStyles)).sort()

		const allColors: string[] = []
		allProductsForRanges.forEach(p => {
			if (p.color && p.color.trim()) {
				const colors = p.color.split(',').map(c => c.trim()).filter(c => c.length > 0)
				allColors.push(...colors)
			}
		})
		const colors = Array.from(new Set(allColors)).sort()

		const allBrands: string[] = []
		allProductsForRanges.forEach(p => {
			if (p.brand && p.brand.trim()) {
				const brands = p.brand.split(',').map(b => b.trim()).filter(b => b.length > 0)
				allBrands.push(...brands)
			}
		})
		const brands = Array.from(new Set(allBrands)).sort()

		return {
			price: {
				min: prices.length > 0 ? Math.floor(Math.min(...prices)) : 0,
				max: prices.length > 0 ? Math.ceil(Math.max(...prices)) : 100000,
			},
			width: {
				min: widths.length > 0 ? Math.floor(Math.min(...widths)) : 0,
				max: widths.length > 0 ? Math.ceil(Math.max(...widths)) : 500,
			},
			depth: {
				min: depths.length > 0 ? Math.floor(Math.min(...depths)) : 0,
				max: depths.length > 0 ? Math.ceil(Math.max(...depths)) : 500,
			},
			materials: materials.sort(),
			styles: styles.sort(),
			colors: colors.sort(),
			brands: brands.sort(),
		}
	}, [allProductsForRanges])

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

	const handleShowMoreCategories = () => {
		setVisibleCategoriesCount(prev => prev + 10)
	}

	const handlePriceChange = (value: { min: number; max: number } | undefined) => {
		if (value) {
			setFilters({ ...filters, price_min: value.min, price_max: value.max })
		} else {
			const { price_min, price_max, ...rest } = filters
			setFilters(rest)
		}
		setOpenFilter(null)
	}
	
	const handlePriceApply = () => {
		// Фильтр уже применен в handlePriceChange, просто закрываем
		setOpenFilter(null)
	}

	const handleDimensionsChange = (value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined) => {
		if (value) {
			setFilters({ 
				...filters, 
				width_min: value.width.min, 
				width_max: value.width.max,
				depth_min: value.depth.min,
				depth_max: value.depth.max
			})
		} else {
			const { width_min, width_max, depth_min, depth_max, ...rest } = filters
			setFilters(rest)
		}
	}
	
	const handleDimensionsApply = () => {
		// Фильтр уже применен в handleDimensionsChange, просто закрываем
		setOpenFilter(null)
	}

	const handleMultiSelectChange = (field: 'material' | 'style' | 'color' | 'brand') => {
		return (values: string[] | undefined) => {
			if (values && values.length > 0) {
				// Для множественного выбора поддерживаем несколько значений через запятую
				// API будет искать товары, где поле содержит любое из выбранных значений
				setFilters({ ...filters, [field]: values.join(',') })
			} else {
				const { [field]: _, ...rest } = filters
				setFilters(rest)
			}
			// Не закрываем список сразу, чтобы можно было выбрать несколько значений
		}
	}

	const visibleCategories = categories?.slice(0, visibleCategoriesCount) || []
	const hasMoreCategories = categories && categories.length > visibleCategoriesCount

	const currentPriceFilter = filters.price_min !== undefined && filters.price_max !== undefined
		? { min: filters.price_min, max: filters.price_max }
		: undefined

	return (
		<div className='min-h-screen bg-gray-bg pb-20 lg:pb-0'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'>
				{/* 🧭 Хлебные крошки */}
				<div className='mb-4 sm:mb-6'>
					<nav className='text-xs sm:text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* 📦 Двухколоночный layout: категории слева, товары справа */}
				<div className='flex flex-col lg:flex-row gap-4 sm:gap-6'>
					{/* 🏷️ Левая колонка: Категории */}
					<aside className='w-full lg:w-64 flex-shrink-0'>
						<div className='bg-white rounded-xl p-4 sm:p-6 lg:sticky lg:top-4'>
							<h2 className='text-base sm:text-lg font-bold text-black mb-3 sm:mb-4'>Категории</h2>
							
							{categoriesLoading ? (
								<div className='text-center py-4 text-sm text-gray-500'>
									Загрузка категорий...
								</div>
							) : categoriesError ? (
								<div className='text-center py-4 text-sm text-red-500'>
									Ошибка загрузки категорий
								</div>
							) : visibleCategories.length > 0 ? (
								<>
									<div className='space-y-2'>
										{/* Кнопка "Все категории" для сброса фильтра */}
										<button
											onClick={() => setFilters({ ...filters, category: undefined })}
											className={`w-full text-left px-4 py-2 rounded-lg transition-all flex items-center space-x-2 ${
												!filters.category
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											<span className='text-sm font-medium'>Все категории</span>
										</button>

										{/* Список категорий */}
										{visibleCategories.map((category: Category) => (
											<button
												key={category.id}
												onClick={() =>
													setFilters({ ...filters, category: category.id })
												}
												className={`w-full text-left px-4 py-2 rounded-lg transition-all flex items-center space-x-2 ${
													filters.category === category.id
														? 'bg-main1 text-white'
														: 'bg-gray-bg text-black hover:bg-gray2'
												}`}
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
											</button>
										))}
									</div>

									{/* Кнопка "Показать еще" */}
									{hasMoreCategories && (
										<div className='mt-4 pt-4 border-t border-gray2'>
											<button
												onClick={handleShowMoreCategories}
												className='w-full px-4 py-2 text-sm text-main1 hover:bg-gray-bg rounded-lg transition-colors font-medium'
											>
												Показать еще ({categories.length - visibleCategoriesCount})
											</button>
										</div>
									)}
								</>
							) : (
								<div className='text-center py-4 text-sm text-gray-500'>
									Категории не найдены
								</div>
							)}
						</div>
					</aside>

					{/* 📦 Правая колонка: Каталог товаров */}
					<div className='flex-1 bg-white rounded-xl p-4 sm:p-6 lg:p-8'>
					<h1 className='text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6 lg:mb-8'>Каталог</h1>

					{/* ⚙️ Фильтры */}
					<div className='mb-4 sm:mb-6'>
						<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4'>
							<div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
								<span className='text-black font-medium text-sm sm:text-base'>Фильтр:</span>

								{/* Кнопка фильтра цены */}
								<div className='relative'>
									<button
										onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')}
										className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
											currentPriceFilter
												? 'bg-main1 text-white'
												: 'bg-gray-bg text-black hover:bg-gray2'
										}`}
									>
										Цена
									</button>
									{openFilter === 'price' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[300px] sm:max-w-sm'>
											<PriceFilter
												minPrice={filterRanges.price.min}
												maxPrice={filterRanges.price.max}
												value={currentPriceFilter}
												onChange={handlePriceChange}
												onApply={handlePriceApply}
											/>
										</div>
									)}
								</div>

								{/* Кнопка фильтра габаритов */}
								<div className='relative'>
									<button
										onClick={() => setOpenFilter(openFilter === 'dimensions' ? null : 'dimensions')}
										className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
											(filters.width_min !== undefined || filters.width_max !== undefined || 
											 filters.depth_min !== undefined || filters.depth_max !== undefined)
												? 'bg-main1 text-white'
												: 'bg-gray-bg text-black hover:bg-gray2'
										}`}
									>
										Габариты
									</button>
									{openFilter === 'dimensions' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[300px] sm:max-w-sm'>
											<DimensionsFilter
												minWidth={filterRanges.width.min}
												maxWidth={filterRanges.width.max}
												minDepth={filterRanges.depth.min}
												maxDepth={filterRanges.depth.max}
												value={
													(filters.width_min !== undefined || filters.width_max !== undefined ||
													 filters.depth_min !== undefined || filters.depth_max !== undefined)
														? {
																width: {
																	min: filters.width_min ?? filterRanges.width.min,
																	max: filters.width_max ?? filterRanges.width.max,
																},
																depth: {
																	min: filters.depth_min ?? filterRanges.depth.min,
																	max: filters.depth_max ?? filterRanges.depth.max,
																},
															}
														: undefined
												}
												onChange={handleDimensionsChange}
												onApply={handleDimensionsApply}
											/>
										</div>
									)}
								</div>

								{/* Кнопка "Вид мебели" (стили) - чекбоксы как на hh.ru */}
								{filterRanges.styles.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'furniture_type' ? null : 'furniture_type')}
											className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
												filters.style ? 'bg-main1 text-white' : 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Вид мебели
										</button>
										{openFilter === 'furniture_type' && (
											<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[260px] sm:max-w-sm'>
												<MultiSelectFilter
													title='Вид мебели'
													options={filterRanges.styles}
													selectedValues={filters.style ? filters.style.split(',').map(v => v.trim()) : undefined}
													onChange={handleMultiSelectChange('style')}
												/>
											</div>
										)}
									</div>
								)}

								{/* Кнопка фильтра материала */}
								{filterRanges.materials.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'material' ? null : 'material')}
											className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
												filters.material
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Материал
										</button>
									{openFilter === 'material' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[200px] sm:max-w-xs'>
											<MultiSelectFilter
												title=''
												options={filterRanges.materials}
												selectedValues={filters.material ? [filters.material] : undefined}
												onChange={handleMultiSelectChange('material')}
											/>
										</div>
									)}
									</div>
								)}

								{/* Кнопка фильтра стиля */}
								{filterRanges.styles.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'style' ? null : 'style')}
											className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
												filters.style
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Стиль
										</button>
									{openFilter === 'style' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[200px] sm:max-w-xs'>
											<MultiSelectFilter
												title=''
												options={filterRanges.styles}
												selectedValues={filters.style ? filters.style.split(',').map(v => v.trim()) : undefined}
												onChange={handleMultiSelectChange('style')}
											/>
										</div>
									)}
									</div>
								)}

								{/* Кнопка фильтра цвета */}
								{filterRanges.colors.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'color' ? null : 'color')}
											className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
												filters.color
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Цвет
										</button>
									{openFilter === 'color' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[200px] sm:max-w-xs'>
											<MultiSelectFilter
												title=''
												options={filterRanges.colors}
												selectedValues={filters.color ? filters.color.split(',').map(v => v.trim()) : undefined}
												onChange={handleMultiSelectChange('color')}
											/>
										</div>
									)}
									</div>
								)}

								{/* Кнопка фильтра бренда */}
								{filterRanges.brands.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'brand' ? null : 'brand')}
											className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
												filters.brand
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Бренд
										</button>
									{openFilter === 'brand' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[200px] sm:max-w-xs'>
											<MultiSelectFilter
												title=''
												options={filterRanges.brands}
												selectedValues={filters.brand ? filters.brand.split(',').map(v => v.trim()) : undefined}
												onChange={handleMultiSelectChange('brand')}
											/>
										</div>
									)}
									</div>
								)}

							</div>

							<div className='flex items-center flex-shrink-0'>
								<span className='text-black font-medium mr-2 text-xs sm:text-sm whitespace-nowrap'>
									Сортировка:
								</span>
								<select 
									className='w-full sm:w-40 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gray-bg text-black text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-main1'
									onChange={e => setFilters({ ...filters, ordering: e.target.value || undefined })}
									value={filters.ordering || ''}
								>
									<option value=''>По умолчанию</option>
									<option value='price'>По возрастанию цены</option>
									<option value='-price'>По убыванию цены</option>
									<option value='title'>По названию</option>
								</select>
							</div>
						</div>

						{/* Overlay для выпадающих списков */}
						{openFilter && (
							<div
								className='fixed inset-0 z-30 bg-black/30 sm:bg-transparent'
								onClick={() => setOpenFilter(null)}
							/>
						)}

					</div>

					{/* Полоса RGB-диапазона под фильтрами */}
					<div className='mb-4 sm:mb-6'>
						<RGBRangeFilter
							value={filters.color_rgb}
							onChange={v => {
								if (v) {
									setFilters({ ...filters, color_rgb: v })
								} else {
									const { color_rgb: _removed, ...rest } = filters
									setFilters(rest)
								}
							}}
						/>
					</div>

					<div className='border-t border-gray2 mb-4 sm:mb-6 lg:mb-8'></div>

					{/* 🛋️ Сетка товаров */}
					{productsLoading ? (
						<div className='text-center py-8 text-sm sm:text-base'>Загрузка продуктов...</div>
					) : productsError ? (
						<div className='text-center py-8 text-red-500 text-sm sm:text-base'>
							Ошибка загрузки продуктов: {productsError}
						</div>
					) : !products || products.length === 0 ? (
						<div className='text-center py-8 text-gray-500 text-sm sm:text-base'>
							Продукты не найдены
						</div>
					) : (
						<>
							<div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6'>
								{products.map(product => (
									<ProductCard
										key={product.id}
										product={product}
										onAddToCart={handleAddToCart}
									/>
								))}
							</div>
							{hasMore && (
								<div className='mt-6 sm:mt-8 flex justify-center'>
									<button
										onClick={loadMore}
										disabled={loadingMore}
										className='bg-main1 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto'
									>
										{loadingMore ? 'Загрузка...' : 'Загрузить еще'}
									</button>
								</div>
							)}
						</>
					)}
					</div>
				</div>
			</main>

			<Footer />
			<BottomNav />

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

export default function CatalogPage() {
	return (
		<Suspense fallback={
			<div className='min-h-screen bg-gray-bg flex items-center justify-center'>
				<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1' />
			</div>
		}>
			<CatalogContent />
		</Suspense>
	)
}
