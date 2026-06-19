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
import { useEffect, useMemo, useRef, useState } from 'react'
import ArFbxViewer from './ArFbxViewer'

/** 1×1 px — для rel="ar" (Safari требует img внутри ссылки). */
const AR_LINK_PIXEL =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

type ArInlineModelViewerProps = {
	product: Product
}

/**
 * 3D: model-viewer (GLB).
 * iPhone AR: нативный Quick Look через <a rel="ar"> (model-viewer AR на iOS ненадёжен).
 */
export default function ArInlineModelViewer({ product }: ArInlineModelViewerProps) {
	const viewerRef = useRef<HTMLElement>(null)
	const [ready, setReady] = useState(false)
	const [ios, setIos] = useState(false)
	const [modelLoaded, setModelLoaded] = useState(false)
	const [loadProgress, setLoadProgress] = useState(0)

	const glbUrl = useMemo(() => {
		const raw = resolveGlbUrl(product)
		return raw ? preferSameOriginMediaUrl(raw) : null
	}, [product])
	const fbxUrl = resolveFbxUrl(product)
	const posterUrl = getProductPrimaryImageUrl(product)
	const iosAr = canUseIosRoomAr(product)
	const iosSrc = ios && iosAr ? resolveIosArSrc(product) ?? undefined : undefined
	const androidAr = Boolean(glbUrl) && !ios

	useEffect(() => {
		setIos(isIosDevice())
	}, [])

	useEffect(() => {
		if (!glbUrl) return
		import('@google/model-viewer').then(() => setReady(true))
	}, [glbUrl])

	useEffect(() => {
		const el = viewerRef.current
		if (!el || !ready) return

		const onLoad = () => {
			setModelLoaded(true)
			setLoadProgress(100)
		}
		const onProgress = (e: Event) => {
			const detail = (e as CustomEvent<{ totalProgress: number }>).detail
			setLoadProgress(Math.round((detail?.totalProgress ?? 0) * 100))
		}

		el.addEventListener('load', onLoad)
		el.addEventListener('progress', onProgress)
		return () => {
			el.removeEventListener('load', onLoad)
			el.removeEventListener('progress', onProgress)
		}
	}, [ready, glbUrl])

	if (glbUrl) {
		const showLoading = !modelLoaded
		const showIosAr = ios && iosAr && iosSrc && modelLoaded

		return (
			<div className='space-y-3'>
				<div className='relative rounded-xl'>
					{ready ? (
						<model-viewer
							ref={viewerRef}
							src={glbUrl}
							{...(posterUrl ? { poster: posterUrl } : {})}
							{...(androidAr ? { ar: true } : {})}
							{...(!ios && androidAr ? { 'ios-src': iosSrc } : {})}
							ar-modes={ios ? 'quick-look' : 'webxr scene-viewer'}
							interaction-policy='always-allow'
							camera-controls
							shadow-intensity='1'
							loading='eager'
							reveal='auto'
							interaction-prompt='none'
							style={{
								width: '100%',
								height: 'min(60vh, 420px)',
								minHeight: 280,
								display: 'block',
								backgroundColor: '#f3f4f6',
							}}
						/>
					) : (
						<div
							className='flex items-center justify-center bg-gray-bg'
							style={{ height: 'min(60vh, 420px)', minHeight: 280 }}
						>
							<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
						</div>
					)}

					{showLoading && ready ? (
						<div
							className='pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-bg/90 px-6 text-center'
							aria-live='polite'
						>
							<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
							<p className='text-sm text-black font-medium'>Загрузка 3D-модели…</p>
							<p className='text-xs text-gray'>
								Подождите{loadProgress > 0 ? ` (${loadProgress}%)` : ''}. Не закрывайте
								страницу.
							</p>
						</div>
					) : null}

					{/* iPhone: Apple Quick Look — единственный надёжный способ */}
					{showIosAr ? (
						<a
							rel='ar'
							href={iosSrc}
							className='absolute bottom-4 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-main1 text-xs font-bold text-white shadow-lg'
							style={{ WebkitTouchCallout: 'none' }}
							aria-label='Примерить в комнате'
						>
							<img
								src={posterUrl || AR_LINK_PIXEL}
								alt=''
								width={1}
								height={1}
								className='sr-only'
							/>
							AR
						</a>
					) : null}
				</div>

				{!modelLoaded ? (
					<p className='text-center text-xs text-gray'>
						Подождите, пока загрузится 3D-модель. Кнопка AR появится после загрузки.
					</p>
				) : showIosAr ? (
					<p className='text-center text-xs text-gray'>
						Нажмите кнопку AR в правом нижнем углу — откроется камера для примерки в
						комнате.
					</p>
				) : ios ? (
					<p className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800'>
						AR на iPhone пока недоступен — USDZ ещё не готов на сервере.
					</p>
				) : (
					<p className='text-center text-xs text-gray'>
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
		<p className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
			Нет GLB или FBX для этого товара.
		</p>
	)
}
