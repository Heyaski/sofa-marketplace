'use client'

import { CATALOG_NAV_HREF_REFRESH } from '@/lib/catalogUrlState'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Ссылка для «Каталог» в шапке и нижней навигации:
 * на странице каталога — текущий URL (оставаться с теми же фильтрами).
 * С любой другой страницы — всегда `/catalog`: не подставляем сохранённый query из sessionStorage,
 * иначе после прошлых визитов открывались те же параметры (в т.ч. «тяжёлые»), каталог висел или падал по таймауту.
 * Вернуться к последнему виду каталога можно с карточки товара (хлебные крошки) или после авторизации — там используется getLastCatalogQueryForBackNavigation().
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
				setHref('/catalog')
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
