'use client'

import Image from 'next/image'
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

	// Фотографии показываем ТОЛЬКО в корзине/КП. В каталоге и на странице товара — только заглушки.
	const placeholderUrl = '/img/sofa-card.svg'
	const shouldShow3D = !!modelUrl && isValidUrl(modelUrl) && scriptReady

	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : 'aspect-square sm:min-h-[400px]'} ${className}`

	// Без 3D модели или пока она загружается — показываем заглушку (никогда фото товара)
	if (!shouldShow3D) {
		return (
			<div ref={containerRef} className={`${containerClass} cursor-pointer`} onClick={onClick}>
				<Image
					src={placeholderUrl}
					alt='Заглушка'
					width={variant === 'card' ? 300 : 600}
					height={variant === 'card' ? 300 : 600}
					className='w-full h-full object-contain opacity-70'
				/>
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
				src={modelUrl}
				poster={placeholderUrl}
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
