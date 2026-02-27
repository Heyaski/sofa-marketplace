'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Product } from '../types'

const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']

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
	const containerRef = useRef<HTMLDivElement>(null)
	const modelViewerRef = useRef<any>(null)

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

	const setupRef = useCallback((el: any) => {
		modelViewerRef.current = el
	}, [])

	// Каталог/страница товара: прозрачная заглушка пока 3D загружается, затем только 3D (без заглушки).
	// Корзина/КП используют product.image (фото), не этот компонент.
	const TRANSPARENT_PIXEL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
	const shouldShow3D = !!modelUrl && isValidUrl(modelUrl) && scriptReady

	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : 'aspect-square sm:min-h-[400px]'} ${className}`

	// Без 3D или пока загружается — прозрачная заглушка (убирается, когда 3D отображается)
	if (!shouldShow3D) {
		return (
			<div ref={containerRef} className={`${containerClass} cursor-pointer`} onClick={onClick} aria-hidden />
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
				src={modelUrl}
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
