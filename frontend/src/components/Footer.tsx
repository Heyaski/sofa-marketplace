'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'
import { User } from '../types'

export default function Footer() {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const userData = await authService.getCurrentUser()
				setUser(userData)
			} catch (error) {
				setUser(null)
			} finally {
				setLoading(false)
			}
		}

		checkAuth()
	}, [])
	return (
		<footer className='bg-main1 text-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
				{/* Top section - all in one line */}
				<div className='flex flex-col lg:flex-row justify-between items-center gap-6 mb-8'>
					{/* Logo and company name with white background */}
					<div className='bg-white rounded-lg p-3 flex items-center space-x-3'>
						<Image
							src='/img/logo.svg'
							alt='VizHub.art Logo'
							width={32}
							height={32}
							className='w-8 h-8'
						/>
						<span className='text-xl font-medium text-black'>VIZHUB.ART</span>
					</div>

					{/* Links */}
					<div className='flex flex-col sm:flex-row gap-4 sm:gap-8'>
						<a
							href='#'
							className='text-sm hover:text-gray-200 transition-colors'
						>
							Условия предоставления услуг
						</a>
						<a
							href='#'
							className='text-sm hover:text-gray-200 transition-colors'
						>
							Политика Конфиденциальности
						</a>
					</div>

					{/* Login/Register Button - только для неавторизованных */}
					{!loading && !user && (
						<button
							onClick={() => (window.location.href = '/')}
							className='bg-white text-main1 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors'
						>
							Войти / Зарегестрироваться
						</button>
					)}
				</div>

				{/* Divider */}
				<div className='border-t border-main2 pt-8'>
					<div className='flex flex-col sm:flex-row justify-between items-center gap-4'>
						{/* Rights and Cookies - Left */}
						<div className='flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-200'>
							<span>2025 © Все права защищены</span>
							<span>Настройка файлов cookie</span>
						</div>

						{/* Social Media Icons - Right */}
						<div className='flex space-x-4'>
							{/* Instagram */}
							<a
								href='#'
								className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
							>
								<Image
									src='/img/inst.svg'
									alt='Instagram'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							{/* WhatsApp */}
							<a
								href='#'
								className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
							>
								<Image
									src='/img/whatsapp.svg'
									alt='WhatsApp'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							{/* YouTube */}
							<a
								href='#'
								className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
							>
								<Image
									src='/img/youtube.svg'
									alt='YouTube'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							{/* Telegram */}
							<a
								href='#'
								className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
							>
								<Image
									src='/img/telegram.svg'
									alt='Telegram'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	)
}
