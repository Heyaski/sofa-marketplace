'use client'

import AuthModal from '@/components/AuthModal'
import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ModelViewerModal from '@/components/ModelViewerModal'
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
	const [selectedFormat, setSelectedFormat] = useState(
		config.SUPPORTED_FORMATS[0]
	)
	const [mainImage, setMainImage] = useState<string | null>(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [is3DViewerOpen, setIs3DViewerOpen] = useState(false)

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

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				{/* Хлебные крошки */}
				<div className='mb-8'>
					<nav className='text-sm text-gray'>
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

				<div className='bg-white rounded-xl p-8 shadow-card'>
					<div className='grid lg:grid-cols-2 gap-12'>
						{/* Изображения товара */}
						<div className='space-y-4'>
							{/* Главное изображение */}
							<div className='aspect-square bg-gray-bg rounded-lg p-8'>
								{mainImage ? (
									<div className='w-full h-full rounded-lg overflow-hidden'>
										<Image
											src={mainImage}
											alt={product.title}
											width={600}
											height={600}
											className='w-full h-full object-contain'
											unoptimized
										/>
									</div>
								) : (
									<div className='w-full h-full bg-gray-bg rounded-lg flex items-center justify-center'>
										<Image
											src='/img/sofa-card.svg'
											alt='Нет изображения'
											width={128}
											height={128}
											className='opacity-50'
										/>
									</div>
								)}
							</div>

							{/* Миниатюры - горизонтальная прокрутка */}
							{thumbnails.length > 0 && (
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
						<div className='space-y-6'>
							<h1 className='text-3xl font-bold text-black'>{product.title}</h1>

							{/* Цена */}
							<div className='space-y-2'>
								<div className='text-3xl font-bold text-black'>
									{formatPrice(Number(product.price))} {config.CURRENCY_SYMBOL}
								</div>
								<div className='text-lg text-gray line-through'>
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

							{/* Артикул и наличие */}
							<div className='flex items-center gap-4 text-sm'>
								{product.article && (
									<span className='text-gray'>
										Артикул:{' '}
										<span className='text-black font-medium'>
											{product.article}
										</span>
									</span>
								)}
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
									{product.color && (
										<div className='flex justify-between'>
											<span className='text-gray'>Цвет:</span>
											<span className='text-black'>{product.color}</span>
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

							{/* Кнопка Яндекс */}
							<button className='w-full border-2 border-red-500 bg-white text-black py-3 px-4 rounded-lg hover:bg-red-50 transition-colors'>
								Открыть товар в Яндекс
							</button>

							{/* Все кнопки в одну линию */}
							<div className='grid grid-cols-3 gap-4'>
								<button
									onClick={handleAddToCart}
									className='bg-main1 text-white py-3 rounded-lg hover:bg-main1/90 transition-colors font-medium whitespace-nowrap text-sm'
								>
									Добавить в корзину
								</button>
								<button
									onClick={() => setIs3DViewerOpen(true)}
									disabled={
										!product?.asset_3d_models ||
										!Array.isArray(product.asset_3d_models) ||
										product.asset_3d_models.length === 0
									}
									className='border-2 border-main1 bg-white text-black py-3 rounded-lg hover:bg-main1 hover:text-white transition-colors whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed'
									title={
										!product?.asset_3d_models ||
										product.asset_3d_models.length === 0
											? 'У товара нет 3D моделей'
											: `Открыть 3D просмотр (${product.asset_3d_models.length})`
									}
								>
									Открыть 3D Viewer
								</button>
								<button className='border-2 border-main1 bg-white text-black py-3 rounded-lg hover:bg-main1 hover:text-white transition-colors whitespace-nowrap text-sm'>
									Примерка GLB
								</button>
							</div>

							{/* Ссылка на вход/регистрацию - только для неавторизованных */}
							{!isAuthenticated && (
								<div className='text-sm text-gray text-center'>
									<button
										className='hover:text-black transition-colors cursor-pointer'
										onClick={() => setIsAuthModalOpen(true)}
									>
										Войти / Зарегестрироваться
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>

			<Footer />

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

			<ModelViewerModal
				isOpen={is3DViewerOpen}
				onClose={() => setIs3DViewerOpen(false)}
				models={product?.asset_3d_models || []}
				productTitle={product?.title}
			/>
		</div>
	)
}
