'use client'

import Footer from '@/components/Footer'
import Header from '@/components/Header'
import SubscriptionManagement from '@/components/SubscriptionManagement'
import { authService } from '@/services/api'
import { User } from '@/types'
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

	useEffect(() => {
		const fetchUser = async () => {
			try {
				const userData = await authService.getCurrentUser()
				setUser(userData)
			} catch (error) {
				// Если пользователь не авторизован, перенаправляем на страницу входа
				router.push('/login')
			} finally {
				setLoading(false)
			}
		}

		fetchUser()
	}, [router])

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
		return null
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				<div className='grid grid-cols-1 lg:grid-cols-11 gap-6'>
					{/* Левая колонка - Навигация */}
					<div className='lg:col-span-3'>
						<div className='bg-white rounded-xl p-6 shadow-card'>
							<div className='space-y-2'>
								<div
									className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${
										activeTab === 'profile'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('profile')}
								>
									<Image
										src='/img/profile_left.svg'
										alt='Profile'
										width={24}
										height={24}
										className='w-6 h-6'
									/>
									<span className='font-medium whitespace-nowrap text-sm'>
										Профиль
									</span>
								</div>

								<div
									className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer overflow-hidden ${
										activeTab === 'subscription'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('subscription')}
								>
									<Image
										src='/img/fi-rr-diamond.svg'
										alt='Subscription'
										width={24}
										height={24}
										className='w-6 h-6 flex-shrink-0'
									/>
									<span className='text-sm whitespace-nowrap'>
										Управление подпиской
									</span>
								</div>

								<div
									className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${
										activeTab === 'downloads'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('downloads')}
								>
									<Image
										src='/img/fi-rr-folder.svg'
										alt='Downloads'
										width={24}
										height={24}
										className='w-6 h-6'
									/>
									<span className='whitespace-nowrap text-sm'>
										История загрузок
									</span>
								</div>

								<div
									className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer overflow-hidden ${
										activeTab === 'cart'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('cart')}
								>
									<Image
										src='/img/Buy.svg'
										alt='Cart'
										width={24}
										height={24}
										className='w-6 h-6 flex-shrink-0'
									/>
									<span className='text-sm whitespace-nowrap'>
										Корзина / проекты
									</span>
								</div>

								<div
									className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${
										activeTab === 'chats'
											? 'bg-main1 text-white'
											: 'text-gray hover:bg-gray-bg'
									}`}
									onClick={() => setActiveTab('chats')}
								>
									<Image
										src='/img/fi-rr-comment.svg'
										alt='Chats'
										width={24}
										height={24}
										className='w-6 h-6'
									/>
									<span className='whitespace-nowrap text-sm'>Чаты</span>
								</div>

								{/* Logout Button */}
							</div>
						</div>
					</div>

					{/* Правая колонка - Контент */}
					<div className='lg:col-span-8'>
						{activeTab === 'profile' && (
							<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
								<div className='flex items-start justify-between mb-8'>
									<h1 className='text-3xl font-bold text-black'>Профиль</h1>
								</div>

								<div className='flex items-start gap-8'>
									{/* Левая часть - Форма */}
									<div className='flex-1'>
										<div className='space-y-10'>
											{/* Email */}
											<div>
												<label className='block text-sm font-medium text-gray mb-2'>
													E-mail
												</label>
												<input
													type='email'
													value={user.email}
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
												<h3 className='text-lg font-semibold text-black mb-4'>
													Способ оплаты:
												</h3>
												<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
													<div>
														<label className='block text-sm font-medium text-gray mb-2'>
															Номер карты
														</label>
														<input
															type='text'
															disabled={!editing}
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
															disabled={!editing}
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
															disabled={!editing}
															className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent disabled:bg-gray-100'
															placeholder='***'
														/>
													</div>
												</div>
											</div>

											{/* Settings */}
											<div>
												<h3 className='text-lg font-semibold text-black mb-4'>
													Настройки
												</h3>
												<div className='space-y-3'>
													<label className='flex items-center space-x-3 cursor-pointer'>
														<input
															type='checkbox'
															defaultChecked
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
															defaultChecked={false}
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
											<div className='pt-4 flex space-x-3'>
												<button
													onClick={() => setEditing(false)}
													className='px-4 py-2 border border-main1 text-main1 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm'
												>
													Отменить
												</button>
												<button
													onClick={() => setEditing(!editing)}
													className='btn-primary px-4 py-2 text-sm'
												>
													{editing
														? 'Сохранить изменения'
														: 'Редактировать профиль'}
												</button>
											</div>
										</div>
									</div>

									{/* Правая часть - Аватар */}
									<div className='flex-shrink-0'>
										<div className='w-40 h-40 bg-gray-bg rounded-full flex items-center justify-center relative overflow-hidden'>
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
							<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
								<h1 className='text-3xl font-bold text-black mb-8'>
									История загрузок
								</h1>
								<p className='text-gray'>Здесь будет история загрузок...</p>
							</div>
						)}

						{activeTab === 'cart' && (
							<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
								<h1 className='text-3xl font-bold text-black mb-8'>
									Корзина / проекты
								</h1>
								<p className='text-gray'>Здесь будет корзина и проекты...</p>
							</div>
						)}

						{activeTab === 'chats' && (
							<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
								<h1 className='text-3xl font-bold text-black mb-8'>Чаты</h1>
								<p className='text-gray'>Здесь будут чаты...</p>
							</div>
						)}
					</div>
				</div>
			</main>

			<Footer />
		</div>
	)
}
