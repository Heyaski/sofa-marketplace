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
 * iPhone: GLB автоматически конвертируется в USDZ на сервере для Quick Look.
 * Android: Scene Viewer / WebXR с GLB.
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
	const [iosUsdzStatus, setIosUsdzStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')

	useEffect(() => {
		setIos(isIosDevice())
	}, [])

	useEffect(() => {
		if (!glbUrl) return
		import('@google/model-viewer').then(() => setReady(true))
	}, [glbUrl])

	// Лёгкая проверка доступности USDZ (HEAD), без скачивания 100+ MB в Safari
	useEffect(() => {
		if (!ios || !iosAr) {
			setIosUsdzStatus('idle')
			return
		}
		if (product.model_usdz || product.ios_ar_available) {
			setIosUsdzStatus('ok')
			return
		}

		const url = resolveIosArSrc(product)
		if (!url) return

		let cancelled = false
		setIosUsdzStatus('checking')
		const controller = new AbortController()
		const timeout = window.setTimeout(() => controller.abort(), 60_000)

		fetch(url, { method: 'HEAD', signal: controller.signal })
			.then(res => {
				if (!res.ok) throw new Error(`USDZ ${res.status}`)
				setIosUsdzStatus('ok')
			})
			.catch(() => {
				if (!cancelled) setIosUsdzStatus('error')
			})
			.finally(() => window.clearTimeout(timeout))

		return () => {
			cancelled = true
			controller.abort()
			window.clearTimeout(timeout)
		}
	}, [ios, iosAr, product])

	if (glbUrl) {
		return (
			<div className='space-y-3'>
				{ready ? (
					<model-viewer
						src={glbUrl}
						{...(iosSrc ? { 'ios-src': iosSrc } : {})}
						{...(posterUrl ? { poster: posterUrl } : {})}
						{...(arEnabled ? { ar: true } : {})}
						ar-modes={ios ? 'quick-look' : 'webxr scene-viewer'}
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

				{ios && iosAr && iosUsdzStatus === 'checking' ? (
					<p className='text-xs text-gray text-center'>Проверка AR-модели…</p>
				) : ios && iosAr && iosUsdzStatus === 'error' ? (
					<p className='text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center'>
						AR-модель пока не готова. Обновите страницу через минуту.
					</p>
				) : ios && iosAr ? (
					<p className='text-xs text-gray text-center'>
						Нажмите иконку AR в углу модели — примерка в комнате.
					</p>
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
