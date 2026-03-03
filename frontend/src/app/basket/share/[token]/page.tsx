'use client'

import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { basketService } from '@/services/api'
import { Basket } from '@/types'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AuthModal from '@/components/AuthModal'

interface BasketSharePageProps {
	params: {
		token: string
	}
}

export default function BasketSharePage({ params }: BasketSharePageProps) {
	const router = useRouter()
	const [basket, setBasket] = useState<Basket | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	useEffect(() => {
		const token = localStorage.getItem('access_token')
		setIsAuthenticated(!!token)
	}, [])

	useEffect(() => {
		const fetchBasket = async () => {
			try {
				setLoading(true)
				setError(null)
				const basketData = await basketService.getBasketByShareToken(params.token)
				setBasket(basketData)
			} catch (err: any) {
				console.error('Ошибка при загрузке корзины:', err)
				setError(err.response?.data?.error || 'Корзина не найдена')
			} finally {
				setLoading(false)
			}
		}

		if (params.token) {
			fetchBasket()
		}
	}, [params.token])

	const handleAuthSuccess = () => {
		setIsAuthModalOpen(false)
		setIsAuthenticated(true)
		// После авторизации можно перенаправить на полную страницу корзины
		if (basket) {
			router.push(`/profile/basket/${basket.id}`)
		}
	}

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 lg:pb-8'>
					<div className='flex items-center justify-center h-64'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1'></div>
					</div>
				</main>
				<Footer />
				<BottomNav />
			</div>
		)
	}

	if (error || !basket) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 lg:pb-8'>
					<div className='bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow-card text-center'>
						<h1 className='text-xl sm:text-2xl font-bold text-black mb-4'>Ошибка</h1>
						<p className='text-gray mb-6'>{error || 'Корзина не найдена'}</p>
						<button
							onClick={() => router.push('/')}
							className='bg-main1 text-white px-6 py-3 rounded-lg hover:bg-main2 transition-colors min-h-[44px]'
						>
							Вернуться на главную
						</button>
					</div>
				</main>
				<Footer />
				<BottomNav />
			</div>
		)
	}

	const totalPrice = basket.items.reduce(
		(sum, item) => sum + parseFloat(item.product.price.toString()) * item.quantity,
		0
	)

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 lg:pb-8'>
				{/* Хлебные крошки */}
				<div className='mb-6'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Просмотр корзины</span>
					</nav>
				</div>

				<div className='bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow-card'>
					<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
						<h1 className='text-xl sm:text-2xl md:text-3xl font-bold text-black'>{basket.name}</h1>
						{!isAuthenticated && (
							<button
								onClick={() => setIsAuthModalOpen(true)}
								className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
							>
								Войти для редактирования
							</button>
						)}
					</div>

					{/* Информация о корзине */}
					<div className='mb-6 p-4 bg-gray-bg rounded-lg'>
						<p className='text-sm text-gray mb-2'>
							Создана: {new Date(basket.created_at).toLocaleDateString('ru-RU')}
						</p>
						{basket.user && typeof basket.user === 'object' && (
							<p className='text-sm text-gray'>
								Владелец: {basket.user.username}
							</p>
						)}
					</div>

					{/* Список товаров */}
					{basket.items.length === 0 ? (
						<div className='text-center py-12'>
							<p className='text-gray text-lg'>Корзина пуста</p>
						</div>
					) : (
						<>
							<div className='space-y-4 mb-6'>
								{basket.items.map((item) => (
									<div
										key={item.id}
										className='flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
									>
									{/* ID 3D модели + изображение товара */}
									<div className='flex items-center gap-3 flex-shrink-0'>
										{item.product.model_3d_id && (
											<span className='text-xs sm:text-sm text-black font-semibold font-mono'>
												{item.product.model_3d_id}
											</span>
										)}
									<div className='w-20 h-20 sm:w-24 sm:h-24 bg-gray-bg rounded-lg overflow-hidden flex-shrink-0'>
										{item.product.image ? (
											<Image
												src={item.product.image}
												alt={item.product.title}
												width={96}
												height={96}
												className='w-full h-full object-cover'
												unoptimized
											/>
										) : (
											<div className='w-full h-full flex items-center justify-center'>
												<Image
													src='/img/sofa-card.svg'
													alt='Нет изображения'
													width={48}
													height={48}
													className='opacity-50'
												/>
											</div>
										)}
									</div>
									</div>

									{/* Информация о товаре */}
									<div className='flex-1'>
										<h3 className='text-lg font-semibold text-black mb-1'>
											{item.product.title_display ?? getTitleWithoutBrand(item.product.title || '', item.product.brand) ?? item.product.title}
										</h3>
											{item.product.article && (
												<p className='text-sm text-gray mb-2'>
													Артикул: {item.product.article}
												</p>
											)}
											<div className='flex items-center gap-4 text-sm'>
												<span className='text-gray'>Количество: {item.quantity}</span>
												{item.format && (
													<span className='text-gray'>Формат: {item.format}</span>
												)}
											</div>
										</div>

										{/* Цена */}
										<div className='text-left sm:text-right'>
											<p className='text-xl font-bold text-black'>
												{(
													parseFloat(item.product.price.toString()) * item.quantity
												).toLocaleString('ru-RU', {
													style: 'currency',
													currency: 'RUB',
												})}
											</p>
											<p className='text-sm text-gray'>
												{parseFloat(item.product.price.toString()).toLocaleString('ru-RU', {
													style: 'currency',
													currency: 'RUB',
												})}{' '}
												за шт.
											</p>
										</div>
									</div>
								))}
							</div>

							{/* Итого */}
							<div className='border-t border-gray2 pt-6'>
								<div className='flex justify-between items-center'>
									<span className='text-xl font-semibold text-black'>Итого:</span>
									<span className='text-2xl font-bold text-main1'>
										{totalPrice.toLocaleString('ru-RU', {
											style: 'currency',
											currency: 'RUB',
										})}
									</span>
								</div>
							</div>
						</>
					)}

					{/* Предупреждение для неавторизованных пользователей */}
					{!isAuthenticated && (
						<div className='mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
							<p className='text-sm text-yellow-800'>
								Вы просматриваете корзину в режиме просмотра. Для редактирования и
								добавления товаров необходимо войти в систему.
							</p>
						</div>
					)}
				</div>
			</main>

			<Footer />
			<BottomNav />

			{/* Модальное окно авторизации */}
			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</div>
	)
}

