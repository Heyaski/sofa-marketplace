'use client'

import { isIosDevice, resolveFbxUrl, resolveGlbUrl } from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type ArQuickLookButtonProps = {
	product: Product
	className?: string
}

export default function ArQuickLookButton({ product, className = '' }: ArQuickLookButtonProps) {
	const [ios, setIos] = useState(false)
	const glbUrl = resolveGlbUrl(product)
	const fbxUrl = resolveFbxUrl(product)
	const btnClass = `block w-full text-center bg-main1 text-white py-4 rounded-xl font-semibold text-base hover:bg-main2 transition-colors ${className}`

	useEffect(() => {
		setIos(isIosDevice())
	}, [])

	if (glbUrl || fbxUrl) {
		const label = glbUrl
			? ios
				? 'Смотреть 3D (GLB)'
				: 'Примерить в AR'
			: 'Смотреть 3D (FBX)'
		return (
			<Link href={`/ar-app/product/${product.id}/view`} className={btnClass}>
				{label}
			</Link>
		)
	}

	return (
		<p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4'>
			Нет GLB или FBX для этого товара.
		</p>
	)
}
