'use client'

import { MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'
import { User } from '../types'
import AuthModal from './AuthModal'

export default function Header() {
	const router = useRouter()
	const pathname = usePathname()
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [showUserMenu, setShowUserMenu] = useState(false)

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

	// Закрытие меню при клике вне его
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				showUserMenu &&
				!(event.target as Element).closest('.user-menu-container')
			) {
				setShowUserMenu(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [showUserMenu])

	const handleLogout = async () => {
		try {
			await authService.logout()
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
			setUser(null)
		} catch (error) {
			console.error('Ошибка при выходе:', error)
		}
	}

	const handleAuthSuccess = async () => {
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
			// Если находимся на главной странице, перенаправляем в каталог
			if (pathname === '/') {
				router.push('/catalog')
			}
		} catch (error) {
			setUser(null)
		}
	}
	return (
		<header className='bg-white sticky top-0 z-40 shadow-sm'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				{/* Mobile layout */}
				<div className='flex lg:hidden items-center justify-between h-14 py-2'>
					{/* Logo */}
					<a
						href='/'
						className='flex items-center space-x-2 hover:opacity-80 transition-opacity'
					>
						<Image
							src='/img/logo.svg'
							alt='VizHub.pro Logo'
							width={24}
							height={24}
							className='w-6 h-6'
						/>
						<span className='text-base font-semibold text-black'>VIZHUB.PRO</span>
					</a>

					{/* Mobile actions */}
					<div className='flex items-center space-x-2'>
						{/* Catalog button */}
						<a
							href='/catalog'
							className='bg-main1 text-white px-3 py-1.5 rounded-lg flex items-center space-x-1.5 hover:bg-main2 transition-colors flex-shrink-0'
						>
							<Image
								src='/img/menu-burger.svg'
								alt='Menu'
								width={14}
								height={14}
								className='w-3.5 h-3.5'
							/>
							<span className='text-xs font-medium'>Каталог</span>
						</a>

						{/* Search icon button */}
						<button
							onClick={() => {
								// TODO: Open mobile search modal
								const searchInput = document.querySelector('.mobile-search-input') as HTMLInputElement
								if (searchInput) {
									searchInput.focus()
								}
							}}
							className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
						>
							<MagnifyingGlassIcon className='w-5 h-5 text-gray' />
						</button>

						{/* User menu */}
						{loading ? (
							<div className='animate-pulse bg-gray-bg rounded-lg w-9 h-9'></div>
						) : user ? (
							<div className='relative user-menu-container'>
								<button
									onClick={() => setShowUserMenu(!showUserMenu)}
									className='w-9 h-9 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
								>
									<UserIcon className='w-5 h-5 text-gray' />
								</button>
								{showUserMenu && (
									<div className='absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray2 py-2 z-50'>
										<a
											href='/profile'
											className='block px-4 py-2 text-sm text-black hover:bg-gray-bg'
											onClick={() => setShowUserMenu(false)}
										>
											Профиль
										</a>
										<button
											onClick={handleLogout}
											className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-bg'
										>
											Выйти
										</button>
									</div>
								)}
							</div>
						) : (
							<button
								onClick={() => setIsAuthModalOpen(true)}
								className='text-main1 hover:text-main2 font-medium text-xs px-2'
							>
								Войти
							</button>
						)}
					</div>
				</div>

				{/* Mobile search bar (hidden by default, shown when needed) */}
				<div className='lg:hidden mb-2'>
					<div className='relative'>
						<input
							type='text'
							placeholder='Поиск по сайту...'
							className='mobile-search-input w-full px-4 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent text-sm'
						/>
						<button className='absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-main1 rounded-full flex items-center justify-center hover:bg-main2 transition-colors'>
							<MagnifyingGlassIcon className='w-4 h-4 text-white' />
						</button>
					</div>
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
						<div className='relative flex-1 max-w-2xl'>
							<input
								type='text'
								placeholder='Поиск по сайту...'
								className='w-full px-4 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
							/>
							<button className='absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-main1 rounded-full flex items-center justify-center hover:bg-main2 transition-colors'>
								<MagnifyingGlassIcon className='w-4 h-4 text-white' />
							</button>
						</div>
					</div>

					{/* Right side - User section */}
					<div className='flex items-center space-x-3'>
						{loading ? (
							<div className='animate-pulse bg-gray-bg rounded-lg w-10 h-10'></div>
						) : user ? (
							<div className='relative user-menu-container'>
								<button
									onClick={() => setShowUserMenu(!showUserMenu)}
									className='w-10 h-10 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'
								>
									<UserIcon className='w-5 h-5 text-gray' />
								</button>
								<div className='absolute -top-1 -right-1 w-5 h-5 bg-main1 rounded-full flex items-center justify-center'>
									<span className='text-xs text-white font-medium'>10</span>
								</div>

								{/* Dropdown menu */}
								{showUserMenu && (
									<div className='absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray2 py-2 z-50'>
										<a
											href='/profile'
											className='block px-4 py-2 text-sm text-black hover:bg-gray-bg'
											onClick={() => setShowUserMenu(false)}
										>
											Профиль
										</a>
										<button
											onClick={handleLogout}
											className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-bg'
										>
											Выйти
										</button>
									</div>
								)}
							</div>
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
