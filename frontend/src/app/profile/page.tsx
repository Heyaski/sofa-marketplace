'use client'

import BasketsList from '@/components/BasketsList'
import ChatDetail from '@/components/ChatDetail'
import ChatsList from '@/components/ChatsList'
import DownloadsList from '@/components/DownloadsList'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import SubscriptionManagement from '@/components/SubscriptionManagement'
import { useBaskets } from '@/hooks/useApi'
import { authService } from '@/services/api'
import { Chat, User } from '@/types'
import {
	formatCardCVV,
	formatCardExpiry,
	formatCardHolder,
	formatCardNumber,
	validateCardData,
} from '@/utils/cardValidation'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type TabType = 'profile' | 'subscription' | 'downloads' | 'cart' | 'chats'

export default function ProfilePage() {
	const router = useRouter()
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [editing, setEditing] = useState(false)
	const [activeTab, setActiveTab] = useState<TabType>('profile')
	const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
	const { baskets, refetch: refetchBaskets } = useBaskets()

	// Состояние для редактируемых полей
	const [formData, setFormData] = useState({
		email: '',
		first_name: '',
		last_name: '',
		username: '',
		profile: {
			subscription_type: 'trial' as 'trial' | 'basic' | 'premium',
			card_number: '',
			card_holder: '',
			card_expiry: '',
			card_cvv: '',
			chat_notifications: true,
			new_models_notifications: false,
		},
	})

	const handleSelectChat = (chat: Chat) => {
		setSelectedChat(chat)
	}

	// Обработка возврата с оплаты
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search)
		const paymentSuccess = urlParams.get('payment_success')
		const tab = urlParams.get('tab')
		
		if (paymentSuccess === 'true' && tab === 'subscription') {
			// Переключаемся на таб подписки
			setActiveTab('subscription')
			// Очищаем параметры из URL
			window.history.replaceState({}, '', '/profile')
		}
	}, [])

	useEffect(() => {
		const fetchUser = async () => {
			try {
				const userData = await authService.getCurrentUser()
				setUser(userData)
				// Инициализируем форму данными пользователя
				setFormData({
					email: userData.email || '',
					first_name: userData.first_name || '',
					last_name: userData.last_name || '',
					username: userData.username || '',
					profile: {
						subscription_type: userData.profile?.subscription_type || 'trial',
						card_number: userData.profile?.card_number || '',
						card_holder: userData.profile?.card_holder || '',
						card_expiry: userData.profile?.card_expiry || '',
						card_cvv: userData.profile?.card_cvv || '',
						chat_notifications: userData.profile?.chat_notifications ?? true,
						new_models_notifications:
							userData.profile?.new_models_notifications ?? false,
					},
				})
			} catch (error) {
				// Если пользователь не авторизован, показываем профиль пустым
				setUser(null)
			} finally {
				setLoading(false)
			}
		}

		fetchUser()
	}, [router])

	// Обновляем форму при изменении пользователя
	useEffect(() => {
		if (user) {
			setFormData({
				email: user.email || '',
				first_name: user.first_name || '',
				last_name: user.last_name || '',
				username: user.username || '',
				profile: {
					subscription_type: user.profile?.subscription_type || 'trial',
					card_number: user.profile?.card_number || '',
					card_holder: user.profile?.card_holder || '',
					card_expiry: user.profile?.card_expiry || '',
					card_cvv: user.profile?.card_cvv || '',
					chat_notifications: user.profile?.chat_notifications ?? true,
					new_models_notifications:
						user.profile?.new_models_notifications ?? false,
				},
			})
		}
	}, [user])

	const handleSave = async () => {
		if (!user) return

		// Проверяем, заполнены ли данные карты (если хотя бы одно поле заполнено, проверяем все)
		const hasAnyCardData =
			formData.profile.card_number.trim() ||
			formData.profile.card_holder.trim() ||
			formData.profile.card_expiry.trim() ||
			formData.profile.card_cvv.trim()

		if (hasAnyCardData) {
			// Если хотя бы одно поле карты заполнено, проверяем все поля
			const cardErrors = validateCardData({
				card_number: formData.profile.card_number,
				card_holder: formData.profile.card_holder,
				card_expiry: formData.profile.card_expiry,
				card_cvv: formData.profile.card_cvv,
			})

			if (cardErrors) {
				// Показываем первую ошибку
				const firstError = Object.values(cardErrors)[0]
				alert(firstError)
				return
			}
		}

		try {
			const updatedUser = await authService.updateUser(formData)
			setUser(updatedUser)
			setEditing(false)
			alert('Данные успешно сохранены')
		} catch (error: any) {
			console.error('Ошибка при сохранении:', error)
			const errorMessage =
				error.response?.data?.detail ||
				error.response?.data?.message ||
				'Ошибка при сохранении данных'
			alert(errorMessage)
		}
	}

	const handleCancel = () => {
		// Восстанавливаем исходные данные пользователя
		if (user) {
			setFormData({
				email: user.email || '',
				first_name: user.first_name || '',
				last_name: user.last_name || '',
				username: user.username || '',
				profile: {
					subscription_type: user.profile?.subscription_type || 'trial',
					card_number: user.profile?.card_number || '',
					card_holder: user.profile?.card_holder || '',
					card_expiry: user.profile?.card_expiry || '',
					card_cvv: user.profile?.card_cvv || '',
					chat_notifications: user.profile?.chat_notifications ?? true,
					new_models_notifications:
						user.profile?.new_models_notifications ?? false,
				},
			})
		}
		setEditing(false)
	}

	const handleLogout = async () => {
		try {
			await authService.logout()
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
			router.push('/')
		} catch (error) {
			console.error('Ошибка при выходе:', error)
		}
	}

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

	if (!user) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='bg-white rounded-xl p-8 shadow-card text-center'>
						<h2 className='text-2xl font-bold text-black mb-4'>
							Вы не авторизованы
						</h2>
						<p className='text-gray mb-6'>
							Войдите в систему, чтобы просмотреть свой профиль
						</p>
					</div>
				</main>
				<Footer />
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'>
				<div className='grid grid-cols-1 lg:grid-cols-11 gap-4 sm:gap-6'>
					{/* Левая колонка - Навигация */}
					<div className='lg:col-span-3'>
						<div className='bg-white rounded-xl p-4 sm:p-6 shadow-card'>
							<div className='grid grid-cols-2 lg:grid-cols-1 gap-2 lg:space-y-2'>
								<div
									className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg cursor-pointer ${
										activeTab === 'profile'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('profile')}
								>
									<Image
										src='/img/profile_left.svg'
										alt='Profile'
										width={20}
										height={20}
										className='w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
									/>
									<span className='font-medium whitespace-nowrap text-xs sm:text-sm'>
										Профиль
									</span>
								</div>

								<div
									className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg cursor-pointer overflow-hidden ${
										activeTab === 'subscription'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('subscription')}
								>
									<Image
										src='/img/fi-rr-diamond.svg'
										alt='Subscription'
										width={20}
										height={20}
										className='w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
									/>
									<span className='text-xs sm:text-sm whitespace-nowrap'>
										Управление подпиской
									</span>
								</div>

								<div
									className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg cursor-pointer ${
										activeTab === 'downloads'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('downloads')}
								>
									<Image
										src='/img/fi-rr-folder.svg'
										alt='Downloads'
										width={20}
										height={20}
										className='w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
									/>
									<span className='whitespace-nowrap text-xs sm:text-sm'>
										История загрузок
									</span>
								</div>

								<div
									className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg cursor-pointer overflow-hidden ${
										activeTab === 'cart'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('cart')}
								>
									<Image
										src='/img/Buy.svg'
										alt='Cart'
										width={20}
										height={20}
										className='w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
									/>
									<span className='text-xs sm:text-sm whitespace-nowrap'>
										Корзина / проекты
									</span>
								</div>

								<div
									className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg cursor-pointer ${
										activeTab === 'chats'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('chats')}
								>
									<Image
										src='/img/fi-rr-comment.svg'
										alt='Chats'
										width={20}
										height={20}
										className='w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
									/>
									<span className='whitespace-nowrap text-xs sm:text-sm'>Чаты</span>
								</div>

								{/* Logout Button */}
							</div>
						</div>
					</div>

					{/* Правая колонка - Контент */}
					<div className='lg:col-span-8'>
						{activeTab === 'profile' && (
							<div className='bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-card min-h-[400px] sm:min-h-[600px]'>
								<div className='flex items-start justify-between mb-4 sm:mb-6 lg:mb-8'>
									<h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-black'>Профиль</h1>
								</div>

								<div className='flex flex-col sm:flex-row items-start gap-4 sm:gap-6 lg:gap-8'>
									{/* Левая часть - Форма */}
									<div className='flex-1 w-full'>
										<div className='space-y-6 sm:space-y-8 lg:space-y-10'>
											{/* Email */}
											<div>
												<label className='block text-sm font-medium text-gray mb-2'>
													E-mail
												</label>
												<input
													type='email'
													value={formData.email}
													onChange={e =>
														setFormData({ ...formData, email: e.target.value })
													}
													disabled={!editing}
													className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
													placeholder='Введите e-mail'
												/>
											</div>

											{/* Password */}
											<div>
												<label className='block text-sm font-medium text-gray mb-2'>
													Пароль
												</label>
												<input
													type='password'
													value='••••••••'
													disabled={!editing}
													className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
													placeholder='Введите пароль'
												/>
											</div>

											{/* Payment Method */}
											<div>
												<h3 className='text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4'>
													Способ оплаты:
												</h3>
												<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
													<div>
														<label className='block text-sm font-medium text-gray mb-2'>
															Номер карты
														</label>
														<input
															type='text'
															value={formData.profile.card_number}
															onChange={e => {
																const formatted = formatCardNumber(
																	e.target.value
																)
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		card_number: formatted,
																	},
																})
															}}
															disabled={!editing}
															maxLength={19}
															className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
															placeholder='XXXX - XXXX - XXXX - XXXX'
														/>
													</div>
													<div>
														<label className='block text-sm font-medium text-gray mb-2'>
															Держатель карты
														</label>
														<input
															type='text'
															value={formData.profile.card_holder}
															onChange={e => {
																const formatted = formatCardHolder(
																	e.target.value
																)
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		card_holder: formatted,
																	},
																})
															}}
															disabled={!editing}
															className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
															placeholder='Фамилия и Имя'
														/>
													</div>
													<div>
														<label className='block text-sm font-medium text-gray mb-2'>
															Месяц/год
														</label>
														<input
															type='text'
															value={formData.profile.card_expiry}
															onChange={e => {
																const formatted = formatCardExpiry(
																	e.target.value
																)
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		card_expiry: formatted,
																	},
																})
															}}
															disabled={!editing}
															maxLength={5}
															className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
															placeholder='00 / 00'
														/>
													</div>
													<div>
														<label className='block text-sm font-medium text-gray mb-2'>
															Код
														</label>
														<input
															type='text'
															value={formData.profile.card_cvv}
															onChange={e => {
																const formatted = formatCardCVV(e.target.value)
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		card_cvv: formatted,
																	},
																})
															}}
															disabled={!editing}
															maxLength={4}
															className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
															placeholder='***'
														/>
													</div>
												</div>
											</div>

											{/* Settings */}
											<div>
												<h3 className='text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4'>
													Настройки
												</h3>
												<div className='space-y-3'>
													<label className='flex items-center space-x-3 cursor-pointer'>
														<input
															type='checkbox'
															checked={formData.profile.chat_notifications}
															onChange={e =>
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		chat_notifications: e.target.checked,
																	},
																})
															}
															disabled={!editing}
															className='w-4 h-4 text-main1 focus:ring-main1 border-gray2 rounded disabled:opacity-50'
														/>
														<span className='text-black text-sm'>
															Уведомления о сообщениях в чате
														</span>
													</label>
													<label className='flex items-center space-x-3 cursor-pointer'>
														<input
															type='checkbox'
															checked={
																formData.profile.new_models_notifications
															}
															onChange={e =>
																setFormData({
																	...formData,
																	profile: {
																		...formData.profile,
																		new_models_notifications: e.target.checked,
																	},
																})
															}
															disabled={!editing}
															className='w-4 h-4 text-main1 focus:ring-main1 border-gray2 rounded disabled:opacity-50'
														/>
														<span className='text-black text-sm'>
															Получать уведомления о новых моделях
														</span>
													</label>
												</div>
											</div>

											{/* Action Buttons */}
											<div className='pt-2 sm:pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:space-x-3'>
												{editing && (
													<button
														onClick={handleCancel}
														className='px-4 py-2 border border-main1 text-main1 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm w-full sm:w-auto'
													>
														Отменить
													</button>
												)}
												<button
													onClick={() => {
														if (editing) {
															handleSave()
														} else {
															setEditing(true)
														}
													}}
													className='btn-primary px-4 py-2 text-sm w-full sm:w-auto'
												>
													{editing
														? 'Сохранить изменения'
														: 'Редактировать профиль'}
												</button>
											</div>
										</div>
									</div>

									{/* Правая часть - Аватар */}
									<div className='flex-shrink-0 mx-auto sm:mx-0'>
										<div className='w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 bg-gray-bg rounded-full flex items-center justify-center relative overflow-hidden'>
											<Image
												src='/img/profile_default.svg'
												alt='Profile Avatar'
												width={160}
												height={160}
												className='w-full h-full object-cover'
											/>
										</div>
									</div>
								</div>
							</div>
						)}

						{activeTab === 'subscription' && <SubscriptionManagement />}

						{activeTab === 'downloads' && (
							<div className='bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-card min-h-[400px] sm:min-h-[600px]'>
								<DownloadsList />
							</div>
						)}

						{activeTab === 'cart' && (
							<div className='bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-card min-h-[400px] sm:min-h-[600px]'>
								<BasketsList baskets={baskets} onRefresh={refetchBaskets} />
							</div>
						)}

						{activeTab === 'chats' && (
							<div className='bg-white rounded-xl shadow-card min-h-[400px] sm:min-h-[600px] flex flex-col'>
								{selectedChat ? (
									<div className='flex-1 flex flex-col'>
										<ChatDetail
											chat={selectedChat}
											onBack={() => setSelectedChat(null)}
											currentUserId={user?.id || 0}
										/>
									</div>
								) : (
									<div className='flex-1 p-4 sm:p-6 lg:p-8'>
										<h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-4 sm:mb-6 lg:mb-8'>Чаты</h1>
										<ChatsList
											onSelectChat={handleSelectChat}
											selectedChatId={undefined}
										/>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</main>

			<Footer />
		</div>
	)
}
