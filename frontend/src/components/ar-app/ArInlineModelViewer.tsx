'use client'

import { isIosDevice, preferSameOriginMediaUrl, resolveFbxUrl, resolveGlbUrl } from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { useEffect, useMemo, useState } from 'react'
import ArFbxViewer from './ArFbxViewer'

type ArInlineModelViewerProps = {
	product: Product
}

/**
 * GLB/FBX с сайта. AR в комнату через браузер — только Android (GLB).
 * iPhone Safari: 3D-просмотр без кнопки AR (Apple не поддерживает GLB в Quick Look).
 */
export default function ArInlineModelViewer({ product }: ArInlineModelViewerProps) {
	const [ready, setReady] = useState(false)
	const [ios, setIos] = useState(false)

	const glbUrl = useMemo(() => {
		const raw = resolveGlbUrl(product)
		return raw ? preferSameOriginMediaUrl(raw) : null
	}, [product])
	const fbxUrl = resolveFbxUrl(product)
	const posterUrl = getProductPrimaryImageUrl(product)
	const arEnabled = Boolean(glbUrl) && !ios

	useEffect(() => {
		setIos(isIosDevice())
	}, [])

	useEffect(() => {
		if (!glbUrl) return
		import('@google/model-viewer').then(() => setReady(true))
	}, [glbUrl])

	if (glbUrl) {
		return (
			<div className='space-y-3'>
				{ready ? (
					<model-viewer
						src={glbUrl}
						{...(posterUrl ? { poster: posterUrl } : {})}
						{...(arEnabled ? { ar: true } : {})}
						ar-modes='webxr scene-viewer'
						camera-controls
						shadow-intensity='1'
						loading='lazy'
						reveal='auto'
						interaction-prompt='none'
						touch-action='pan-y'
						style={{
							width: '100%',
							height: 'min(60vh, 420px)',
							minHeight: 280,
							backgroundColor: '#f3f4f6',
							borderRadius: 12,
						}}
					/>
				) : (
					<div
						className='flex items-center justify-center rounded-xl bg-gray-bg'
						style={{ height: 'min(60vh, 420px)', minHeight: 280 }}
					>
						<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
					</div>
				)}

				{ios ? (
					<p className='text-xs text-gray text-center'>
						iPhone: 3D-просмотр GLB (поворот и масштаб). AR в комнату — в Android-приложении (APK).
					</p>
				) : (
					<p className='text-xs text-gray text-center'>
						Нажмите иконку AR в углу модели, чтобы примерить в комнате (GLB).
					</p>
				)}
			</div>
		)
	}

	if (fbxUrl) {
		return <ArFbxViewer url={fbxUrl} />
	}

	return (
		<p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4'>
			Нет GLB или FBX для этого товара.
		</p>
	)
}
