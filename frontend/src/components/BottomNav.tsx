'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	Squares2X2Icon,
	HeartIcon,
	ShoppingBagIcon,
	UserIcon,
} from '@heroicons/react/24/outline'
import {
	Squares2X2Icon as Squares2X2IconSolid,
	HeartIcon as HeartIconSolid,
	ShoppingBagIcon as ShoppingBagIconSolid,
	UserIcon as UserIconSolid,
} from '@heroicons/react/24/solid'

export default function BottomNav() {
	const pathname = usePathname()
	const isCatalog = pathname === '/catalog' || pathname?.startsWith('/catalog')
	const isProfile = pathname === '/profile' || pathname?.startsWith('/profile')

	return (
		<nav className='fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray2' style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
			<div className='flex items-center justify-around h-14 min-h-[56px]'>
				<Link
					href='/catalog'
					className={`flex flex-col items-center justify-center flex-1 py-2 ${
						isCatalog ? 'text-main1' : 'text-gray'
					}`}
				>
					{isCatalog ? (
						<Squares2X2IconSolid className='w-6 h-6' />
					) : (
						<Squares2X2Icon className='w-6 h-6' />
					)}
					<span className='text-xs mt-1 font-medium'>Каталог</span>
				</Link>

				<Link
					href='/profile?tab=cart'
					className='flex flex-col items-center justify-center flex-1 py-2 text-gray hover:text-main1 transition-colors'
				>
					<ShoppingBagIcon className='w-6 h-6' />
					<span className='text-xs mt-1 font-medium'>Корзина</span>
				</Link>

				<Link
					href='/profile'
					className={`flex flex-col items-center justify-center flex-1 py-2 ${
						isProfile ? 'text-main1' : 'text-gray'
					}`}
				>
					{isProfile ? (
						<UserIconSolid className='w-6 h-6' />
					) : (
						<UserIcon className='w-6 h-6' />
					)}
					<span className='text-xs mt-1 font-medium'>Профиль</span>
				</Link>
			</div>
		</nav>
	)
}
