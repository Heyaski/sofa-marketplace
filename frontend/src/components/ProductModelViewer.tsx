'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Product } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']
const GLB_CACHE_NAME = 'vizhub-glb-models'
const GLB_CACHE_MAX_ENTRIES = 15
const GLB_VERSION = 'v=opt4'
const MAX_CONCURRENT_LOADS = 3
const VIEWPORT_HYSTERESIS_MS = 400

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

function withGlbVersion(url: string): string {
	return url + (url.includes('?') ? '&' : '?') + GLB_VERSION
}

function isValidUrl(url: string | null | undefined): boolean {
	if (!url) return false
	const u = url.toLowerCase()
	return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')
}

function collectGlbUrls(product: Product): string[] {
	if (!product) return []
	const seen = new Set<string>()
	const out: string[] = []
	const push = (raw: string | null | undefined) => {
		if (!raw || !isValidUrl(raw)) return
		const u = raw.toLowerCase()
		const ext = u.substring(u.lastIndexOf('.') + 1).split('?')[0]
		if (!MODEL_VIEWER_FORMATS.includes(ext)) return
		const base = raw.split('?')[0]
		if (seen.has(base)) return
		seen.add(base)
		out.push(withGlbVersion(raw))
	}
	if (product.model_glb) push(product.model_glb)
	if (product.model_rfa_glb_preview) push(product.model_rfa_glb_preview)
	if (product.asset_3d_models?.length) {
		for (const a of product.asset_3d_models) {
			push(a.file_url)
		}
	}
	return out
}

/** URL n-й 3D-модели (0 — основная). Для страницы товара: два вьюера. */
export function getProductModelUrlAt(product: Product, index: number): string | null {
	const urls = collectGlbUrls(product)
	return urls[index] ?? null
}

export function getRfaPreviewModelUrl(product: Product): string | null {
	const url = product.model_rfa_glb_preview
	return url && isValidUrl(url) ? withGlbVersion(url) : null
}

function getModelUrl(product: Product, index: number = 0): string | null {
	return getProductModelUrlAt(product, index)
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
		await loadQueue.acquire()
		try {
			const res = await fetch(url, { mode: 'cors', signal })
			if (!res.ok) return url
			const cache = await caches.open(GLB_CACHE_NAME)
			await cache.put(url, res.clone())
			trimCacheIfNeeded(cache)
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
	/** Индекс модели в списке GLB (вторая модель на странице товара). */
	modelIndex?: number
	/** Явный URL модели (если нужно показать конкретный источник, например RFA preview GLB). */
	modelUrlOverride?: string | null
	/** Уменьшенная высота для страницы товара (два вьюера в ряд). */
	compact?: boolean
	className?: string
	onClick?: () => void
}

export default function ProductModelViewer({
	product,
	variant = 'card',
	modelIndex = 0,
	modelUrlOverride = null,
	compact = false,
	className = '',
	onClick,
}: ProductModelViewerProps) {
	const modelUrl = modelUrlOverride || getModelUrl(product, modelIndex)
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

	const pageSizeClass = compact
		? 'aspect-square min-h-[180px] max-h-[280px] sm:max-h-[300px]'
		: 'aspect-square sm:min-h-[280px] sm:max-h-[360px]'
	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : pageSizeClass} ${className}`

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
							minHeight: variant === 'page' ? (compact ? 180 : 280) : 200,
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
