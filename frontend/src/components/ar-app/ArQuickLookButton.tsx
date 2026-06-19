'use client'

import { resolveGlbUrl, resolveUsdzUrl } from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'

type ArQuickLookButtonProps = {
	product: Product
	className?: string
}

/**
 * iOS Safari: AR Quick Look через rel="ar" и USDZ.
 * Если USDZ нет — открываем GLB в Scene Viewer (Android) или показываем подсказку.
 */
export default function ArQuickLookButton({ product, className = '' }: ArQuickLookButtonProps) {
	const usdzUrl = resolveUsdzUrl(product)
	const glbUrl = resolveGlbUrl(product)
	const poster = product.image || product.photo_url || ''

	if (usdzUrl) {
		return (
			<a
				rel='ar'
				href={usdzUrl}
				className={`block w-full text-center bg-main1 text-white py-4 rounded-xl font-semibold text-base hover:bg-main2 transition-colors ${className}`}
			>
				{poster ? (
					<img src={poster} alt='' className='hidden' width={1} height={1} />
				) : null}
				Примерить в AR
			</a>
		)
	}

	if (glbUrl) {
		const sceneViewer = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred`
		return (
			<a
				href={sceneViewer}
				className={`block w-full text-center bg-main1 text-white py-4 rounded-xl font-semibold text-base hover:bg-main2 transition-colors ${className}`}
			>
				Примерить в AR
			</a>
		)
	}

	return (
		<p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4'>
			3D-модель для AR пока недоступна для этого товара.
		</p>
	)
}
