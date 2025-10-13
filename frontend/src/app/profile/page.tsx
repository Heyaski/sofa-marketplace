'use client'

import ProfileSidebar from '@/components/ProfileSidebar'
import Image from 'next/image'
import { useState } from 'react'

export default function ProfilePage() {
	const [activeTab, setActiveTab] = useState('profile')
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		cardNumber: 'XXXX-XXXX-XXXX-XXXX',
		cardholder: '',
		expiryDate: '',
		cvv: '',
		chatNotifications: true,
		newModelsNotifications: false,
	})

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		console.log('Profile updated:', formData)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			{/* Header */}
			<header className='bg-white'>
				<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
					<div className='flex items-center justify-between h-16'>
						{/* Logo */}
						<div className='flex items-center space-x-3'>
							<Image
								src='/img/logo.svg'
								alt='VizHub.art Logo'
								width={32}
								height={32}
								className='w-8 h-8'
							/>
							<span className='text-xl text-black font-medium'>VIZHUB.ART</span>
						</div>

						{/* Center navigation */}
						<div className='flex-1 flex items-center justify-center space-x-4'>
							{/* Catalog button */}
							<button className='bg-main1 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-main2 transition-colors'>
								<Image
									src='/img/menu-burger.svg'
									alt='Menu'
									width={16}
									height={16}
									className='w-4 h-4'
								/>
								<span className='text-sm font-medium'>Каталог</span>
							</button>

							{/* Search bar */}
							<div className='relative'>
								<input
									type='text'
									placeholder='Поиск по сайту...'
									className='w-[40rem] px-4 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								/>
								<button className='absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-main1 rounded-full flex items-center justify-center hover:bg-main2 transition-colors'>
									<svg
										className='w-4 h-4 text-white'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
										/>
									</svg>
								</button>
							</div>
						</div>

						{/* Right side - User section */}
						<div className='flex items-center space-x-3'>
							<div className='relative'>
								<div className='w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden'>
									<Image
										src='/img/profile.svg'
										alt='Profile'
										width={40}
										height={40}
										className='w-full h-full object-cover'
									/>
								</div>
								<div className='absolute -top-1 -right-1 w-5 h-5 bg-main1 rounded-full flex items-center justify-center'>
									<span className='text-xs text-white font-medium'>10</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				<div className='flex space-x-8'>
					{/* Sidebar */}
					<ProfileSidebar activeTab={activeTab} onTabChange={setActiveTab} />

					{/* Profile content */}
					<div className='flex-1 bg-white rounded-xl shadow-card p-8'>
						<h1 className='text-2xl font-bold text-gray-700 mb-8'>Профиль</h1>

						<form onSubmit={handleSubmit} className='space-y-8'>
							{/* Profile Information */}
							<div className='space-y-6'>
								<div className='flex items-start space-x-8'>
									<div className='flex-1 space-y-3'>
										{/* Email */}
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												E-mail
											</label>
											<input
												type='email'
												value={formData.email}
												onChange={e =>
													handleInputChange('email', e.target.value)
												}
												placeholder='Введите e-mail'
												className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
											/>
										</div>

										{/* Password */}
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												Пароль
											</label>
											<input
												type='password'
												value={formData.password}
												onChange={e =>
													handleInputChange('password', e.target.value)
												}
												placeholder='Введите пароль'
												className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
											/>
										</div>
									</div>

									{/* Profile Picture */}
									<div className='flex-shrink-0'>
										<div className='w-40 h-40 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden'>
											<Image
												src='/img/profile.svg'
												alt='Profile'
												width={160}
												height={160}
												className='w-full h-full object-cover'
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Payment Method */}
							<div className='space-y-6'>
								<h2 className='text-lg font-bold text-gray-700'>
									Способ оплаты
								</h2>

								<div className='grid grid-cols-2 gap-4'>
									{/* Card Number */}
									<div className='col-span-2'>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Номер карты
										</label>
										<input
											type='text'
											value={formData.cardNumber}
											onChange={e =>
												handleInputChange('cardNumber', e.target.value)
											}
											placeholder='XXXX-XXXX-XXXX-XXXX'
											className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										/>
									</div>

									{/* Cardholder */}
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Держатель карты
										</label>
										<input
											type='text'
											value={formData.cardholder}
											onChange={e =>
												handleInputChange('cardholder', e.target.value)
											}
											placeholder='Фамилия и Имя'
											className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										/>
									</div>

									{/* Expiry Date */}
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Месяц/год
										</label>
										<input
											type='text'
											value={formData.expiryDate}
											onChange={e =>
												handleInputChange('expiryDate', e.target.value)
											}
											placeholder='00/00'
											className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										/>
									</div>

									{/* CVV */}
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Код
										</label>
										<input
											type='text'
											value={formData.cvv}
											onChange={e => handleInputChange('cvv', e.target.value)}
											placeholder='***'
											className='w-full px-3 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										/>
									</div>
								</div>
							</div>

							{/* Settings */}
							<div className='space-y-6'>
								<h2 className='text-lg font-bold text-gray-700'>Настройки</h2>

								<div className='space-y-4'>
									{/* Chat Notifications */}
									<div className='flex items-center space-x-3'>
										<input
											type='checkbox'
											id='chatNotifications'
											checked={formData.chatNotifications}
											onChange={e =>
												handleInputChange('chatNotifications', e.target.checked)
											}
											className='w-5 h-5 text-main1 bg-gray-bg border-gray2 rounded focus:ring-main1 focus:ring-2'
										/>
										<label
											htmlFor='chatNotifications'
											className='text-sm font-medium text-gray-700'
										>
											Уведомления о сообщениях в чате
										</label>
									</div>

									{/* New Models Notifications */}
									<div className='flex items-center space-x-3'>
										<input
											type='checkbox'
											id='newModelsNotifications'
											checked={formData.newModelsNotifications}
											onChange={e =>
												handleInputChange(
													'newModelsNotifications',
													e.target.checked
												)
											}
											className='w-5 h-5 text-main1 bg-gray-bg border-gray2 rounded focus:ring-main1 focus:ring-2'
										/>
										<label
											htmlFor='newModelsNotifications'
											className='text-sm font-medium text-gray-700'
										>
											Получать уведомления о новых моделях
										</label>
									</div>
								</div>
							</div>

							{/* Submit Button */}
							<div className='pt-6'>
								<button
									type='submit'
									className='bg-main1 text-white px-8 py-3 rounded-lg font-medium hover:bg-main2 transition-colors'
								>
									Редактировать профиль
								</button>
							</div>
						</form>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className='bg-main1 h-4 mt-8'></footer>
		</div>
	)
}
