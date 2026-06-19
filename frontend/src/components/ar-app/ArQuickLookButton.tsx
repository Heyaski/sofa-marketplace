'use client'

import { resolveFbxUrl, resolveGlbUrl } from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import Link from 'next/link'

type ArQuickLookButtonProps = {
	product: Product
	className?: string
}

/** GLB → AR через model-viewer; FBX → 3D-просмотр в Safari. */
export default function ArQuickLookButton({ product, className = '' }: ArQuickLookButtonProps) {
	const glbUrl = resolveGlbUrl(product)
	const fbxUrl = resolveFbxUrl(product)
	const btnClass = `block w-full text-center bg-main1 text-white py-4 rounded-xl font-semibold text-base hover:bg-main2 transition-colors ${className}`

	if (glbUrl || fbxUrl) {
		return (
			<Link href={`/ar-app/product/${product.id}/view`} className={btnClass}>
				{glbUrl ? 'Примерить в AR' : 'Смотреть 3D (FBX)'}
			</Link>
		)
	}

	return (
		<p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4'>
			Нет GLB или FBX для этого товара.
		</p>
	)
}
