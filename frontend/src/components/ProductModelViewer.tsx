'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Product } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']
const GLB_CACHE_NAME = 'vizhub-glb-models'
const GLB_CACHE_MAX_ENTRIES = 15
const GLB_VERSION = 'v=opt4'
const VIEWPORT_HYSTERESIS_MS = 400

function getModelUrl(product: Product): string | null {
	if (!product) return null
	let url: string | null = null
	if (product.model_glb) url = product.model_glb
	else if (product.asset_3d_models && product.asset_3d_models.length > 0) {
		const first = product.asset_3d_models[0]
		if (first?.file_url) {
			const u = first.file_url.toLowerCase()
			const ext = u.substring(u.lastIndexOf('.') + 1).split('?')[0]
			if (MODEL_VIEWER_FORMATS.includes(ext)) url = first.file_url
		}
	}
	if (!url) return null
	// Cache-bust: после оптимизации gltfpack старый кэш (60 MB) невалиден
	return url + (url.includes('?') ? '&' : '?') + GLB_VERSION
}

function isValidUrl(url: string | null | undefined): boolean {
	if (!url) return false
	const u = url.toLowerCase()
	return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')
}

async function trimCacheIfNeeded(cache: Cache) {
	try {
		const keys = await cache.keys()
		if (keys.length > GLB_CACHE_MAX_ENTRIES) {
			for (let i = 0; i < keys.length - GLB_CACHE_MAX_ENTRIES; i++) {
				await cache.delete(keys[i])
			}
		}
	} catch {
		/* ignore */
	}
}

async function getCachedOrFetchModelUrl(url: string, signal?: AbortController['signal']): Promise<string> {
	if (typeof caches === 'undefined') return url
	try {
		const cached = await caches.match(url)
		if (cached) {
			const blob = await cached.blob()
			return URL.createObjectURL(blob)
		}
		const res = await fetch(url, { mode: 'cors', signal })
		if (!res.ok) return url
		const cache = await caches.open(GLB_CACHE_NAME)
		await cache.put(url, res.clone())
		trimCacheIfNeeded(cache)
		const blob = await res.blob()
		return URL.createObjectURL(blob)
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
	const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
	const [inViewport, setInViewport] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const modelViewerRef = useRef<any>(null)

	// Виртуализация: загружаем 3D когда карточка в viewport. Гистерезис — не скрываем при кратковременном выходе из viewport.
	useEffect(() => {
		if (!modelUrl || !containerRef.current) return
		const el = containerRef.current
		let hysteresisTimer: ReturnType<typeof setTimeout> | null = null
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					if (hysteresisTimer) {
						clearTimeout(hysteresisTimer)
						hysteresisTimer = null
					}
					setInViewport(true)
				} else {
					if (hysteresisTimer) return
					hysteresisTimer = setTimeout(() => {
						hysteresisTimer = null
						setInViewport(false)
					}, VIEWPORT_HYSTERESIS_MS)
				}
			},
			{ rootMargin: '200px', threshold: 0.01 }
		)
		observer.observe(el)
		return () => {
			if (hysteresisTimer) clearTimeout(hysteresisTimer)
			observer.disconnect()
		}
	}, [modelUrl])

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

	const blobUrlRef = useRef<string | null>(null)
	const loadedForUrlRef = useRef<string | null>(null)
	useEffect(() => {
		if (!modelUrl || !scriptReady || !inViewport) return
		// Не выгружаем модель при выходе из viewport — оставляем blob, чтобы при возврате скролла модель появлялась мгновенно
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
		}).catch(() => {
			if (!ac.signal.aborted) setResolvedSrc(modelUrl)
		})
		return () => {
			ac.abort()
		}
	}, [modelUrl, scriptReady, inViewport])
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
	const hasModel = !!modelUrl && isValidUrl(modelUrl) && scriptReady && resolvedSrc !== null
	const isLoading = inViewport && !resolvedSrc

	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : 'aspect-square sm:min-h-[400px]'} ${className}`

	if (!modelUrl || !isValidUrl(modelUrl)) return null

	return (
		<div
			ref={containerRef}
			className={containerClass}
			style={{ contentVisibility: 'auto' } as React.CSSProperties}
		>
			{hasModel ? (
				<div
					className="w-full h-full cursor-grab active:cursor-grabbing"
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
			) : isLoading ? (
				<div className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={onClick}>
					<div className='animate-spin rounded-full h-8 w-8 border-2 border-main1 border-t-transparent' />
					<span className='text-xs text-gray'>Загрузка 3D...</span>
				</div>
			) : (
				<div className="w-full h-full min-h-[200px] cursor-pointer" onClick={onClick} />
			)}
		</div>
	)
}
