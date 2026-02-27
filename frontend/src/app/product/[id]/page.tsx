'use client'

import AuthModal from '@/components/AuthModal'
import BottomNav from '@/components/BottomNav'
import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductModelViewer from '@/components/ProductModelViewer'
import { config } from '@/config'
import { formatDimension } from '@/utils/format'
import { useBaskets, useProduct } from '@/hooks/useApi'
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
	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [toastMessage, setToastMessage] = useState<string | null>(null)

	const { product, loading, error } = useProduct(productId)
	const { createBasket, addToBasket } = useBaskets()

	useEffect(() => {
		if (!toastMessage) return
		const t = setTimeout(() => setToastMessage(null), 3000)
		return () => clearTimeout(t)
	}, [toastMessage])

	useEffect(() => {
		const token = localStorage.getItem('access_token')
		if (token) {
			import('@/services/api').then(({ authService }) =>
				authService.getCurrentUser()
					.then(() => setIsAuthenticated(true))
					.catch(() => setIsAuthenticated(false))
			)
		} else {
			setIsAuthenticated(false)
		}
	}, [])

	const handleAddToCart = () => {
		if (isAuthenticated === false) {
			setIsAuthModalOpen(true)
			return
		}
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
								<ProductModelViewer product={product} variant='page' />
							</div>
						</div>

			{/* Информация о товаре */}
			<div className='space-y-4 sm:space-y-6'>
							<h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-black'>{product.title}</h1>

							{/* Описание */}
							{product.description && (
								<div className='prose max-w-none'>
									<p className='text-black leading-relaxed text-sm'>
										{product.description}
									</p>
								</div>
							)}

							{/* Размеры (без веса) */}
							{(product.width || product.height || product.depth) && (
								<div className='space-y-2 text-sm'>
									<div className='text-sm font-medium text-black'>Размеры:</div>
									<div className='grid grid-cols-2 gap-2 text-sm'>
										{product.width != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Ширина:</span>
												<span className='text-black'>{formatDimension(product.width)} см</span>
											</div>
										)}
										{product.height != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Высота:</span>
												<span className='text-black'>{formatDimension(product.height)} см</span>
											</div>
										)}
										{product.depth != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Глубина:</span>
												<span className='text-black'>{formatDimension(product.depth)} см</span>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Основные действия */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative'>
								<button
									onClick={handleAddToCart}
									className='bg-main1 text-white py-2.5 sm:py-3 rounded-lg hover:bg-main1/90 transition-colors font-medium text-sm sm:text-base'
								>
									.rfa в корзину
								</button>
								<button
									onClick={async () => {
										if (!product.model_rfa) {
											setToastMessage('У этой модели отсутствует RFA-файл')
											return
										}
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
												setToastMessage('RFA-файл недоступен для этого товара')
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
								{toastMessage && (
									<div className='fixed left-1/2 bottom-8 -translate-x-1/2 px-4 py-3 text-sm rounded-lg shadow-xl z-[9999]' style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
										{toastMessage}
									</div>
								)}
							</div>

							{/* Ссылка на вход/регистрацию - только для неавторизованных */}
							{isAuthenticated === false && (
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
					window.dispatchEvent(new Event('auth-updated'))
				}}
			/>
		</div>
	)
}
