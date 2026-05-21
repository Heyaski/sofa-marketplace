'use client'

import {
	CATALOG_NAV_HREF_REFRESH,
	getLastCatalogQueryForBackNavigation,
} from '@/lib/catalogUrlState'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Ссылка для «Каталог» в шапке и нижней навигации:
 * на странице каталога — текущий query; иначе — последний сохранённый (возврат с товара).
 */
export function useCatalogNavHref(): string {
	const pathname = usePathname()
	const [href, setHref] = useState('/catalog')

	useEffect(() => {
		const compute = () => {
			if (pathname === '/catalog') {
				const qs = new URLSearchParams(window.location.search).toString()
				setHref(qs ? `/catalog?${qs}` : '/catalog')
			} else {
				const saved = getLastCatalogQueryForBackNavigation()
				setHref(saved ? `/catalog?${saved}` : '/catalog')
			}
		}

		compute()

		const onRefresh = () => compute()
		window.addEventListener(CATALOG_NAV_HREF_REFRESH, onRefresh)
		window.addEventListener('popstate', compute)
		return () => {
			window.removeEventListener(CATALOG_NAV_HREF_REFRESH, onRefresh)
			window.removeEventListener('popstate', compute)
		}
	}, [pathname])

	return href
}
