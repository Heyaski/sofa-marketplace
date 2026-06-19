'use client'

import ArAppShell from '@/components/ar-app/ArAppShell'
import ArInlineModelViewer from '@/components/ar-app/ArInlineModelViewer'
import { hasArModel } from '@/lib/arApp/modelUrls'
import { productService } from '@/services/api'
import type { Product } from '@/types'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import { useEffect, useState } from 'react'

type ArAppProductViewClientProps = {
	productId: number
}

export default function ArAppProductViewClient({ productId }: ArAppProductViewClientProps) {
	const [product, setProduct] = useState<Product | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

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
					setError('3D модель недоступна')
					return
				}
				setProduct(p)
			})
			.catch(() => setError('Не удалось загрузить товар'))
			.finally(() => setLoading(false))
	}, [productId])

	if (loading) {
		return (
			<ArAppShell title='AR' backHref={`/ar-app/product/${productId}`}>
				<div className='flex flex-col items-center justify-center gap-3 py-20 px-6 text-center'>
					<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
					<p className='text-sm text-gray'>Загрузка товара…</p>
				</div>
			</ArAppShell>
		)
	}

	if (error || !product) {
		return (
			<ArAppShell title='AR' backHref='/ar-app'>
				<p className='text-center text-gray p-8'>{error || 'Товар не найден'}</p>
			</ArAppShell>
		)
	}

	const title =
		product.title_display ?? getTitleWithoutBrand(product.title || '', product.brand)

	return (
		<ArAppShell title={title} backHref={`/ar-app/product/${product.id}`}>
			<div className='p-4'>
				<ArInlineModelViewer product={product} />
			</div>
		</ArAppShell>
	)
}
