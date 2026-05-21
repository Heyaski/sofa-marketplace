'use client'

import AuthModal from '@/components/AuthModal'
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
import {
	buildCatalogSearchParams,
	parseCatalogSearchParams,
	catalogQueryStringsEqual,
	persistCatalogQueryForBackNavigation,
	notifyCatalogNavHrefRefresh,
	type CatalogViewMode,
} from '@/lib/catalogUrlState'
import { authService, productService } from '@/services/api'
import { Category, ProductFilters, User } from '@/types'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

function CatalogContent() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const spKey = searchParams.toString()

	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)
	const [filters, setFilters] = useState<ProductFilters>({})
	const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(10)
	const [openFilter, setOpenFilter] = useState<string | null>(null)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
	const [currentUser, setCurrentUser] = useState<User | null>(null)
	const [catalogView, setCatalogView] = useState<CatalogViewMode>('3d')
	const [catalogPage, setCatalogPage] = useState(1)
	const [urlHydrated, setUrlHydrated] = useState(false)

	useEffect(() => {
		authService.getCurrentUser()
			.then((user) => {
				setIsAuthenticated(true)
				setCurrentUser(user)
			})
			.catch(() => {
				setIsAuthenticated(false)
				setCurrentUser(null)
			})
	}, [])

	// Параметры адресной строки → фильтры, вид каталога и страница (сохраняются при «Назад» с карточки)
	useEffect(() => {
		const parsed = parseCatalogSearchParams(searchParams)
		setFilters(parsed.filters)
		setCatalogView(parsed.view)
		setCatalogPage(parsed.page)
		setUrlHydrated(true)
	}, [spKey])

	// Сохранить query для «Назад» и обновить href «Каталог» в шапке (router.replace не шлёт popstate)
	useEffect(() => {
		persistCatalogQueryForBackNavigation(spKey)
		notifyCatalogNavHrefRefresh()
	}, [spKey])

	// Фильтры / вид / страница → URL
	useEffect(() => {
		if (!urlHydrated) return
		const qs = buildCatalogSearchParams(filters, catalogView, catalogPage)
		if (catalogQueryStringsEqual(qs, spKey)) return
		router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false })
	}, [filters, catalogView, catalogPage, urlHydrated, spKey, router])

	// Смена набора фильтров сбрасывает постраничную навигацию (только 3D)
	const filtersKeyForReset = useMemo(() => JSON.stringify(filters), [filters])
	const prevFiltersKeyRef = useRef<string | null>(null)
	useEffect(() => {
		if (!urlHydrated) return
		if (prevFiltersKeyRef.current === null) {
			prevFiltersKeyRef.current = filtersKeyForReset
			return
		}
		if (prevFiltersKeyRef.current !== filtersKeyForReset) {
			prevFiltersKeyRef.current = filtersKeyForReset
			setCatalogPage(1)
		}
	}, [filtersKeyForReset, urlHydrated])

	const isSuperuser = !!currentUser?.is_superuser

	// 2D и 3D — разные запросы к API; переключатель только меняет, какой список показывать (без перетирания).
	const filters2d = filters
	const filters3d = useMemo<ProductFilters>(
		() =>
			isSuperuser
				? filters
				: { ...filters, model_files: 'bundle' as const },
		[filters, isSuperuser]
	)

	const catalogListOpts = {
		activeCatalogView: catalogView,
	} as const

	const list2d = useProducts(filters2d, {
		...catalogListOpts,
		catalogListMode: '2d',
		paginationMode: 'infinite',
	})
	const list3d = useProducts(filters3d, {
		...catalogListOpts,
		catalogListMode: '3d',
		paginationMode: 'paged',
		forcedPage: catalogPage,
		onPageChange: setCatalogPage,
	})

	const activeList = catalogView === '2d' ? list2d : list3d
	const {
		products,
		loading: productsLoading,
		loadingMore,
		error: productsError,
		hasMore,
		hasPrev,
		currentPage,
		totalPages,
		loadMore,
		loadNextPage,
		loadPrevPage,
	} = activeList

	const refetchProducts = () => {
		list2d.refetch()
		list3d.refetch()
	}

	// Получаем все продукты без фильтров для вычисления диапазонов
	const [filterRangesData, setFilterRangesData] = useState<{
		price: { min: number; max: number }
		width: { min: number; max: number }
		depth: { min: number; max: number }
		materials: string[]
		styles: string[]
		colors: string[]
	} | null>(null)

	useEffect(() => {
		productService.getFilterRanges().then(setFilterRangesData).catch(() => {})
	}, [])

	
	const {
		categories,
		loading: categoriesLoading,
		error: categoriesError,
	} = useCategories()
	const { createBasket, addToBasket } = useBaskets()

	const filterRanges = useMemo(() => {
		if (!filterRangesData) {
			return {
				price: { min: 0, max: 100000 },
				width: { min: 0, max: 500 },
				depth: { min: 0, max: 500 },
				materials: [] as string[],
				styles: [] as string[],
				colors: [] as string[],
			}
		}
		return filterRangesData
	}, [filterRangesData])

	const handleAddToCart = (productId: number, format: string) => {
		if (isAuthenticated === false) {
			setIsAuthModalOpen(true)
			return
		}
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

	const handleDimensionsChange = (value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined) => {
		if (value) {
			setFilters(prev => ({ 
				...prev, 
				width_min: value.width.min, 
				width_max: value.width.max,
				depth_min: value.depth.min,
				depth_max: value.depth.max
			}))
		} else {
			setFilters(prev => {
				const { width_min, width_max, depth_min, depth_max, ...rest } = prev
				return rest
			})
		}
	}
	
	const handlePriceChange = (value: { min: number; max: number } | undefined) => {
		if (value) {
			setFilters(prev => ({
				...prev,
				price_min: value.min,
				price_max: value.max,
			}))
		} else {
			setFilters(prev => {
				const { price_min, price_max, ...rest } = prev
				return rest
			})
		}
	}

	const handleFurnitureTypeChange = (ids: number[]) => {
		const uncategorizedCategory = categories.find(
			(category) => category.name.trim().toLowerCase() === 'без категории'
		)
		const uncategorizedId = uncategorizedCategory?.id
		// По запросу: выбор "Без категории" должен показывать весь каталог.
		// Поэтому при выборе этой опции сбрасываем category-фильтр целиком.
		if (uncategorizedId && ids.includes(uncategorizedId)) {
			setFilters(prev => {
				const { category: _category, ...rest } = prev
				return rest
			})
			return
		}
		if (ids.length > 0) {
			setFilters(prev => ({ ...prev, category: ids.join(',') }))
		} else {
			setFilters(prev => {
				const { category: _, ...rest } = prev
				return rest
			})
		}
	}

	const handleMultiSelectChange = (field: 'material' | 'style' | 'color') => {
		return (values: string[] | undefined) => {
			if (values && values.length > 0) {
				setFilters(prev => ({ ...prev, [field]: values.join(',') }))
			} else {
				setFilters(prev => {
					const { [field]: _, ...rest } = prev
					return rest
				})
			}
		}
	}

	const visibleCategories = categories?.slice(0, visibleCategoriesCount) || []
	const hasMoreCategories = categories && categories.length > visibleCategoriesCount
	return (
		<div className='min-h-screen bg-gray-bg pb-20 lg:pb-0'>
			{catalogView === '3d' && (
				<Script
					src='https://unpkg.com/@google/model-viewer@3.4.0/dist/model-viewer.min.js'
					strategy='beforeInteractive'
					type='module'
				/>
			)}
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
									<div className='space-y-1'>
										{/* Кнопка "Все категории" для сброса фильтра */}
										<button
											onClick={() =>
												setFilters(prev => {
													const { category: _, ...rest } = prev
													return rest
												})
											}
											className={`w-full text-left px-4 py-2 rounded-lg transition-colors duration-200 ease-out flex items-center ${
												!filters.category
													? 'bg-main1 text-white'
													: 'bg-gray-bg text-black hover:bg-gray2'
											}`}
										>
											<span className='text-sm font-medium'>Все категории</span>
										</button>

										{/* Список категорий с чекбоксами */}
										{(() => {
											const selectedIds =
												typeof filters.category === 'string'
													? filters.category.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
													: filters.category !== undefined
														? [Number(filters.category)]
														: []
											return visibleCategories.map((category: Category) => {
											const isChecked = selectedIds.includes(category.id)
											return (
												<label
													key={category.id}
													className='flex items-center gap-2 w-full px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-bg transition-colors duration-200 ease-out min-h-[44px]'
												>
													<input
														type='checkbox'
														checked={isChecked}
														onChange={() => {
															const next = isChecked
																? selectedIds.filter((id: number) => id !== category.id)
																: [...selectedIds, category.id]
															handleFurnitureTypeChange(next)
														}}
														className='w-4 h-4 flex-shrink-0 text-main1 border-gray2 rounded focus:ring-2 focus:ring-main1 cursor-pointer accent-main1'
													/>
													<span className='text-sm font-medium truncate'>{category.name}</span>
												</label>
											)
											})
										})()}
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
					<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 lg:mb-8'>
						<h1 className='text-2xl sm:text-3xl font-bold text-black'>Каталог</h1>
						<div
							className='inline-flex rounded-lg border border-gray2 p-0.5 bg-gray-bg self-start sm:self-auto'
							role='group'
							aria-label='Режим отображения каталога'
						>
							<button
								type='button'
								onClick={() => setCatalogView('2d')}
								className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
									catalogView === '2d'
										? 'bg-main1 text-white'
										: 'text-black hover:bg-white/80'
								}`}
							>
								2D
							</button>
							<button
								type='button'
								onClick={() => setCatalogView('3d')}
								className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
									catalogView === '3d'
										? 'bg-main1 text-white'
										: 'text-black hover:bg-white/80'
								}`}
							>
								3D
							</button>
						</div>
					</div>

					{/* ⚙️ Фильтры */}
					<div className='mb-4 sm:mb-6'>
						<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4'>
							<div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
								{/* Кнопка фильтра габаритов */}
								<div className='relative'>
									<button
										onClick={() => setOpenFilter(openFilter === 'dimensions' ? null : 'dimensions')}
										className={`min-w-[88px] min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-center ${
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
											/>
										</div>
									)}
								</div>

								{/* Кнопка фильтра цены */}
								<div className='relative'>
									<button
										onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')}
										className={`min-w-[88px] min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-center ${
											filters.price_min !== undefined || filters.price_max !== undefined
												? 'bg-main1 text-white'
												: 'bg-gray-bg text-black hover:bg-gray2'
										}`}
									>
										Цена
									</button>
									{openFilter === 'price' && (
										<div className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 bg-white rounded-lg shadow-lg border border-gray2 z-[100] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden sm:w-auto sm:min-w-[320px] sm:max-w-sm'>
											<PriceFilter
												minPrice={filterRanges.price.min}
												maxPrice={filterRanges.price.max}
												value={
													filters.price_min !== undefined || filters.price_max !== undefined
														? {
																min: filters.price_min ?? filterRanges.price.min,
																max: filters.price_max ?? filterRanges.price.max,
															}
														: undefined
												}
												onChange={handlePriceChange}
											/>
										</div>
									)}
								</div>

								{/* Кнопка фильтра цвета */}
								{filterRanges.colors.length > 0 && (
									<div className='relative'>
										<button
											onClick={() => setOpenFilter(openFilter === 'color' ? null : 'color')}
											className={`min-w-[88px] min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-center ${
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

				{/* Полоса цвета: нейтральные + радуга */}
				<div className='mb-4 sm:mb-6'>
					<RGBRangeFilter
						value={filters.color_hue}
						onChange={v => {
							if (v) {
								setFilters(prev => ({ ...prev, color_hue: v }))
							} else {
								setFilters(prev => {
									const { color_hue: _removed, ...rest } = prev
									return rest
								})
							}
						}}
					/>
				</div>

					<div className='border-t border-gray2 mb-4 sm:mb-6 lg:mb-8'></div>

					{/* 🛋️ Сетка товаров */}
					{productsLoading && (!products || products.length === 0) ? (
						<div className='text-center py-8 text-sm sm:text-base'>Загрузка продуктов...</div>
					) : productsError ? (
						<div className='text-center py-8 text-red-500 text-sm sm:text-base'>
							Ошибка загрузки продуктов: {productsError}
						</div>
					) : !products || products.length === 0 ? (
						<div className='text-center py-8 text-gray-500 text-sm sm:text-base'>
							Подходящие товары не найдены
						</div>
					) : (
						<>
							<div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6'>
								{products.map(product => (
									<ProductCard
										key={product.id}
										product={product}
										catalogDisplayMode={catalogView}
										onAddToCart={handleAddToCart}
										isSuperuser={isSuperuser}
										isAuthenticated={isAuthenticated}
										onProductUpdated={() => refetchProducts()}
										onProductDeleted={() => refetchProducts()}
										onAuthRequired={() => setIsAuthModalOpen(true)}
									/>
								))}
							</div>
							{catalogView === '2d' && hasMore && (
								<div className='mt-6 sm:mt-8 flex justify-center'>
									<button
										type='button'
										onClick={loadMore}
										disabled={loadingMore}
										className='bg-main1 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto'
									>
										{loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
									</button>
								</div>
							)}
							{catalogView === '3d' && (hasMore || hasPrev) && (
								<div className='mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3'>
									<button
										type='button'
										onClick={loadPrevPage}
										disabled={!hasPrev || loadingMore || productsLoading}
										className='w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray2 text-black bg-white hover:bg-gray-bg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed'
									>
										Предыдущая страница
									</button>
									<span className='text-sm text-gray tabular-nums'>
										Страница {currentPage} из {totalPages}
									</span>
									<button
										type='button'
										onClick={loadNextPage}
										disabled={!hasMore || loadingMore || productsLoading}
										className='w-full sm:w-auto bg-main1 text-white px-6 sm:px-8 py-2.5 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm'
									>
										{loadingMore ? 'Загрузка...' : 'Следующая страница'}
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

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={async () => {
					setIsAuthModalOpen(false)
					try {
						const user = await authService.getCurrentUser()
						setIsAuthenticated(true)
						setCurrentUser(user)
					} catch {
						setIsAuthenticated(false)
						setCurrentUser(null)
					}
				}}
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
