'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { useBaskets, useCategories, useProducts } from '@/hooks/useApi'
import { ProductFilters } from '@/types'
import Image from 'next/image'
import { useState } from 'react'

// 💡 Типы для категорий и продуктов (чтобы не было ошибок типов)
interface Category {
	id: number
	name: string
	slug: string
	image?: string | null
	parent?: number | null
	parent_category?: {
		id: number
		name: string
		slug: string
	} | null
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
	const [filters, setFilters] = useState<ProductFilters>({})
	const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(10) // Показываем первые 10 категорий

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

	const handleShowMoreCategories = () => {
		setVisibleCategoriesCount(prev => prev + 10) // Показываем еще 10 категорий
	}

	const visibleCategories = categories?.slice(0, visibleCategoriesCount) || []
	const hasMoreCategories = categories && categories.length > visibleCategoriesCount

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
					<div className='flex items-center justify-between mb-4'>
						<div className='flex items-center gap-3'>
							<span className='text-black font-medium'>Фильтр</span>

							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Цена</option>
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
