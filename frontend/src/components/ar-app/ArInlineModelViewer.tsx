'use client'

import {
	canUseIosRoomAr,
	isIosDevice,
	iosQuickLookUsdzUrl,
	preferSameOriginMediaUrl,
	resolveFbxUrl,
	resolveGlbUrl,
} from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { useEffect, useMemo, useRef, useState } from 'react'
import ArFbxViewer from './ArFbxViewer'

const AR_PLACEHOLDER =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

type ArInlineModelViewerProps = {
	product: Product
}

/**
 * 3D: model-viewer. iPhone AR: отдельная ссылка rel="ar" ПОД вьюером (не внутри).
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
	const quickLookUrl = ios && iosAr ? iosQuickLookUsdzUrl(product.id) : null
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
		const showIosAr = Boolean(ios && iosAr && quickLookUrl && modelLoaded)

		return (
			<div className='space-y-3'>
				{/* Только 3D — без AR-кнопок внутри */}
				<div className='relative rounded-xl bg-[#f3f4f6]'>
					{ready ? (
						<model-viewer
							ref={viewerRef}
							src={glbUrl}
							{...(posterUrl ? { poster: posterUrl } : {})}
							{...(androidAr ? { ar: true } : {})}
							ar-modes='webxr scene-viewer'
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
							}}
						/>
					) : (
						<div
							className='flex items-center justify-center'
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
							<p className='text-sm font-medium text-black'>Загрузка 3D-модели…</p>
							<p className='text-xs text-gray'>
								Подождите{loadProgress > 0 ? ` (${loadProgress}%)` : ''}. Не закрывайте
								страницу.
							</p>
						</div>
					) : null}
				</div>

				{/* iPhone: AR отдельно под вьюером — Safari rel="ar" + видимый img */}
				{showIosAr && quickLookUrl ? (
					<a
						rel='ar'
						href={quickLookUrl}
						className='flex w-full items-center justify-center gap-3 rounded-xl bg-main1 px-4 py-4 text-base font-semibold text-white shadow-md active:opacity-90'
					>
						<img
							src={posterUrl || AR_PLACEHOLDER}
							alt=''
							width={40}
							height={40}
							className='h-10 w-10 shrink-0 rounded-lg object-cover bg-white/20'
						/>
						Примерить в комнате (AR)
					</a>
				) : null}

				{!modelLoaded ? (
					<p className='text-center text-xs text-gray'>
						Подождите, пока загрузится 3D-модель. Кнопка AR появится ниже.
					</p>
				) : showIosAr ? (
					<p className='text-center text-xs text-gray'>
						Нажмите «Примерить в комнате» — откроется камера. Нужен Safari (не Telegram/VK).
					</p>
				) : ios ? (
					<p className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800'>
						AR на iPhone пока недоступен — USDZ ещё не готов на сервере.
					</p>
				) : (
					<p className='text-center text-xs text-gray'>
						Нажмите иконку AR на модели, чтобы примерить в комнате.
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
