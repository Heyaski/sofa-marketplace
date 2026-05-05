'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Product } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']
const GLB_VERSION = 'v=opt4'
const VIEWPORT_HYSTERESIS_MS = 400
const MAX_CONCURRENT_MODEL_LOADS = 3

const modelLoadQueue = {
	active: 0,
	queue: [] as Array<() => void>,
	async acquire(): Promise<() => void> {
		if (this.active >= MAX_CONCURRENT_MODEL_LOADS) {
			await new Promise<void>(resolve => this.queue.push(resolve))
		}
		this.active++
		let released = false
		return () => {
			if (released) return
			released = true
			this.active = Math.max(0, this.active - 1)
			const next = this.queue.shift()
			if (next) next()
		}
	},
}

function withGlbVersion(url: string): string {
	// Нельзя менять query-параметры подписанных URL (S3/совместимые),
	// иначе подпись становится невалидной и хранилище возвращает 403.
	const lower = url.toLowerCase()
	const hasSignature =
		lower.includes('x-amz-signature=') ||
		lower.includes('x-amz-credential=') ||
		lower.includes('x-amz-algorithm=') ||
		lower.includes('signature=') ||
		// Временные CDN-ссылки (Volc/проч.) — query нельзя менять, иначе 403
		lower.includes('auth_key=')
	if (hasSignature) return url
	return url + (url.includes('?') ? '&' : '?') + GLB_VERSION
}

function isValidUrl(url: string | null | undefined): boolean {
	if (!url) return false
	const u = url.toLowerCase()
	return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')
}

function normalizeModelUrl(url: string): string {
	try {
		if (url.startsWith('/')) {
			return encodeURI(url)
		}
		const parsed = new URL(url)
		parsed.pathname = parsed.pathname
			.split('/')
			.map(part => encodeURIComponent(decodeURIComponent(part)))
			.join('/')
		return parsed.toString()
	} catch {
		return encodeURI(url)
	}
}

function isEphemeralExternalModelUrl(url: string): boolean {
	const low = url.toLowerCase()
	if (low.includes('auth_key=')) return true
	if (
		low.includes('zaohaowu.net') ||
		low.includes('zaonaowu.net') ||
		low.includes('hitem3dstatic')
	)
		return true
	return false
}

function collectGlbUrls(product: Product): string[] {
	if (!product) return []
	const seen = new Set<string>()
	const out: string[] = []
	const modelId = (product.model_3d_id || '').trim().toLowerCase()
	const push = (raw: string | null | undefined, extHint?: string | null) => {
		if (!raw || !isValidUrl(raw)) return
		const normalized = normalizeModelUrl(raw)
		const u = normalized.toLowerCase()
		const extFromUrl = u.substring(u.lastIndexOf('.') + 1).split('?')[0]
		const ext = (extHint || extFromUrl || '').toLowerCase().replace('.', '')
		if (!MODEL_VIEWER_FORMATS.includes(ext)) return
		const base = normalized.split('?')[0]
		if (seen.has(base)) return
		seen.add(base)
		out.push(withGlbVersion(normalized))
	}

	// 1) Приоритет — GLB/GLTF/USDZ из FileAsset (если в model_3d_asset_ids есть и .rfa/.ifc, они тут просто пропускаются).
	if (product.asset_3d_models?.length) {
		const scored = [...product.asset_3d_models].sort((a, b) => {
			const aId = (a.asset_id || '').toLowerCase()
			const bId = (b.asset_id || '').toLowerCase()
			const aMatch = modelId && (aId === modelId || aId.startsWith(`${modelId}_`) || aId.startsWith(`${modelId}-`))
			const bMatch = modelId && (bId === modelId || bId.startsWith(`${modelId}_`) || bId.startsWith(`${modelId}-`))
			if (aMatch === bMatch) return aId.localeCompare(bId)
			return aMatch ? -1 : 1
		})
		for (const a of scored) push(a.file_url, a.file_ext)
	}

	// 2) Прямые поля — всегда в конец как запас (дедуп по пути без query).
	// Так при «битой» первой ссылке (например истёкший auth_key на чужом CDN) можно перейти к превью / другому полю.
	// Без ".glb" в пути ext из URL часто получается из домена (например "net/...") — считаем поля явно GLB.
	if (product.model_glb) push(product.model_glb, 'glb')
	if (product.model_rfa_glb_preview) push(product.model_rfa_glb_preview, 'glb')
	if (product.model_ar_glb) push(product.model_ar_glb, 'glb')
	const stable = out.filter(u => !isEphemeralExternalModelUrl(u))
	const risky = out.filter(u => isEphemeralExternalModelUrl(u))
	return [...stable, ...risky]
}

