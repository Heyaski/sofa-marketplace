'use client'

import AddProductsModal from '@/components/AddProductsModal'
import BottomNav from '@/components/BottomNav'
import CommercialProposalModal from '@/components/CommercialProposalModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import UpgradeSubscriptionModal from '@/components/UpgradeSubscriptionModal'
import { config } from '@/config'
import apiClient from '@/lib/api'
import { authService, basketService, basketEditRequestService } from '@/services/api'
import { Basket, BasketItem, User, BasketEditRequest } from '@/types'
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
	const [isAddProductsModalOpen, setIsAddProductsModalOpen] = useState(false)
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
	const [upgradeModalMessage, setUpgradeModalMessage] = useState<string>('')
	const [editRequests, setEditRequests] = useState<BasketEditRequest[]>([])
	const [showEditRequests, setShowEditRequests] = useState(false)
	const [hasPendingRequest, setHasPendingRequest] = useState(false)
	const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Загружаем текущего пользователя
				const user = await authService.getCurrentUser()
				setCurrentUser(user)

				// Загружаем корзину
				const data = await basketService.getBasket(basketId)
				setBasket(data)

				// Если пользователь - владелец, загружаем запросы на редактирование
				if (data.is_owner) {
					await fetchEditRequests()
				} else {
					// Если не владелец, проверяем, есть ли у него активный запрос
					await checkPendingRequest()
					// Если пользователь имеет право редактирования, обновляем canEdit
					if (data.can_edit) {
						// Пользователь может редактировать - обновляем состояние
					}
				}
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

	const fetchEditRequests = async () => {
		try {
			const requests = await basketService.getBasketEditRequests(basketId)
			setEditRequests(Array.isArray(requests) ? requests : [])
		} catch (error) {
			console.error('Ошибка при загрузке запросов:', error)
			setEditRequests([])
		}
	}

	const checkPendingRequest = async () => {
		try {
			const response = await basketEditRequestService.getRequests()
			const requests = response && response.results ? response.results : Array.isArray(response) ? response : []
			const pending = requests.find((req: BasketEditRequest) => 
				req.basket.id === basketId && req.status === 'pending'
			)
			setHasPendingRequest(!!pending)
		} catch (error) {
			console.error('Ошибка при проверке запроса:', error)
		}
	}

	const handleRequestEdit = async () => {
		if (!basket) return
		try {
			await basketEditRequestService.createRequest(basket.id)
			alert('Запрос на редактирование корзины отправлен')
			setHasPendingRequest(true)
		} catch (error: any) {
			console.error('Ошибка при создании запроса:', error)
			alert(error.response?.data?.error || 'Ошибка при отправке запроса')
		}
	}

	const handleApproveRequest = async (requestId: number) => {
		try {
			await basketEditRequestService.approveRequest(requestId)
			alert('Запрос одобрен. Пользователь, который запросил редактирование, должен обновить страницу корзины.')
			await fetchEditRequests()
			// Перезагружаем корзину для обновления can_edit (для текущего пользователя)
			const updatedBasket = await basketService.getBasket(basketId)
			setBasket(updatedBasket)
		} catch (error: any) {
			console.error('Ошибка при одобрении запроса:', error)
			alert(error.response?.data?.error || 'Ошибка при одобрении запроса')
		}
	}

	const handleRejectRequest = async (requestId: number) => {
		try {
			await basketEditRequestService.rejectRequest(requestId)
			alert('Запрос отклонен')
			await fetchEditRequests()
		} catch (error: any) {
			console.error('Ошибка при отклонении запроса:', error)
			alert(error.response?.data?.error || 'Ошибка при отклонении запроса')
		}
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

	const isOwner =
		currentUser &&
		basket &&
		((typeof basket.user === 'object' && basket.user?.id === currentUser.id) ||
			(typeof basket.user === 'number' && basket.user === currentUser.id))
	
	// can_edit приходит с сервера и обновляется при загрузке корзины
	// После одобрения запроса пользователь должен обновить страницу корзины
	const canEdit = basket?.can_edit === true || isOwner

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
			<div className='min-h-[100dvh] bg-gray-bg flex flex-col'>
				<Header />
				<main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 lg:pb-8'>
					<div className='bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow-card text-center'>
						<p className='text-gray'>Корзина не найдена</p>
					</div>
				</main>
				<Footer />
				<BottomNav />
			</div>
		)
	}

	return (
		<div className='min-h-[100dvh] bg-gray-bg flex flex-col'>
			<Header />

			<main className='flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 lg:pb-8 w-full'>
				<div className='bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow-card'>
					{/* Top section */}
					<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8'>
						<div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
							<button
								onClick={() => router.push('/profile?tab=cart')}
								className='flex items-center gap-2 text-gray hover:text-black transition-colors self-start'
							>
								<ArrowLeftIcon className='w-5 h-5' />
								Назад
							</button>
							<h1 className='text-xl sm:text-2xl font-bold text-black'>
								{basket.name || 'Проект_Квартира_Ивановых'}
							</h1>
						</div>
						<div className='flex flex-wrap items-center gap-2 sm:gap-3'>
							{/* Кнопка запроса редактирования для не-владельцев */}
							{!isOwner && !canEdit && !hasPendingRequest && (
								<button
									onClick={handleRequestEdit}
									className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
								>
									Запросить редактирование
								</button>
							)}
							{!isOwner && hasPendingRequest && (
								<span className='text-sm text-gray'>Запрос на редактирование отправлен</span>
							)}
							{/* Кнопка просмотра запросов для владельца */}
							{isOwner && (
								<>
									<button
										onClick={() => {
											setShowEditRequests(!showEditRequests)
											if (!showEditRequests) {
												fetchEditRequests()
											}
										}}
										className='bg-gray-bg text-black px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base w-full sm:w-auto'
									>
										Запросы на редактирование {editRequests.length > 0 && `(${editRequests.length})`}
									</button>
									<button
										onClick={() => setIsAddProductsModalOpen(true)}
										className='bg-main1 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium text-sm sm:text-base w-full sm:w-auto'
									>
										Добавить из каталога
									</button>
								</>
							)}
							{/* Кнопка добавления для пользователей с правом редактирования */}
							{canEdit && !isOwner && (
								<button
									onClick={() => setIsAddProductsModalOpen(true)}
									className='bg-main1 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium text-sm sm:text-base w-full sm:w-auto'
								>
									Добавить из каталога
								</button>
							)}
						</div>
					</div>

					{/* Список запросов на редактирование (для владельца) */}
					{isOwner && showEditRequests && (
						<div className='mb-6 p-4 bg-gray-bg rounded-lg'>
							<h3 className='text-lg font-semibold text-black mb-4'>
								Запросы на редактирование
							</h3>
							{editRequests.length === 0 ? (
								<p className='text-gray text-sm'>Нет активных запросов</p>
							) : (
								<div className='space-y-3'>
									{editRequests.map((request) => (
										<div
											key={request.id}
											className='flex items-center justify-between p-3 bg-white rounded-lg'
										>
											<div>
												<p className='text-sm font-medium text-black'>
													{request.requester.username}
													{request.requester.email && (
														<span className='text-gray ml-2'>
															({request.requester.email})
														</span>
													)}
												</p>
												{request.message && (
													<p className='text-xs text-gray mt-1'>{request.message}</p>
												)}
												<p className='text-xs text-gray mt-1'>
													{new Date(request.created_at).toLocaleString('ru-RU')}
												</p>
											</div>
											<div className='flex gap-2'>
												<button
													onClick={() => handleApproveRequest(request.id)}
													className='px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm'
												>
													Одобрить
												</button>
												<button
													onClick={() => handleRejectRequest(request.id)}
													className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm'
												>
													Отклонить
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Items list */}
					<div className='space-y-0'>
						{basket.items.length === 0 ? (
							<p className='text-gray text-center py-8'>Корзина пуста</p>
						) : (
							basket.items.map((item: BasketItem, index) => (
								<div
									key={item.id}
									className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 ${
										index !== basket.items.length - 1
											? 'border-b border-gray2'
											: ''
									}`}
								>
									{/* ID 3D модели + image + name */}
									<div className='flex items-center gap-3 sm:flex-1 min-w-0'>
										{item.product.model_3d_id && (
											<div className='flex-shrink-0 min-w-[70px] sm:min-w-[80px] flex items-center'>
												<span className='text-sm sm:text-base font-medium text-black'>
													{item.product.model_3d_id}
												</span>
											</div>
										)}
										<div className='flex-shrink-0'>
										{item.product.image ? (
											<Image
												src={item.product.image}
												alt={item.product.title || 'Товар'}
												width={120}
												height={120}
												className='w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg bg-gray-bg'
												unoptimized
											/>
										) : (
											<Image
												src='/img/sofa-card.svg'
												alt='Заглушка'
												width={120}
												height={120}
												className='w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg bg-gray-bg'
											/>
										)}
									</div>
									<div className='flex-1 min-w-0 flex items-center'>
										<h3 className='text-sm sm:text-base font-medium text-black line-clamp-2'>
											{item.product.title_display ?? item.product.title ?? 'Наименование товара'}
										</h3>
									</div>
								</div>

									{/* Action buttons */}
									{(isOwner || canEdit) ? (
										<div className='flex items-center gap-3 flex-shrink-0'>
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
						<div className='mt-8 pt-6 border-t border-gray2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4'>
							{/* Кнопки для владельца или пользователя с правом редактирования */}
							{currentUser && basket && (isOwner || canEdit) ? (
								<div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto'>
									<button
										onClick={() => setIsProposalModalOpen(true)}
										className='bg-white text-main1 border-2 border-main1 px-6 sm:px-8 py-3 rounded-lg hover:bg-main1 hover:text-white transition-colors font-medium text-sm sm:text-base w-full sm:w-auto'
									>
										Подобрать аналоги в продаже
									</button>
									<button className='bg-main1 text-white px-8 sm:px-12 py-3 rounded-lg hover:bg-main2 transition-colors font-medium text-base sm:text-lg w-full sm:w-auto'>
										Заказать
									</button>
								</div>
							) : currentUser && basket && !isOwner && !canEdit ? (
								<div className='flex flex-col items-end gap-2'>
									<p className='text-gray text-sm'>
										Эта корзина принадлежит другому пользователю
									</p>
									{hasPendingRequest && (
										<>
											<p className='text-sm text-gray'>Запрос на редактирование отправлен</p>
											<button
												onClick={async () => {
													const updatedBasket = await basketService.getBasket(basketId)
													setBasket(updatedBasket)
													if (updatedBasket.can_edit) {
														alert('Вам предоставлено право редактирования!')
														setHasPendingRequest(false)
													}
												}}
												className='bg-gray-bg text-black px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors font-medium text-xs'
											>
												Обновить статус
											</button>
										</>
									)}
								</div>
							) : (
								<p className='text-gray text-sm'>
									Войдите, чтобы заказать
								</p>
							)}
						</div>
					)}
				</div>
			</main>

			<Footer />
			<BottomNav />

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

			{/* Modal for commercial proposal */}
			<CommercialProposalModal
				isOpen={isProposalModalOpen}
				onClose={() => setIsProposalModalOpen(false)}
				basketId={basketId}
				basketName={basket?.name || ''}
				userName={
					currentUser
						? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username
						: ''
				}
				userEmail={currentUser?.email || ''}
			/>
		</div>
	)
}
