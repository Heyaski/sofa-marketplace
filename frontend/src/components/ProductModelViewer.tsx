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
	/** При нескольких изображениях — какой показывать (URL) */
	selectedImageUrl?: string | null
}

export default function ProductModelViewer({
	product,
	variant = 'card',
	className = '',
	onClick,
	selectedImageUrl,
}: ProductModelViewerProps) {
	const modelUrl = getModelUrl(product)
	const [scriptReady, setScriptReady] = useState(false)
	const modelViewerRef = useRef<any>(null)

	// Загружаем model-viewer при наличии 3D модели — сразу, без ожидания
	useEffect(() => {
		if (!modelUrl) return
		let cancelled = false
		import('@google/model-viewer').then(() => {
			if (!cancelled) setScriptReady(true)
		}).catch(() => {})
		return () => { cancelled = true }
	}, [modelUrl])

	const setupRef = useCallback((el: any) => {
		modelViewerRef.current = el
	}, [])

	const defaultImage = product.image || product.asset_images?.[0]?.file_url || product.photo_url
	const fallbackImage = selectedImageUrl ?? defaultImage
	const has3D = !!modelUrl && isValidUrl(modelUrl) && scriptReady

	const containerClass = `overflow-hidden bg-gray-50 flex items-center justify-center ${variant === 'card' ? 'aspect-square' : 'aspect-square sm:min-h-[400px]'} ${className}`

	if (!has3D) {
		return (
			<div className={`${containerClass} cursor-pointer`} onClick={onClick}>
				{fallbackImage ? (
					<Image
						src={fallbackImage}
						alt={product.title || 'Товар'}
						width={variant === 'card' ? 300 : 600}
						height={variant === 'card' ? 300 : 600}
						className='w-full h-full object-contain'
						unoptimized
					/>
				) : (
					<Image
						src='/img/sofa-card.svg'
						alt='Заглушка'
						width={300}
						height={300}
						className='w-full h-full object-contain opacity-70'
					/>
				)}
			</div>
		)
	}

	return (
		<div
			className={`${containerClass} cursor-grab active:cursor-grabbing`}
			onClick={(e) => e.stopPropagation()}
		>
			<model-viewer
				ref={setupRef}
				src={modelUrl}
				alt={product.title || '3D модель'}
				camera-controls
				shadow-intensity='1'
				loading='eager'
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
