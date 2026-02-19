'use client'

import AuthModal from '@/components/AuthModal'
import BottomNav from '@/components/BottomNav'
import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductModelViewer from '@/components/ProductModelViewer'
import { config } from '@/config'
import { useBaskets, useProduct } from '@/hooks/useApi'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ProductPageProps {
	params: {
		id: string
	}
}

export default function ProductPage({ params }: ProductPageProps) {
	const router = useRouter()
	const productId = parseInt(params.id)
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const selectedFormat = config.DEFAULT_FORMAT
	const [mainImage, setMainImage] = useState<string | null>(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	const { product, loading, error } = useProduct(productId)
	const { createBasket, addToBasket } = useBaskets()

	// Устанавливаем главное изображение при загрузке продукта
	useEffect(() => {
		// Приоритет 1: asset_images (из FileAsset)
		if (product?.asset_images && product.asset_images.length > 0) {
			setMainImage(product.asset_images[0].file_url)
		} 
		// Приоритет 2: images (из ProductImage)
		else if (product?.images && product.images.length > 0) {
			setMainImage(product.images[0].image_url)
		} 
		// Приоритет 3: старое поле image (для обратной совместимости)
		else if (product?.image) {
			setMainImage(product.image)
		}
	}, [product?.asset_images, product?.images, product?.image])

	// Проверка авторизации пользователя
	useEffect(() => {
		const token = localStorage.getItem('access_token')
		setIsAuthenticated(!!token)
	}, [])

	const handleAddToCart = () => {
		setIsCartModalOpen(true)
	}

	const handleCartSelect = async (cartId: number) => {
		if (product) {
			try {
				await addToBasket(cartId, product.id, 1, selectedFormat)
			} catch (error) {
				console.error('Ошибка при добавлении в корзину:', error)
			}
		}
		setIsCartModalOpen(false)
	}

	const handleCreateNewCart = async (cartName: string) => {
		try {
			const newBasket = await createBasket(cartName)
			if (product) {
				await addToBasket(newBasket.id, product.id, 1, selectedFormat)
			}
		} catch (error) {
			console.error('Ошибка при создании корзины:', error)
		}
		setIsCartModalOpen(false)
	}

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(Number(price))
	}

	// Получаем массив изображений для миниатюр
	const getThumbnails = () => {
		const thumbnails: string[] = []
		
		// Добавляем изображения из asset_images (FileAsset)
		if (product?.asset_images && product.asset_images.length > 0) {
			product.asset_images.forEach(asset => {
				if (asset.file_url) {
					thumbnails.push(asset.file_url)
				}
			})
		}
		
		// Добавляем изображения из images (ProductImage)
		if (product?.images && product.images.length > 0) {
			product.images.forEach(img => {
				if (img.image_url) {
					thumbnails.push(img.image_url)
				}
			})
		}
		
		// Если нет изображений в массивах, но есть старое поле image
		if (thumbnails.length === 0 && product?.image) {
			thumbnails.push(product.image)
		}
		
		return thumbnails
	}
	const thumbnails = getThumbnails()

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='text-center py-12'>Загрузка...</div>
				</main>
			</div>
		)
	}

	if (error || !product) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='text-center py-12 text-red-500'>
						Ошибка загрузки товара: {error || 'Товар не найден'}
					</div>
				</main>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20 lg:pb-8'>
				{/* Хлебные крошки */}
				<div className='mb-4 sm:mb-6 lg:mb-8'>
					<nav className='text-xs sm:text-sm text-gray'>
						<span
							className='cursor-pointer hover:text-black'
							onClick={() => router.push('/')}
						>
							Главная
						</span>
						<span className='mx-2'>•</span>
						<span
							className='cursor-pointer hover:text-black'
							onClick={() => router.push('/catalog')}
						>
							Каталог
						</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Страница товара</span>
					</nav>
				</div>

				<div className='bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-card'>
					<div className='grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12'>
						{/* 3D модель или изображения товара — можно крутить */}
						<div className='space-y-4'>
							<div className='bg-gray-bg rounded-lg overflow-hidden'>
								<ProductModelViewer product={product} variant='page' selectedImageUrl={mainImage} />
							</div>

							{/* Миниатюры — если несколько изображений */}
							{thumbnails.length > 1 && (
								<div className='overflow-x-auto pb-2'>
									<div className='flex gap-2 min-w-max'>
										{thumbnails.map((thumbnail, index) => (
											<div
												key={index}
												className={`flex-shrink-0 w-16 h-16 bg-gray-bg rounded-lg p-1 cursor-pointer transition-all ${
													mainImage === thumbnail
														? 'ring-2 ring-main1 bg-gray-100'
														: 'hover:bg-gray'
												}`}
												onClick={() => setMainImage(thumbnail)}
											>
												<Image
													src={thumbnail}
													alt={`Миниатюра ${index + 1}`}
													width={60}
													height={60}
													className='w-full h-full object-contain'
													unoptimized
												/>
											</div>
										))}
									</div>
								</div>
							)}
						</div>

			{/* Информация о товаре */}
			<div className='space-y-4 sm:space-y-6'>
							<h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-black'>{product.title}</h1>

							{/* Цена */}
							<div className='space-y-2'>
								<div className='text-2xl sm:text-3xl font-bold text-black'>
									{formatPrice(Number(product.price))} {config.CURRENCY_SYMBOL}
								</div>
								<div className='text-base sm:text-lg text-gray line-through'>
									{formatPrice(Number(product.price))} {config.CURRENCY_SYMBOL}
								</div>
							</div>

							{/* Описание */}
							{product.description && (
								<div className='prose max-w-none'>
									<p className='text-black leading-relaxed text-sm'>
										{product.description}
									</p>
								</div>
							)}

							{/* Краткое описание под товаром — аккуратный цвет с HEX */}
							<div className='space-y-1 text-sm'>
								{(product.color || product.color_rgb) && (
									<p className='text-gray'>
										Цвет:{' '}
										<span className='text-black'>
											{product.color}
											{product.color_rgb && (
												<>
													{' '}
													(
													{(() => {
														const parts = product.color_rgb
															.split(',')
															.map(p => parseInt(p.trim(), 10))
														if (
															parts.length !== 3 ||
															parts.some(p => Number.isNaN(p))
														) {
															return product.color_rgb
														}
														const toByte = (v: number) =>
															Math.max(0, Math.min(255, v))
																.toString(16)
																.padStart(2, '0')
																.toUpperCase()
														return `#${toByte(parts[0])}${toByte(
															parts[1]
														)}${toByte(parts[2])}`
													})()}
													)
												</>
											)}
										</span>
									</p>
								)}
							</div>

							{/* Наличие */}
							<div className='flex items-center gap-4 text-sm'>
								{product.availability && (
									<span
										className={`px-3 py-1 rounded-full text-xs font-medium ${
											product.availability === 'in_stock'
												? 'bg-green-100 text-green-700'
												: product.availability === 'on_order'
												? 'bg-yellow-100 text-yellow-700'
												: 'bg-red-100 text-red-700'
										}`}
									>
										{product.availability === 'in_stock'
											? 'В наличии'
											: product.availability === 'on_order'
											? 'Под заказ'
											: 'Нет в наличии'}
									</span>
								)}
							</div>

							{/* Характеристики */}
							<div className='space-y-3'>
								<div className='space-y-2 text-sm'>
									{product.category && (
										<div className='flex justify-between'>
											<span className='text-gray'>Категория:</span>
											<span className='text-black'>
												{product.category.name}
											</span>
										</div>
									)}
									{product.brand && (
										<div className='flex justify-between'>
											<span className='text-gray'>Бренд:</span>
											<span className='text-black'>{product.brand}</span>
										</div>
									)}
									{product.country && (
										<div className='flex justify-between'>
											<span className='text-gray'>Страна:</span>
											<span className='text-black'>{product.country}</span>
										</div>
									)}
									{product.material && (
										<div className='flex justify-between'>
											<span className='text-gray'>Материал:</span>
											<span className='text-black'>{product.material}</span>
										</div>
									)}
									{product.style && (
										<div className='flex justify-between'>
											<span className='text-gray'>Стиль:</span>
											<span className='text-black'>{product.style}</span>
										</div>
									)}
								</div>

								{/* Размеры */}
								{(product.width ||
									product.height ||
									product.depth ||
									product.weight) && (
									<div className='border-t pt-3 mt-3'>
										<div className='text-sm font-medium text-black mb-2'>
											Размеры:
										</div>
										<div className='grid grid-cols-2 gap-2 text-sm'>
											{product.width && (
												<div className='flex justify-between'>
													<span className='text-gray'>Ширина:</span>
													<span className='text-black'>{product.width} см</span>
												</div>
											)}
											{product.height && (
												<div className='flex justify-between'>
													<span className='text-gray'>Высота:</span>
													<span className='text-black'>
														{product.height} см
													</span>
												</div>
											)}
											{product.depth && (
												<div className='flex justify-between'>
													<span className='text-gray'>Глубина:</span>
													<span className='text-black'>{product.depth} см</span>
												</div>
											)}
											{product.weight && (
												<div className='flex justify-between'>
													<span className='text-gray'>Вес:</span>
													<span className='text-black'>
														{product.weight} кг
													</span>
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							{/* Основные действия */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
								<button
									onClick={handleAddToCart}
									className='bg-main1 text-white py-2.5 sm:py-3 rounded-lg hover:bg-main1/90 transition-colors font-medium text-sm sm:text-base'
								>
									Добавить в корзину
								</button>
								{product.model_rfa && (
									<button
										onClick={async () => {
											try {
												const response = await fetch(
													`${config.API_URL}/api/downloads/presign/`,
													{
														method: 'POST',
														headers: {
															'Content-Type': 'application/json',
															Authorization:
																typeof window !== 'undefined' &&
																localStorage.getItem('access_token')
																	? `Bearer ${localStorage.getItem('access_token')}`
																	: '',
														},
														body: JSON.stringify({
															product_id: product.id,
															format: '.rfa',
														}),
													}
												)

												const contentType =
													response.headers.get('content-type')
												const isJson =
													contentType &&
													contentType.includes('application/json')
												const data = isJson ? await response.json() : null

												if (!response.ok) {
													const message =
														data?.error ||
														data?.message ||
														'Ошибка при получении ссылки для скачивания RFA'
													alert(message)
													return
												}

												if (data?.url) {
													window.location.href = data.url
												} else {
													alert('RFA-файл недоступен для этого товара')
												}
											} catch (error) {
												console.error(
													'Ошибка при скачивании RFA:',
													error
												)
												alert(
													'Ошибка при скачивании RFA-файла'
												)
											}
										}}
										className='border-2 border-main1 bg-white text-main1 py-2.5 sm:py-3 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm sm:text-base'
									>
										Скачать RFA
									</button>
								)}
							</div>

							{/* Ссылка на вход/регистрацию - только для неавторизованных */}
							{!isAuthenticated && (
								<div className='text-sm text-gray text-center'>
									<button
										className='hover:text-black transition-colors cursor-pointer'
										onClick={() => setIsAuthModalOpen(true)}
									>
										Войти / Зарегистрироваться
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>

			<Footer />
			<BottomNav />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => setIsCartModalOpen(false)}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={() => {
					setIsAuthenticated(true)
					setIsAuthModalOpen(false)
				}}
			/>
		</div>
	)
}
