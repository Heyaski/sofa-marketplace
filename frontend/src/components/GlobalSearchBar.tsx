'use client'

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface GlobalSearchBarProps {
	className?: string
	inputClassName?: string
	mobile?: boolean
}

export default function GlobalSearchBar({
	className = '',
	inputClassName = '',
	mobile = false,
}: GlobalSearchBarProps) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const [query, setQuery] = useState('')

	// Синхронизация с URL при навигации на каталог с параметром search
	useEffect(() => {
		const search = searchParams.get('search') || ''
		setQuery(search)
	}, [pathname, searchParams])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const trimmed = query.trim()
		if (trimmed) {
			router.push(`/catalog?search=${encodeURIComponent(trimmed)}`)
		} else {
			router.push('/catalog')
		}
	}

	return (
		<form onSubmit={handleSubmit} className={`relative ${className}`}>
			<input
				type='text'
				value={query}
				onChange={e => setQuery(e.target.value)}
				placeholder='Поиск по сайту...'
				className={`mobile-search-input w-full px-4 py-2 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent ${mobile ? 'text-sm' : ''} ${inputClassName}`}
				aria-label='Поиск'
			/>
			<button
				type='submit'
				className='absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-main1 rounded-full flex items-center justify-center hover:bg-main2 transition-colors'
				aria-label='Искать'
			>
				<MagnifyingGlassIcon className='w-4 h-4 text-white' />
			</button>
		</form>
	)
}
