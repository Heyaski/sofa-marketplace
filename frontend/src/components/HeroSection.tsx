'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'
import PluginAccessBanner from './PluginAccessBanner'

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
							RevitBoost
						</h1>

						<p className='text-xl sm:text-2xl text-main1 font-semibold'>
							Мгновенная замена Revit-моделей на high-poly для фотореалистичного рендера
						</p>

						<div className='space-y-4 text-base sm:text-lg text-black leading-relaxed'>
							<p>
								Revit3dmaxBridge — это скрипт и библиотека Revit-моделей, которые позволяют за секунды превратить обычные низкополигональные семейства в высокодетализированные 3D-модели при экспорте или перетаскивании в 3ds Max.
							</p>
							<p>
								Работает с Corona, V-Ray, Enscape и другими рендерами.
								Экономьте часы на ручной замене геометрии и настройке — больше времени на творчество и красивые рендеры.
							</p>
							<ul className='list-disc list-inside space-y-1'>
								<li>Скрипт автоматической замены (настраивается под ваши high-poly файлы или облачные ссылки)</li>
								<li>Библиотека 4000+ авторских параметрических Revit-семейств в стилях сканди, лофт, минимализм, современная классика</li>
								<li>Полная сохранность параметризации Revit (размеры, материалы, типы)</li>
							</ul>
						</div>

						<PluginAccessBanner />

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
				{/* Дисклеймер */}
				<p className='mt-12 text-xs sm:text-sm text-gray max-w-3xl'>
					Все Revit-модели — оригинальные авторские разработки. High-poly модели подставляются из файлов или ссылок, которые указывает пользователь. Мы не предоставляем, не храним и не несём ответственности за происхождение high-poly контента. Пользователь самостоятельно отвечает за используемые 3D-файлы и их права.
				</p>
			</div>
		</section>
	)
}
