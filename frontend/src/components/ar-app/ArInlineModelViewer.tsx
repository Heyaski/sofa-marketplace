'use client'

import {
	canUseIosRoomAr,
	isIosDevice,
	preferSameOriginMediaUrl,
	resolveFbxUrl,
	resolveGlbUrl,
	resolveIosArSrc,
} from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { useEffect, useMemo, useState } from 'react'
import ArFbxViewer from './ArFbxViewer'

type ArInlineModelViewerProps = {
	product: Product
}

/**
 * GLB на сайте → AR в комнату.
 * iPhone: USDZ с сервера + кнопка Quick Look (rel=ar).
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
	const iosAr = canUseIosRoomAr(product)
	const iosSrc = ios && iosAr ? resolveIosArSrc(product) ?? undefined : undefined
	const arEnabled = Boolean(glbUrl) && (!ios || iosAr)

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
				<style>{`
					model-viewer::part(default-ar-button) {
						width: 48px;
						height: 48px;
						bottom: 16px;
						right: 16px;
					}
				`}</style>

				{ready ? (
					<model-viewer
						src={glbUrl}
						{...(iosSrc ? { 'ios-src': iosSrc } : {})}
						{...(posterUrl ? { poster: posterUrl } : {})}
						{...(arEnabled ? { ar: true } : {})}
						ar-modes={ios ? 'quick-look' : 'webxr scene-viewer'}
						ar-placement='floor'
						camera-controls
						shadow-intensity='1'
						loading='eager'
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

				{ios && iosAr && iosSrc ? (
					<a
						rel='ar'
						href={iosSrc}
						className='block w-full overflow-hidden rounded-xl border border-gray2 bg-white shadow-sm'
					>
						{posterUrl ? (
							<img src={posterUrl} alt='' className='w-full aspect-[4/3] object-cover' />
						) : null}
						<span className='block w-full text-center bg-main1 text-white py-4 font-semibold text-base'>
							Примерить в комнате (AR)
						</span>
					</a>
				) : ios ? (
					<p className='text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center'>
						AR на iPhone временно недоступен — конвертер на сервере не настроен.
					</p>
				) : (
					<p className='text-xs text-gray text-center'>
						Нажмите иконку AR в углу модели, чтобы примерить в комнате.
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
