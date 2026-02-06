'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'

interface HeroSectionProps {
	onOpenAuth?: () => void
}

export default function HeroSection({ onOpenAuth }: HeroSectionProps) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const token = localStorage.getItem('access_token')
				if (token) {
					const user = await authService.getCurrentUser()
					setIsAuthenticated(!!user)
				} else {
					setIsAuthenticated(false)
				}
			} catch (error) {
				setIsAuthenticated(false)
			} finally {
				setLoading(false)
			}
		}

		checkAuth()

		// Слушаем изменения в localStorage для обновления состояния
		const handleStorageChange = () => {
			checkAuth()
		}

		// Слушаем кастомное событие обновления авторизации (отправляется из Header после успешной авторизации)
		const handleAuthUpdate = () => {
			checkAuth()
		}

		window.addEventListener('storage', handleStorageChange)
		window.addEventListener('auth-updated', handleAuthUpdate)
		
		// Также проверяем при фокусе окна (на случай авторизации в другой вкладке)
		window.addEventListener('focus', checkAuth)

		return () => {
			window.removeEventListener('storage', handleStorageChange)
			window.removeEventListener('auth-updated', handleAuthUpdate)
			window.removeEventListener('focus', checkAuth)
		}
	}, [])

	return (
		<section className='bg-white py-8 sm:py-12 lg:py-24'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-16 items-center'>
					{/* Left content */}
					<div className='space-y-4 sm:space-y-6 lg:space-y-8 max-w-lg'>
						<h1 className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-black leading-tight'>
							Реалистичная мебель в 3D — для интерьеров, которые хочется трогать
						</h1>

						<p className='text-base sm:text-lg text-black leading-relaxed'>
							Готовые модели реальной мебели для быстрого и эффектного
							проектирования интерьеров. Точность, стиль и готовность к рендеру
							— сразу после загрузки.
						</p>

						{!loading && !isAuthenticated && (
							<div className='pt-2 sm:pt-4'>
								<button
									onClick={onOpenAuth}
									className='bg-main1 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-main2 transition-colors w-full sm:w-auto'
								>
									Зарегистрироваться бесплатно
								</button>
							</div>
						)}
					</div>

					{/* Right image - 3D Sofa */}
					<div className='relative order-first lg:order-last'>
						<Image
							src='/img/hero-image.jpg'
							alt='3D модель современного дивана с разрезом'
							width={1200}
							height={900}
							className='w-full h-auto object-cover lg:scale-125'
							priority
						/>
					</div>
				</div>
			</div>
		</section>
	)
}
