'use client'

import AddProductsModal from '@/components/AddProductsModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import UpgradeSubscriptionModal from '@/components/UpgradeSubscriptionModal'
import { config } from '@/config'
import { authService, basketService } from '@/services/api'
import { Basket, BasketItem, User } from '@/types'
import {
	ArrowDownTrayIcon,
	ArrowLeftIcon,
	EyeIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BasketDetailPage() {
	const params = useParams()
	const router = useRouter()
	const basketId = Number(params.id)
	const [basket, setBasket] = useState<Basket | null>(null)
	const [loading, setLoading] = useState(true)
	const [currentUser, setCurrentUser] = useState<User | null>(null)
	const [selectedFormats, setSelectedFormats] = useState<
		Record<number, string>
	>({})
	const [isAddProductsModalOpen, setIsAddProductsModalOpen] = useState(false)
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
	const [upgradeModalMessage, setUpgradeModalMessage] = useState<string>('')

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Загружаем текущего пользователя
				const user = await authService.getCurrentUser()
				setCurrentUser(user)

				// Загружаем корзину
				const data = await basketService.getBasket(basketId)
				setBasket(data)
			} catch (error) {
				console.error('Ошибка загрузки данных:', error)
			} finally {
				setLoading(false)
			}
		}

		if (basketId) {
			fetchData()
		}
	}, [basketId])

	const handleFormatChange = (itemId: number, format: string) => {
		setSelectedFormats(prev => ({
			...prev,
			[itemId]: format,
		}))
	}

	const handleDeleteItem = async (item: BasketItem) => {
		if (!basket) return
		try {
			// Передаем product.id, а не item.id, так как бэкенд ожидает product_id
			await basketService.removeFromBasket(basket.id, item.product.id)
			setBasket(prev => ({
				...prev!,
				items: prev!.items.filter(basketItem => basketItem.id !== item.id),
			}))
		} catch (error) {
			console.error('Ошибка при удалении товара:', error)
		}
	}

	const handleAddProducts = async (
		products: { id: number; format: string }[]
	) => {
		if (!basket) return

		try {
			// Добавляем каждый товар в корзину
			for (const product of products) {
				await basketService.addToBasket(
					basket.id,
					product.id,
					1,
					product.format
				)
			}

			// Обновляем корзину
			const updatedBasket = await basketService.getBasket(basket.id)
			setBasket(updatedBasket)
		} catch (error) {
			console.error('Ошибка при добавлении товаров:', error)
		}
	}

	const handleDownloadProduct = async (productId: number, format: string) => {
		try {
			// Получаем URL для скачивания через API
			const response = await fetch(`${config.API_URL}/api/downloads/presign/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: localStorage.getItem('access_token')
						? `Bearer ${localStorage.getItem('access_token')}`
						: '',
				},
				body: JSON.stringify({
					product_id: productId,
					format: format,
				}),
			})

			// Проверяем, что ответ является JSON
			const contentType = response.headers.get('content-type')
			if (!contentType || !contentType.includes('application/json')) {
				const text = await response.text()
				console.error('Неожиданный формат ответа:', text.substring(0, 100))
				alert('Ошибка: сервер вернул неверный формат ответа')
				return
			}

			const data = await response.json()

			// Проверяем, достигнут ли лимит скачиваний (403 Forbidden или 500 с сообщением о лимите)
			const isLimitError =
				(response.status === 403 && data.error) ||
				(response.status === 500 &&
					data.error &&
					(data.error.includes('лимит') ||
						data.error.includes('скачиваний') ||
						data.error.includes('подписк')))

			if (isLimitError) {
				// Открываем модальное окно с выбором подписки
				setUpgradeModalMessage(
					data.error ||
						'Достигнут лимит скачиваний для вашей подписки. Обновите подписку для продолжения.'
				)
				setIsUpgradeModalOpen(true)
				return
			}

			if (response.ok) {
				if (data.url) {
					// Скачиваем изображение через fetch и blob
					try {
						const imageResponse = await fetch(data.url)
						if (!imageResponse.ok) {
							throw new Error('Не удалось загрузить изображение')
						}

						const blob = await imageResponse.blob()
						const blobUrl = window.URL.createObjectURL(blob)

						// Создаем временную ссылку для скачивания
						const link = document.createElement('a')
						link.href = blobUrl
						link.download = `product_${productId}_image.jpg` // Имя файла для скачивания
						document.body.appendChild(link)
						link.click()
						document.body.removeChild(link)

						// Освобождаем память
						window.URL.revokeObjectURL(blobUrl)
					} catch (downloadError) {
						console.error('Ошибка при скачивании изображения:', downloadError)
						alert('Ошибка при скачивании изображения')
					}
				} else if (data.error) {
					alert(data.error)
				} else {
					alert('Изображение товара не найдено')
				}
			} else {
				// Показываем ошибку от сервера
				const errorMessage =
					data.error ||
					data.message ||
					'Ошибка при получении ссылки для скачивания'
				alert(errorMessage)
			}
		} catch (error: any) {
			console.error('Ошибка при скачивании товара:', error)
			// Проверяем, является ли ошибка SyntaxError (невалидный JSON)
			if (error instanceof SyntaxError) {
				alert(
					'Ошибка: сервер вернул неверный формат данных. Проверьте, что API работает корректно.'
				)
			} else {
				alert(error.message || 'Ошибка при скачивании товара')
			}
		}
	}

	const calculateTotal = () => {
		if (!basket) return 0
		return basket.items.reduce(
			(total, item) => total + item.product.price * item.quantity,
			0
		)
	}

	const isOwner =
		currentUser &&
		basket &&
		((typeof basket.user === 'object' && basket.user?.id === currentUser.id) ||
			(typeof basket.user === 'number' && basket.user === currentUser.id))

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-bg flex items-center justify-center'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mx-auto'></div>
					<p className='mt-4 text-gray'>Загрузка...</p>
				</div>
			</div>
		)
	}

	if (!basket) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='bg-white rounded-xl p-8 shadow-card text-center'>
						<p className='text-gray'>Корзина не найдена</p>
					</div>
				</main>
				<Footer />
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				<div className='bg-white rounded-xl p-8 shadow-card'>
					{/* Top section */}
					<div className='flex items-center justify-between mb-8'>
						<div className='flex items-center gap-4'>
							<button
								onClick={() => router.push('/profile?tab=cart')}
								className='flex items-center gap-2 text-gray hover:text-black transition-colors'
							>
								<ArrowLeftIcon className='w-5 h-5' />
								Назад
							</button>
							<h1 className='text-2xl font-bold text-black'>
								{basket.name || 'Проект_Квартира_Ивановых'}
							</h1>
						</div>
						{isOwner && (
							<button
								onClick={() => setIsAddProductsModalOpen(true)}
								className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
							>
								Добавить из каталога
							</button>
						)}
					</div>

					{/* Items list */}
					<div className='space-y-0'>
						{basket.items.length === 0 ? (
							<p className='text-gray text-center py-8'>Корзина пуста</p>
						) : (
							basket.items.map((item: BasketItem, index) => (
								<div
									key={item.id}
									className={`flex items-center gap-4 p-4 ${
										index !== basket.items.length - 1
											? 'border-b border-gray2'
											: ''
									}`}
								>
									{/* Product image */}
									<div className='flex-shrink-0'>
										{item.product.image ? (
											<Image
												src={item.product.image}
												alt={item.product.title || 'Товар'}
												width={120}
												height={120}
												className='w-24 h-24 object-cover rounded-lg bg-gray-bg'
												unoptimized
											/>
										) : (
											<Image
												src='/img/sofa-card.svg'
												alt='Заглушка'
												width={120}
												height={120}
												className='w-24 h-24 object-cover rounded-lg bg-gray-bg'
											/>
										)}
									</div>

									{/* Product name */}
									<div className='w-48'>
										<h3 className='text-base font-medium text-black'>
											{item.product.title || 'Наименование товара'}
										</h3>
									</div>

									{/* Right side - grouped together */}
									<div className='flex items-center gap-4 ml-auto'>
										{/* Price */}
										<div className='w-36 text-right'>
											<p className='text-main1 font-semibold text-lg'>
												{item.product.price.toLocaleString('ru-RU')} руб
											</p>
										</div>

										{/* 3D buttons with formats - 2 rows */}
										<div className='flex flex-col gap-2'>
											{/* First row: 3D Viewer + 2 formats */}
											<div className='flex items-center gap-2'>
												<button className='border-2 border-main1 bg-white text-black px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-xs whitespace-nowrap w-36'>
													Открыть 3D Viewer
												</button>
												{['.fbx', '.glb'].map(format => (
													<label
														key={format}
														className='flex items-center gap-1 cursor-pointer border border-gray2 rounded-lg px-2 py-1.5'
													>
														<input
															type='checkbox'
															checked={
																selectedFormats[item.id] === format ||
																(format === '.fbx' && !selectedFormats[item.id])
															}
															onChange={() =>
																handleFormatChange(item.id, format)
															}
															className='w-3 h-3 text-main1 focus:ring-main1 focus:ring-2 rounded'
														/>
														<span className='text-xs text-black'>{format}</span>
													</label>
												))}
											</div>
											{/* Second row: GLB Fitting + 2 formats */}
											<div className='flex items-center gap-2'>
												<button className='border-2 border-main1 bg-white text-black px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-xs whitespace-nowrap w-36'>
													Примерка GLB
												</button>
												{['.rfa', '.uszd'].map(format => (
													<label
														key={format}
														className='flex items-center gap-1 cursor-pointer border border-gray2 rounded-lg px-2 py-1.5'
													>
														<input
															type='checkbox'
															checked={selectedFormats[item.id] === format}
															onChange={() =>
																handleFormatChange(item.id, format)
															}
															className='w-3 h-3 text-main1 focus:ring-main1 focus:ring-2 rounded'
														/>
														<span className='text-xs text-black'>{format}</span>
													</label>
												))}
											</div>
										</div>
									</div>

									{/* Action buttons - только для владельца корзины */}
									{isOwner ? (
										<div className='flex items-center gap-3'>
											<button
												onClick={() =>
													router.push(`/product/${item.product.id}`)
												}
												title='Просмотр'
												className='text-gray hover:text-main1 transition-colors'
											>
												<EyeIcon className='w-5 h-5' />
											</button>
											<button
												onClick={() =>
													handleDownloadProduct(
														item.product.id,
														item.format || ''
													)
												}
												title='Скачать'
												className='text-gray hover:text-main1 transition-colors'
											>
												<ArrowDownTrayIcon className='w-5 h-5' />
											</button>
											<button
												onClick={() => handleDeleteItem(item)}
												title='Удалить'
												className='text-red-500 hover:text-red-700 transition-colors'
											>
												<TrashIcon className='w-5 h-5' />
											</button>
										</div>
									) : null}
								</div>
							))
						)}
					</div>

					{/* Bottom section */}
					{basket.items.length > 0 && (
						<div className='mt-8 pt-6 border-t border-gray2 flex items-center justify-between'>
							<div>
								<p className='text-2xl font-bold text-black'>
									ИТОГО: {calculateTotal().toLocaleString('ru-RU')} P
								</p>
							</div>
							{/* Кнопка "Заказать" только для владельца корзины */}
							{currentUser &&
							basket &&
							((typeof basket.user === 'object' &&
								basket.user?.id === currentUser.id) ||
								(typeof basket.user === 'number' &&
									basket.user === currentUser.id)) ? (
								<button className='bg-main1 text-white px-12 py-3 rounded-lg hover:bg-main2 transition-colors font-medium text-lg'>
									Заказать
								</button>
							) : (
								<p className='text-gray text-sm'>
									Эта корзина принадлежит другому пользователю
								</p>
							)}
						</div>
					)}
				</div>
			</main>

			<Footer />

			{/* Modal for adding products */}
			<AddProductsModal
				isOpen={isAddProductsModalOpen}
				onClose={() => setIsAddProductsModalOpen(false)}
				onAddProducts={handleAddProducts}
				currentBasketId={basketId}
			/>

			{/* Modal for subscription upgrade */}
			<UpgradeSubscriptionModal
				isOpen={isUpgradeModalOpen}
				onClose={() => setIsUpgradeModalOpen(false)}
				currentSubscription={
					(currentUser?.profile?.subscription_type as
						| 'trial'
						| 'basic'
						| 'premium') || 'trial'
				}
				message={upgradeModalMessage}
			/>
		</div>
	)
}
