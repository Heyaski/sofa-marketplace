'use client'

import { ChatBubbleLeftRightIcon, UserIcon, ShoppingCartIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { authService } from '../services/api'
import { User } from '../types'
import AuthModal from './AuthModal'
import GlobalSearchBar from './GlobalSearchBar'

export default function Header() {
	const router = useRouter()
	const pathname = usePathname()
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

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

	useEffect(() => {
		checkAuth()
	}, [])

	// Обновление при авторизации (модалка, другие вкладки) — чтобы не требовалось перезагружать страницу
	useEffect(() => {
		const onAuthUpdated = () => checkAuth()
		window.addEventListener('auth-updated', onAuthUpdated)
		return () => window.removeEventListener('auth-updated', onAuthUpdated)
	}, [])

	const handleLogout = async () => {
		try {
			await authService.logout()
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
			setUser(null)
			router.push('/')
		} catch (error) {
			console.error('Ошибка при выходе:', error)
		}
	}

	const handleAuthSuccess = async () => {
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
			window.dispatchEvent(new Event('auth-updated'))
			if (pathname === '/') {
				router.push('/catalog')
			} else {
				router.refresh()
			}
		} catch (error) {
			setUser(null)
		}
	}
	return (
		<header className='bg-white sticky top-0 z-40 shadow-sm'>
			<div className='max-w-7xl mx-auto px-3 sm:px-6 lg:px-8'>
				{/* Mobile layout — компактно, всё влезает в строку */}
				<div className='flex lg:hidden items-center justify-between min-h-[48px] py-1.5 gap-1 min-w-0'>
					{/* Logo — без текста на узких экранах, с текстом VIZHUB на широких */}
					<a
						href='/'
						className='flex items-center flex-shrink-0 hover:opacity-80 transition-opacity'
					>
						<Image
							src='/img/logo.svg'
							alt='VizHub.pro'
							width={24}
							height={24}
							className='w-6 h-6'
						/>
						<span className='text-sm font-semibold text-black ml-1.5 truncate max-w-[80px]'>VIZHUB</span>
					</a>

					{/* Catalog — иконка + текст «Каталог» */}
					<a
						href='/catalog'
						className='flex-shrink-0 bg-main1 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-main2 transition-colors'
						aria-label='Каталог'
					>
						<Image
							src='/img/menu-burger.svg'
							alt=''
							width={14}
							height={14}
							className='w-3.5 h-3.5'
						/>
						<span className='text-xs font-medium whitespace-nowrap'>Каталог</span>
					</a>

					{/* Иконки справа — компактно, чат только для авторизованных */}
					<div className='flex items-center flex-shrink-0 gap-0.5'>
						{loading ? (
							<div className='animate-pulse bg-gray-bg rounded-lg w-9 h-9' />
						) : user ? (
							<>
								<a
									href='/profile?tab=chats'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Чаты'
									aria-label='Чаты'
								>
									<ChatBubbleLeftRightIcon className='w-5 h-5 text-gray' />
								</a>
								<a
									href='/profile?tab=cart'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Корзина'
									aria-label='Корзина'
								>
									<ShoppingCartIcon className='w-5 h-5 text-gray' />
								</a>
								<a
									href='/profile'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Профиль'
									aria-label='Профиль'
								>
									<UserIcon className='w-5 h-5 text-gray' />
								</a>
								<button
									onClick={handleLogout}
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors'
									title='Выйти'
									aria-label='Выйти'
								>
									<ArrowRightOnRectangleIcon className='w-5 h-5 text-gray' />
								</button>
							</>
						) : (
							<button
								onClick={() => setIsAuthModalOpen(true)}
								className='text-main1 hover:text-main2 font-medium text-xs px-2 py-2'
							>
								Войти
							</button>
						)}
					</div>
				</div>

				{/* Mobile search bar */}
				<div className='lg:hidden mb-2'>
					<Suspense fallback={<div className='h-10 bg-gray-bg rounded-lg animate-pulse' />}>
						<GlobalSearchBar mobile />
					</Suspense>
				</div>

				{/* Desktop layout */}
				<div className='hidden lg:flex items-center justify-between h-16'>
					{/* Logo */}
					<a
						href='/'
						className='flex items-center space-x-3 hover:opacity-80 transition-opacity'
					>
						<Image
							src='/img/logo.svg'
							alt='VizHub.pro Logo'
							width={32}
							height={32}
							className='w-8 h-8'
						/>
						<span className='text-xl text-black'>VIZHUB.PRO</span>
					</a>

					{/* Center navigation */}
					<div className='flex-1 flex items-center justify-center space-x-4 mx-8'>
						{/* Catalog button */}
						<a
							href='/catalog'
							className='bg-main1 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-main2 transition-colors flex-shrink-0'
						>
							<Image
								src='/img/menu-burger.svg'
								alt='Menu'
								width={16}
								height={16}
								className='w-4 h-4'
							/>
							<span className='text-sm font-medium'>Каталог</span>
						</a>

						{/* Search bar */}
						<div className='flex-1 max-w-2xl'>
							<Suspense fallback={<div className='h-10 bg-gray-bg rounded-lg animate-pulse' />}>
								<GlobalSearchBar />
							</Suspense>
						</div>
					</div>

					{/* Right side - Cart, Profile, Logout */}
					<div className='flex items-center gap-0.5'>
						{loading ? (
							<div className='animate-pulse bg-gray-bg rounded-lg w-9 h-9' />
						) : user ? (
							<>
								<a
									href='/profile?tab=chats'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Чаты'
									aria-label='Чаты'
								>
									<ChatBubbleLeftRightIcon className='w-5 h-5 text-gray' />
								</a>
								<a
									href='/profile?tab=cart'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Корзина'
									aria-label='Корзина'
								>
									<ShoppingCartIcon className='w-5 h-5 text-gray' />
								</a>
								<a
									href='/profile'
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
									title='Профиль'
									aria-label='Профиль'
								>
									<UserIcon className='w-5 h-5 text-gray' />
								</a>
								<button
									onClick={handleLogout}
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors'
									title='Выйти'
									aria-label='Выйти'
								>
									<ArrowRightOnRectangleIcon className='w-5 h-5 text-gray' />
								</button>
							</>
						) : (
							<button
								onClick={() => setIsAuthModalOpen(true)}
								className='text-main1 hover:text-main2 font-medium text-sm whitespace-nowrap'
							>
								Войти / Зарегистрироваться
							</button>
						)}
					</div>
				</div>
			</div>

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</header>
	)
}
