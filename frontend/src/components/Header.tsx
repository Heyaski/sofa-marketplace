'use client'

import { MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { authService } from '../services/api'
import { User } from '../types'

export default function Header() {
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
	return (
		<header className='bg-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex items-center justify-between h-16'>
					{/* Logo */}
					<a
						href='/'
						className='flex items-center space-x-3 hover:opacity-80 transition-opacity'
					>
						<Image
							src='/img/logo.svg'
							alt='VizHub.art Logo'
							width={32}
							height={32}
							className='w-8 h-8'
						/>
						<span className='text-xl text-black'>VIZHUB.ART</span>
					</a>

					{/* Center navigation */}
					<div className='flex-1 flex items-center justify-center space-x-4'>
						{/* Catalog button */}
						<a
							href='/catalog'
							className='bg-main1 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-main2 transition-colors'
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
						<div className='relative'>
							<input
								type='text'
								placeholder='Поиск по сайту...'
								className='w-[40rem] px-4 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
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
							<div className='relative'>
								<a href='/profile' className='block'>
									<button className='w-10 h-10 bg-gray-bg rounded-lg flex items-center justify-center hover:bg-gray2 transition-colors'>
										<UserIcon className='w-5 h-5 text-gray' />
									</button>
								</a>
								<div className='absolute -top-1 -right-1 w-5 h-5 bg-main1 rounded-full flex items-center justify-center'>
									<span className='text-xs text-white font-medium'>10</span>
								</div>
							</div>
						) : (
							<div className='flex items-center space-x-2'>
								<a
									href='/login'
									className='text-main1 hover:text-main2 font-medium text-sm'
								>
									Войти
								</a>
								<span className='text-gray'>|</span>
								<a href='/register' className='btn-secondary text-sm px-4 py-2'>
									Регистрация
								</a>
							</div>
						)}
					</div>
				</div>
			</div>
		</header>
	)
}
