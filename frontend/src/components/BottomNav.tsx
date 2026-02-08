'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	Squares2X2Icon,
	ShoppingBagIcon,
	UserIcon,
} from '@heroicons/react/24/outline'
import {
	Squares2X2Icon as Squares2X2IconSolid,
	ShoppingBagIcon as ShoppingBagIconSolid,
	UserIcon as UserIconSolid,
} from '@heroicons/react/24/solid'

export default function BottomNav() {
	const pathname = usePathname()
	const isCatalog = pathname === '/catalog' || pathname?.startsWith('/catalog')
	const isProfile = pathname === '/profile' || pathname?.startsWith('/profile')

	return (
		<nav
			className='fixed inset-x-0 bottom-0 z-[100] lg:hidden bg-white border-t border-gray2'
			style={{
				paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
			}}
		>
			<div className='flex items-center justify-around h-14 min-h-[52px] w-full max-w-[100vw]'>
				<Link
					href='/catalog'
					className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 ${
						isCatalog ? 'text-main1' : 'text-gray'
					}`}
				>
					{isCatalog ? (
						<Squares2X2IconSolid className='w-6 h-6 flex-shrink-0' />
					) : (
						<Squares2X2Icon className='w-6 h-6 flex-shrink-0' />
					)}
					<span className='text-[10px] sm:text-xs mt-0.5 font-medium truncate w-full text-center'>Каталог</span>
				</Link>

				<Link
					href='/profile?tab=cart'
					className='flex flex-col items-center justify-center flex-1 min-w-0 py-2 text-gray hover:text-main1 transition-colors'
				>
					<ShoppingBagIcon className='w-6 h-6 flex-shrink-0' />
					<span className='text-[10px] sm:text-xs mt-0.5 font-medium truncate w-full text-center'>Корзина</span>
				</Link>

				<Link
					href='/profile'
					className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 ${
						isProfile ? 'text-main1' : 'text-gray'
					}`}
				>
					{isProfile ? (
						<UserIconSolid className='w-6 h-6 flex-shrink-0' />
					) : (
						<UserIcon className='w-6 h-6 flex-shrink-0' />
					)}
					<span className='text-[10px] sm:text-xs mt-0.5 font-medium truncate w-full text-center'>Профиль</span>
				</Link>
			</div>
		</nav>
	)
}