/** Все URL для model-viewer в порядке приоритета (для ретраев при 403/CORS). */
export function getProductModelUrlCandidates(product: Product): string[] {
	return collectGlbUrls(product)
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

interface ProductModelViewerProps {
	product: Product
	variant?: 'card' | 'page'
	/** Индекс модели в списке GLB (вторая модель на странице товара). */
	modelIndex?: number
	/** Явный URL модели (если нужно показать конкретный источник, например RFA preview GLB). */
	modelUrlOverride?: string | null
	/** Если GLB не загрузился, показываем фото каталога (битые ссылки, CORS и т.д.). */
	fallbackPosterUrl?: string | null
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
	fallbackPosterUrl = null,
	compact = false,
	className = '',
	onClick,
}: ProductModelViewerProps) {
	const candidates = useMemo(() => {
		if (modelUrlOverride) {
			const u = modelUrlOverride.trim()
			if (!isValidUrl(u)) return []
			return [withGlbVersion(normalizeModelUrl(u))]
		}
		const urls = collectGlbUrls(product)
		return urls.slice(Math.max(0, modelIndex))
	}, [product, modelUrlOverride, modelIndex])

	const [failoverIdx, setFailoverIdx] = useState(0)
	const modelUrl = candidates[failoverIdx] ?? null
	const candidatesLenRef = useRef(0)
	candidatesLenRef.current = candidates.length

	const [scriptReady, setScriptReady] = useState(false)
	const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
	const [inViewport, setInViewport] = useState(false)
	const [modelLoadFailed, setModelLoadFailed] = useState(false)
	const [modelLoaded, setModelLoaded] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const modelViewerRef = useRef<any>(null)
	const releaseQueueSlotRef = useRef<null | (() => void)>(null)

	useEffect(() => {
		setFailoverIdx(0)
		setModelLoadFailed(false)
	}, [product.id, modelUrlOverride, modelIndex])

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

	useEffect(() => {
		if (!modelUrl || !scriptReady || !inViewport) return
		// Не сбрасываем состояние на каждом пересечении viewport:
		// иначе спиннер может "залипать" поверх уже загруженной модели.
		setModelLoadFailed(false)
		if (resolvedSrc !== modelUrl) {
			setModelLoaded(false)
			let cancelled = false
			modelLoadQueue.acquire().then((release) => {
				if (cancelled) {
					release()
					return
				}
				releaseQueueSlotRef.current = release
				// Для стабильной загрузки на Safari/iOS и S3 с range-ответами
				// передаем model-viewer прямой URL, без промежуточного blob.
				setResolvedSrc(modelUrl)
			})
			return () => {
				cancelled = true
			}
		}
	}, [modelUrl, scriptReady, inViewport, resolvedSrc])

	useEffect(() => {
		const el = modelViewerRef.current as HTMLElement | null
		if (!el || !resolvedSrc) return
		const onLoad = () => {
			setModelLoaded(true)
			setModelLoadFailed(false)
			if (releaseQueueSlotRef.current) {
				releaseQueueSlotRef.current()
				releaseQueueSlotRef.current = null
			}
		}
		const onError = () => {
			setModelLoaded(false)
			if (releaseQueueSlotRef.current) {
				releaseQueueSlotRef.current()
				releaseQueueSlotRef.current = null
			}
			setFailoverIdx((i) => {
				const next = i + 1
				if (next < candidatesLenRef.current) {
					return next
				}
				queueMicrotask(() => {
					setModelLoadFailed(true)
				})
				return i
			})
		}
		el.addEventListener('load', onLoad)
		el.addEventListener('error', onError)
		return () => {
			el.removeEventListener('load', onLoad)
			el.removeEventListener('error', onError)
		}
	}, [resolvedSrc])

	useEffect(() => {
		return () => {
			if (releaseQueueSlotRef.current) {
				releaseQueueSlotRef.current()
				releaseQueueSlotRef.current = null
			}
		}
	}, [])

	const setupRef = useCallback((el: any) => {
		modelViewerRef.current = el
	}, [])

	const TRANSPARENT_PIXEL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
	const hasModel =
		!!modelUrl &&
		isValidUrl(modelUrl) &&
		scriptReady &&
		resolvedSrc !== null &&
		!modelLoadFailed
	const isLoading = inViewport && !resolvedSrc
	// Показываем крутилку только пока модель реально не загружена и карточка в viewport.
	const isViewerLoading = hasModel && inViewport && !modelLoaded

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
					className="relative w-full h-full cursor-grab active:cursor-grabbing"
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
					{isViewerLoading && (
						<div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50/80'>
							<div className='animate-spin rounded-full h-8 w-8 border-2 border-main1 border-t-transparent' />
							<span className='text-xs text-gray'>Загрузка 3D...</span>
						</div>
					)}
				</div>
			) : isLoading ? (
				<div className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={onClick}>
					<div className='animate-spin rounded-full h-8 w-8 border-2 border-main1 border-t-transparent' />
					<span className='text-xs text-gray'>Загрузка 3D...</span>
				</div>
			) : fallbackPosterUrl ? (
				<button
					type='button'
					className='relative w-full h-full min-h-[200px] cursor-pointer'
					onClick={onClick}
				>
					{/* eslint-disable-next-line @next/next/no-img-element -- внешние URL с API */}
					<img
						src={fallbackPosterUrl}
						alt=''
						className='absolute inset-0 w-full h-full object-cover'
					/>
					<div className='absolute inset-0 flex items-center justify-center bg-black/35 px-2'>
						<span className='text-xs text-white drop-shadow text-center'>
							3D недоступно — показано фото. Частая причина: срок ссылки (auth_key) на чужом CDN истёк — загрузите GLB в каталог или своё хранилище.
						</span>
					</div>
				</button>
			) : (
				<div
					className="w-full h-full min-h-[200px] cursor-pointer flex items-center justify-center text-xs text-gray px-2 text-center"
					onClick={onClick}
				>
					3D недоступно (проверьте ссылку или загрузите GLB)
				</div>
			)}
		</div>
	)
}
