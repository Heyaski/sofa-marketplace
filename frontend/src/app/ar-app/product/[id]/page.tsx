'use client'

import ArAppShell from '@/components/ar-app/ArAppShell'
import ArQuickLookButton from '@/components/ar-app/ArQuickLookButton'
import { hasArModel, isIosDevice } from '@/lib/arApp/modelUrls'
import { productService } from '@/services/api'
import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function formatPrice(price?: number | string): string | null {
	if (price == null || price === '') return null
	const num = Number(price)
	if (!Number.isFinite(num)) return null
	return new Intl.NumberFormat('ru-RU').format(num) + ' ₽'
}

type PageProps = {
	params: { id: string }
}

export default function ArAppProductPage({ params }: PageProps) {
	const productId = parseInt(params.id, 10)
	const [product, setProduct] = useState<Product | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [ios, setIos] = useState(false)

	useEffect(() => {
		setIos(isIosDevice())
	}, [])

	useEffect(() => {
		if (!Number.isFinite(productId)) {
			setError('Некорректный товар')
			setLoading(false)
			return
		}
		productService
			.getProduct(productId)
			.then(p => {
				if (!hasArModel(p)) {
					setError('3D модель для AR недоступна')
					return
				}
				setProduct(p)
			})
			.catch(() => setError('Не удалось загрузить товар'))
			.finally(() => setLoading(false))
	}, [productId])

	if (loading) {
		return (
			<ArAppShell title='Товар' backHref='/ar-app'>
				<div className='flex justify-center py-20'>
					<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
				</div>
			</ArAppShell>
		)
	}

	if (error || !product) {
		return (
			<ArAppShell title='Товар' backHref='/ar-app'>
				<p className='text-center text-gray p-8'>{error || 'Товар не найден'}</p>
			</ArAppShell>
		)
	}

	const imageUrl = getProductPrimaryImageUrl(product)
	const title =
		product.title_display ??
		getTitleWithoutBrand(product.title || '', product.brand)
	const price = formatPrice(product.price)

	return (
		<ArAppShell title={title} backHref='/ar-app'>
			<div className='p-4 space-y-4'>
				<div className='w-full aspect-[4/3] rounded-xl bg-gray-bg overflow-hidden'>
					{imageUrl ? (
						<img src={imageUrl} alt='' className='w-full h-full object-cover' />
					) : null}
				</div>

				<div>
					<h2 className='text-xl font-bold text-black'>{title}</h2>
					{product.article ? (
						<p className='text-sm text-gray mt-1'>Артикул: {product.article}</p>
					) : null}
					{price ? <p className='text-lg font-bold text-black mt-2'>{price}</p> : null}
				</div>

				{product.width || product.depth || product.height ? (
					<p className='text-sm text-gray'>
						Размеры:{' '}
						{[product.width, product.depth, product.height].filter(Boolean).join(' × ')} см
					</p>
				) : null}

				{product.material ? (
					<p className='text-sm text-gray'>Материал: {product.material}</p>
				) : null}

				{product.description ? (
					<p className='text-sm text-gray leading-relaxed'>{product.description}</p>
				) : null}

				<ArQuickLookButton product={product} />

				{ios ? (
					<p className='text-xs text-gray text-center'>
						Откроется камера Apple AR — наведите на пол и разместите модель
					</p>
				) : null}

				<Link
					href={`/product/${product.id}`}
					className='block w-full text-center py-3 rounded-xl border border-gray2 text-black font-medium hover:bg-white transition-colors'
				>
					Открыть на сайте
				</Link>
			</div>
		</ArAppShell>
	)
}
