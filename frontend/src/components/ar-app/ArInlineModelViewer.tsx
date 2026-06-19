'use client'

import { resolveFbxUrl, resolveGlbUrl } from '@/lib/arApp/modelUrls'
import type { Product } from '@/types'
import { useEffect, useState } from 'react'
import ArFbxViewer from './ArFbxViewer'

type ArInlineModelViewerProps = {
	product: Product
}

/**
 * iOS / Android: GLB через model-viewer (3D + AR в комнате).
 * Только FBX: интерактивный 3D-просмотр (без USDZ).
 */
export default function ArInlineModelViewer({ product }: ArInlineModelViewerProps) {
	const [ready, setReady] = useState(false)
	const glbUrl = resolveGlbUrl(product)
	const fbxUrl = resolveFbxUrl(product)

	useEffect(() => {
		if (!glbUrl) return
		import('@google/model-viewer').then(() => setReady(true))
	}, [glbUrl])

	if (glbUrl) {
		return (
			<div className='space-y-3'>
				{ready ? (
					<model-viewer
						src={glbUrl}
						ar
						ar-modes='quick-look webxr scene-viewer'
						camera-controls
						shadow-intensity='1'
						loading='eager'
						reveal='auto'
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
				<p className='text-xs text-gray text-center'>
					Нажмите иконку AR в углу модели, чтобы примерить в комнате (GLB).
				</p>
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
