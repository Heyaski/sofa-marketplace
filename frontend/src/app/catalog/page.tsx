'use client'

import CartModal from '@/components/CartModal'
import DimensionsFilter from '@/components/DimensionsFilter'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import MultiSelectFilter from '@/components/MultiSelectFilter'
import PriceFilter from '@/components/PriceFilter'
import ProductCard from '@/components/ProductCard'
import { useBaskets, useCategories, useProducts } from '@/hooks/useApi'
import { Category, ProductFilters } from '@/types'
import Image from 'next/image'
import { useMemo, useState } from 'react'

export default function CatalogPage() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)
	const [filters, setFilters] = useState<ProductFilters>({})
	const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(10)
	const [openFilter, setOpenFilter] = useState<string | null>(null)

	// Получаем все продукты для вычисления диапазонов фильтров
	const { products: allProducts } = useProducts({})
	
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

	// Вычисляем диапазоны и уникальные значения из всех продуктов
	const filterRanges = useMemo(() => {
		if (!allProducts || allProducts.length === 0) {
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

		const prices = allProducts.map(p => typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0).filter(p => p > 0)
		const widths = allProducts.map(p => p.width).filter((w): w is number => w !== null && w !== undefined && w > 0)
		const depths = allProducts.map(p => p.depth).filter((d): d is number => d !== null && d !== undefined && d > 0)
		
		const materials = Array.from(new Set(allProducts.map(p => p.material).filter((m): m is string => !!m && m.trim() !== '')))
		const styles = Array.from(new Set(allProducts.map(p => p.style).filter((s): s is string => !!s && s.trim() !== '')))
		const colors = Array.from(new Set(allProducts.map(p => p.color).filter((c): c is string => !!c && c.trim() !== '')))
		const brands = Array.from(new Set(allProducts.map(p => p.brand).filter((b): b is string => !!b && b.trim() !== '')))

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
	}, [allProducts])

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
		// Не применяем сразу, только при нажатии "Применить"
	}

	const handlePriceApply = (value: { min: number; max: number } | undefined) => {
		if (value) {
			setFilters({ ...filters, price_min: value.min, price_max: value.max })
		} else {
			const { price_min, price_max, ...rest } = filters
			setFilters(rest)
		}
		setOpenFilter(null)
	}

	const handleDimensionsChange = (value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined) => {
		// Для габаритов нужно добавить фильтры width_min, width_max, depth_min, depth_max
		// Но в ProductFilters их нет, поэтому пока оставляем как есть
		// Можно добавить в будущем или использовать другой подход
	}

	const handleDimensionsApply = () => {
		setOpenFilter(null)
	}

	const handleMultiSelectChange = (field: 'material' | 'style' | 'color' | 'brand') => {
		return (values: string[] | undefined) => {
			if (values && values.length > 0) {
				// Для множественного выбора используем первый элемент (можно расширить API)
				setFilters({ ...filters, [field]: values[0] })
			} else {
				const { [field]: _, ...rest } = filters
				setFilters(rest)
			}
			// Не закрываем сразу, чтобы можно было выбрать несколько значений
		}
	}

	const visibleCategories = categories?.slice(0, visibleCategoriesCount) || []
	const hasMoreCategories = categories && categories.length > visibleCategoriesCount

	const currentPriceFilter = filters.price_min !== undefined && filters.price_max !== undefined
		? { min: filters.price_min, max: filters.price_max }
		: undefined

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				{/* 🧭 Хлебные крошки */}
				<div className='mb-6'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* 📦 Двухколоночный layout: категории слева, товары справа */}
				<div className='flex flex-col lg:flex-row gap-6'>
					{/* 🏷️ Левая колонка: Категории */}
					<aside className='w-full lg:w-64 flex-shrink-0'>
						<div className='bg-white rounded-xl p-6 sticky top-4'>
							<h2 className='text-lg font-bold text-black mb-4'>Категории</h2>
							
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
					<div className='flex-1 bg-white rounded-xl p-8'>
					<h1 className='text-3xl font-bold text-black mb-8'>Каталог</h1>

					{/* ⚙️ Фильтры */}
					<div className='mb-6'>
						<div className='flex items-center justify-between mb-4'>
							<div className='flex items-center gap-3 flex-wrap'>
								<span className='text-black font-medium'>Фильтр:</span>

								{/* Кнопка фильтра цены */}
								<div className='relative'>
									<button
										onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')}
										className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
											currentPriceFilter
												? 'bg-main1 text-white'
												: 'bg-gray-bg text-black hover:bg-gray2'
										}`}
									>
										Цена
									</button>
								</div>

								{/* Кнопка фильтра габаритов */}
								<button
									onClick={() => setOpenFilter(openFilter === 'dimensions' ? null : 'dimensions')}
									className='px-4 py-2 rounded-lg bg-gray-bg text-black text-sm font-medium hover:bg-gray2 transition-colors'
								>
									Габариты
								</button>

								{/* Кнопка фильтра материала */}
								{filterRanges.materials.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'material' ? null : 'material')}
											className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
												filters.material
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Материал
										</button>
										{openFilter === 'material' && (
											<div className='absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-50 min-w-[200px] max-h-64 overflow-y-auto'>
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
											className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
												filters.style
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Стиль
										</button>
										{openFilter === 'style' && (
											<div className='absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-50 min-w-[200px] max-h-64 overflow-y-auto'>
												<MultiSelectFilter
													title=''
													options={filterRanges.styles}
													selectedValues={filters.style ? [filters.style] : undefined}
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
											className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
												filters.color
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Цвет
										</button>
										{openFilter === 'color' && (
											<div className='absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-50 min-w-[200px] max-h-64 overflow-y-auto'>
												<MultiSelectFilter
													title=''
													options={filterRanges.colors}
													selectedValues={filters.color ? [filters.color] : undefined}
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
											className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
												filters.brand
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											Бренд
										</button>
										{openFilter === 'brand' && (
											<div className='absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-50 min-w-[200px] max-h-64 overflow-y-auto'>
												<MultiSelectFilter
													title=''
													options={filterRanges.brands}
													selectedValues={filters.brand ? [filters.brand] : undefined}
													onChange={handleMultiSelectChange('brand')}
												/>
											</div>
										)}
									</div>
								)}

							</div>

							<div className='flex items-center'>
								<span className='text-black font-medium mr-2 text-sm'>
									Сортировка:
								</span>
								<select 
									className='w-40 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
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

						{/* Модальные окна для диапазонных фильтров */}
						{openFilter && (openFilter === 'price' || openFilter === 'dimensions') && (
							<>
								{/* Overlay */}
								<div
									className='fixed inset-0 bg-black bg-opacity-50 z-40'
									onClick={() => setOpenFilter(null)}
								/>
								{/* Filter Modal */}
								<div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4 max-h-[90vh] overflow-y-auto'>
									{openFilter === 'price' && (
										<PriceFilter
											minPrice={filterRanges.price.min}
											maxPrice={filterRanges.price.max}
											value={currentPriceFilter}
											onChange={handlePriceChange}
											onApply={handlePriceApply}
										/>
									)}

									{openFilter === 'dimensions' && (
										<DimensionsFilter
											minWidth={filterRanges.width.min}
											maxWidth={filterRanges.width.max}
											minDepth={filterRanges.depth.min}
											maxDepth={filterRanges.depth.max}
											value={undefined}
											onChange={handleDimensionsChange}
											onApply={handleDimensionsApply}
										/>
									)}
								</div>
							</>
						)}

						{/* Overlay для выпадающих списков */}
						{openFilter && ['material', 'style', 'color', 'brand'].includes(openFilter) && (
							<div
								className='fixed inset-0 z-30'
								onClick={() => setOpenFilter(null)}
							/>
						)}

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
