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

type ArInlineModelViewerProps = {
	product: Product
}

type ModelViewerEl = HTMLElement & {
	activateAR?: () => Promise<void>
}

/**
 * GLB → AR через иконку AR в model-viewer (кубик).
 * iPhone: ios-src → USDZ (S3).
 */
export default function ArInlineModelViewer({ product }: ArInlineModelViewerProps) {
	const viewerRef = useRef<ModelViewerEl>(null)
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
	const arEnabled = Boolean(glbUrl) && (!ios || iosAr)

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
			const pct = Math.round((detail?.totalProgress ?? 0) * 100)
			setLoadProgress(pct)
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
		const canTapAr = modelLoaded && arEnabled && (!ios || (iosAr && Boolean(iosSrc)))

		return (
			<div className='space-y-3'>
				<style>{`
					model-viewer::part(default-ar-button) {
						display: none;
					}
				`}</style>

				<div className='relative rounded-xl'>
					{ready ? (
						<model-viewer
							ref={viewerRef}
							src={glbUrl}
							{...(iosSrc ? { 'ios-src': iosSrc } : {})}
							{...(posterUrl ? { poster: posterUrl } : {})}
							{...(arEnabled ? { ar: true } : {})}
							ar-modes={ios ? 'quick-look' : 'webxr scene-viewer'}
							ar-placement='floor'
							ar-scale='auto'
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
						>
							{canTapAr ? (
								<button
									slot='ar-button'
									type='button'
									aria-label='Примерить в комнате'
									className='flex items-center justify-center w-14 h-14 rounded-full bg-main1 text-white shadow-lg border-2 border-white text-xs font-bold'
									style={{ touchAction: 'manipulation' }}
								>
									AR
								</button>
							) : null}
						</model-viewer>
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
							className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-bg/90 px-6 text-center'
							aria-live='polite'
						>
							<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
							<p className='text-sm text-black font-medium'>
								Загрузка 3D-модели…
							</p>
							<p className='text-xs text-gray'>
								Подождите {loadProgress > 0 ? `${loadProgress}%` : '—'}.
								{ios ? ' После загрузки нажмите AR в углу.' : ''}
							</p>
						</div>
					) : null}
				</div>

				{!modelLoaded ? (
					<p className='text-xs text-gray text-center'>
						Подождите, пока загрузится 3D-модель. AR станет доступен после загрузки.
					</p>
				) : ios && iosAr && iosSrc ? (
					<p className='text-xs text-gray text-center'>
						Нажмите кнопку <strong>AR</strong> в правом нижнем углу — откроется камера для
						примерки в комнате.
					</p>
				) : ios ? (
					<p className='text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center'>
						AR на iPhone пока недоступен — USDZ ещё не готов на сервере.
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
