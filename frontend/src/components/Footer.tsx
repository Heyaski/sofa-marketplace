'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'
import { User } from '../types'
import AuthModal from './AuthModal'

export default function Footer() {
	const router = useRouter()
	const pathname = usePathname()
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	const checkAuth = async () => {
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
		} catch {
			setUser(null)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		checkAuth()
		const onAuthUpdated = () => checkAuth()
		window.addEventListener('auth-updated', onAuthUpdated)
		return () => window.removeEventListener('auth-updated', onAuthUpdated)
	}, [])

	const handleAuthSuccess = () => {
		setIsAuthModalOpen(false)
		window.dispatchEvent(new Event('auth-updated'))
		if (pathname === '/') {
			router.push('/catalog')
		} else {
			router.refresh()
		}
	}
	return (
		<footer className='bg-main1 text-white mt-auto'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12'>
				{/* Top section */}
				<div className='flex flex-col lg:flex-row justify-between items-center gap-4 sm:gap-6 mb-6 sm:mb-8 text-center lg:text-left'>
					{/* Logo and company name with white background */}
					<div className='bg-white rounded-lg p-3 flex items-center space-x-3'>
						<Image
							src='/img/logo.svg'
							alt='VizHub.pro Logo'
							width={32}
							height={32}
							className='w-8 h-8'
						/>
						<span className='text-xl font-medium text-black'>VIZHUB.PRO</span>
					</div>

					{/* Links */}
					<div className='flex flex-col sm:flex-row gap-4 sm:gap-8'>
						<a
							href='/offer'
							className='text-sm hover:text-gray-200 transition-colors'
						>
							Договор-оферта
						</a>
						<a
							href='/privacy'
							className='text-sm hover:text-gray-200 transition-colors'
						>
							Политика Конфиденциальности
						</a>
					</div>

					{/* Login/Register Button - только для неавторизованных */}
					{!loading && !user && (
						<button
							onClick={() => setIsAuthModalOpen(true)}
							className='bg-white text-main1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm sm:text-base w-full sm:w-auto'
						>
							Войти / Зарегистрироваться
						</button>
					)}
				</div>

				{/* Divider */}
				<div className='border-t border-main2 pt-6 sm:pt-8'>
					<div className='flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4'>
						{/* Rights and Cookies - Left */}
						<div className='flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-200'>
							<span>2025 © Все права защищены</span>
							<span>Настройка файлов cookie</span>
						</div>

						{/* Social Media Icons */}
						<div className='flex flex-wrap justify-center lg:justify-end gap-3 sm:gap-4'>
							<a
								href='#'
								className='w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform min-w-[44px] min-h-[44px]'
								aria-label='Instagram'
							>
								<Image
									src='/img/inst.svg'
									alt='Instagram'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							<a
								href='#'
								className='w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform min-w-[44px] min-h-[44px]'
								aria-label='WhatsApp'
							>
								<Image
									src='/img/whatsapp.svg'
									alt='WhatsApp'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							<a
								href='#'
								className='w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform min-w-[44px] min-h-[44px]'
								aria-label='YouTube'
							>
								<Image
									src='/img/youtube.svg'
									alt='YouTube'
									width={40}
									height={40}
									className='w-full h-full'
								/>
							</a>
							<a
								href='#'
								className='w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform min-w-[44px] min-h-[44px]'
								aria-label='Telegram'
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

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</footer>
	)
}
