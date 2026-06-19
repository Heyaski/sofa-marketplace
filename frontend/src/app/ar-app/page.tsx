'use client'

import ArAppShell from '@/components/ar-app/ArAppShell'
import { hasArModel } from '@/lib/arApp/modelUrls'
import { useCategories } from '@/hooks/useApi'
import { productService } from '@/services/api'
import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

function formatPrice(price?: number | string): string | null {
	if (price == null || price === '') return null
	const num = Number(price)
	if (!Number.isFinite(num)) return null
	return new Intl.NumberFormat('ru-RU').format(num) + ' ₽'
}

export default function ArAppCatalogPage() {
	const { categories } = useCategories()
	const [items, setItems] = useState<Product[]>([])
	const [categoryId, setCategoryId] = useState<number | null>(null)
	const [searchDraft, setSearchDraft] = useState('')
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadProducts = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const data = await productService.getProducts(
				{
					list_mode: '3d',
					...(categoryId ? { category: categoryId } : {}),
					...(search ? { search } : {}),
				},
				1,
				80
			)
			const rows = Array.isArray(data?.results) ? data.results : []
			setItems(rows.filter(hasArModel))
		} catch {
			setError('Не удалось загрузить каталог')
		} finally {
			setLoading(false)
		}
	}, [categoryId, search])

	useEffect(() => {
		loadProducts()
	}, [loadProducts])

	return (
		<ArAppShell title='AR каталог'>
			<div className='p-4 space-y-4'>
				<p className='text-sm text-gray text-center'>
					3D каталог · примерка в комнате через камеру
				</p>

				<input
					type='search'
					placeholder='Поиск по названию, артикулу…'
					value={searchDraft}
					onChange={e => setSearchDraft(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') setSearch(e.currentTarget.value.trim())
					}}
					className='w-full px-4 py-3 rounded-xl border border-gray2 bg-white text-black placeholder:text-gray focus:outline-none focus:ring-2 focus:ring-main1'
				/>

				{categories.length > 0 ? (
					<div className='flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide'>
						<button
							type='button'
							onClick={() => setCategoryId(null)}
							className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${
								categoryId === null
									? 'bg-main1 text-white border-main1'
									: 'bg-white text-gray border-gray2'
							}`}
						>
							Все
						</button>
						{categories.map(cat => (
							<button
								key={cat.id}
								type='button'
								onClick={() => setCategoryId(cat.id)}
								className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${
									categoryId === cat.id
										? 'bg-main1 text-white border-main1'
										: 'bg-white text-gray border-gray2'
								}`}
							>
								{cat.name}
							</button>
						))}
					</div>
				) : null}

				{loading ? (
					<div className='flex justify-center py-16'>
						<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
					</div>
				) : error ? (
					<p className='text-center text-red-600 py-8'>{error}</p>
				) : items.length === 0 ? (
					<p className='text-center text-gray py-8'>Нет товаров с 3D для AR</p>
				) : (
					<ul className='space-y-3'>
						{items.map(item => {
							const imageUrl = getProductPrimaryImageUrl(item)
							const title =
								item.title_display ??
								getTitleWithoutBrand(item.title || '', item.brand)
							const price = formatPrice(item.price)
							return (
								<li key={item.id}>
									<Link
										href={`/ar-app/product/${item.id}`}
										className='flex gap-3 p-3 bg-white rounded-xl border border-gray2 hover:border-main1/40 transition-colors'
									>
										<div className='w-20 h-20 shrink-0 rounded-lg bg-gray-bg overflow-hidden'>
											{imageUrl ? (
												<img
													src={imageUrl}
													alt=''
													className='w-full h-full object-cover'
												/>
											) : null}
										</div>
										<div className='flex-1 min-w-0'>
											<p className='font-semibold text-black text-sm line-clamp-2'>
												{title}
											</p>
											{item.article ? (
												<p className='text-xs text-gray mt-1'>Арт. {item.article}</p>
											) : null}
											{price ? (
												<p className='text-sm font-bold text-black mt-1'>{price}</p>
											) : null}
										</div>
										<span className='shrink-0 self-center text-[10px] font-bold text-main1 bg-main1/10 px-2 py-1 rounded-md'>
											AR
										</span>
									</Link>
								</li>
							)
						})}
					</ul>
				)}

				<p className='text-xs text-gray text-center pt-2'>
					На iPhone: «Поделиться» → «На экран Домой» — как отдельное приложение
				</p>
			</div>
		</ArAppShell>
	)
}
