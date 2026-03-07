'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Product } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']
const GLB_CACHE_NAME = 'vizhub-glb-models'
const MAX_CONCURRENT_LOADS = 8

/** Ограничение параллельных загрузок. 8 — чтобы при фильтре/категории все видимые модели грузились сразу */
const loadQueue = {
	active: 0,
	queue: [] as (() => void)[],
	async acquire() {
		if (this.active < MAX_CONCURRENT_LOADS) {
			this.active++
			return
		}
		await new Promise<void>(r => this.queue.push(r))
		this.active++
	},
	release() {
		this.active--
		const next = this.queue.shift()
		if (next) next()
	},
}

function getModelUrl(product: Product): string | null {
	if (!product) return null
	if (product.model_glb) return product.model_glb
	if (product.asset_3d_models && product.asset_3d_models.length > 0) {
		const first = product.asset_3d_models[0]
		if (first?.file_url) {
			const url = first.file_url.toLowerCase()
			const ext = url.substring(url.lastIndexOf('.') + 1).split('?')[0]
			if (MODEL_VIEWER_FORMATS.includes(ext)) return first.file_url
		}
	}
	return null
}

function isValidUrl(url: string | null | undefined): boolean {
	if (!url) return false
	const u = url.toLowerCase()
	return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')
}

async function getCachedOrFetchModelUrl(url: string, signal?: AbortController['signal']): Promise<string> {
	if (typeof caches === 'undefined') return url
	try {
		const cached = await caches.match(url)
		if (cached) {
			const blob = await cached.blob()
			return URL.createObjectURL(blob)
		}
		await loadQueue.acquire()
		try {
			const res = await fetch(url, { mode: 'cors', signal })
			if (!res.ok) return url
			const cache = await caches.open(GLB_CACHE_NAME)
			cache.put(url, res.clone())
			const blob = await res.blob()
			return URL.createObjectURL(blob)
		} finally {
			loadQueue.release()
		}
	} catch {
		return url
	}
}

interface ProductModelViewerProps {
	product: Product
	variant?: 'card' | 'page'
	className?: string
	onClick?: () => void
}

export default function ProductModelViewer({
	product,
	variant = 'card',
	className = '',
	onClick,
}: ProductModelViewerProps) {
	const modelUrl = getModelUrl(product)
	const [scriptReady, setScriptReady] = useState(false)
	const [isInView, setIsInView] = useState(variant === 'page')
	const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const modelViewerRef = useRef<any>(null)

	// Загружаем 3D только когда карточка в зоне видимости
	useEffect(() => {
		if (variant !== 'card' || !containerRef.current) return
		const el = containerRef.current
		const io = new IntersectionObserver(
			([e]) => setIsInView(e.isIntersecting),
			{ rootMargin: '100px', threshold: 0.01 }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [variant])

	// Ждём model-viewer: CDN в каталоге или import на других страницах
	useEffect(() => {
		if (!modelUrl) return
		let cancelled = false
		if (typeof customElements !== 'undefined' && customElements.get('model-viewer')) {
			setScriptReady(true)
			return
		}
		import('@google/model-viewer').then(() => {
			if (!cancelled) setScriptReady(true)
		}).catch(() => {})
		return () => { cancelled = true }
	}, [modelUrl])

	// Выгружаем 3D при выходе из зоны — иначе «Загрузить ещё» даёт 40+ WebGL → чёрный экран.
	// При смене фильтра/категории — отменяем старые загрузки, чтобы видимые модели грузились сразу.
	const blobUrlRef = useRef<string | null>(null)
	const loadedForUrlRef = useRef<string | null>(null)
	useEffect(() => {
		if (!modelUrl || !scriptReady) return
		if (variant === 'card' && !isInView) {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current)
				blobUrlRef.current = null
			}
			loadedForUrlRef.current = null
			setResolvedSrc(null)
			return
		}
		if (loadedForUrlRef.current === modelUrl) return
		const ac = new AbortController()
		if (loadedForUrlRef.current && loadedForUrlRef.current !== modelUrl && blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current)
			blobUrlRef.current = null
			loadedForUrlRef.current = null
			setResolvedSrc(null)
		}
		getCachedOrFetchModelUrl(modelUrl, ac.signal).then((src) => {
			if (ac.signal.aborted) {
				if (src !== modelUrl && src.startsWith('blob:')) URL.revokeObjectURL(src)
				return
			}
			loadedForUrlRef.current = modelUrl
			if (src !== modelUrl && src.startsWith('blob:')) blobUrlRef.current = src
			setResolvedSrc(src)
		})
		return () => {
			ac.abort()
		}
	}, [modelUrl, isInView, scriptReady, variant])
	useEffect(() => () => {
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current)
			blobUrlRef.current = null
		}
	}, [])

	const setupRef = useCallback((el: any) => {
		modelViewerRef.current = el
	}, [])

	const TRANSPARENT_PIXEL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
	const shouldShow3D = !!modelUrl && isValidUrl(modelUrl) && scriptReady && resolvedSrc !== null

	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : 'aspect-square sm:min-h-[400px]'} ${className}`

	if (!shouldShow3D) {
		return (
			<div ref={containerRef} className={`${containerClass} cursor-pointer flex flex-col items-center justify-center gap-2`} onClick={onClick}>
				<div className='animate-spin rounded-full h-8 w-8 border-2 border-main1 border-t-transparent' />
				<span className='text-xs text-gray'>Загрузка 3D...</span>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className={`${containerClass} cursor-grab active:cursor-grabbing`}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => {
				e.stopPropagation()
				onClick?.()
			}}
			title={onClick ? 'Двойной щелчок — открыть карточку товара' : undefined}
		>
			<model-viewer
				ref={setupRef}
				src={resolvedSrc}
				poster={TRANSPARENT_PIXEL}
				alt={product.title || '3D модель'}
				camera-controls
				shadow-intensity='1'
				loading='lazy'
				reveal='auto'
				interaction-policy='allow-when-focused'
				disable-zoom={variant === 'card'}
				style={{
					width: '100%',
					height: '100%',
					minHeight: variant === 'page' ? 400 : 200,
					display: 'block',
					pointerEvents: 'auto',
				}}
			/>
		</div>
	)
}
