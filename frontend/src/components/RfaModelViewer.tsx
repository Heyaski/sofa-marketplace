'use client'

import { Product } from '@/types'
import ProductModelViewer, { getRfaPreviewModelUrl } from './ProductModelViewer'

interface RfaModelViewerProps {
	product: Product
	className?: string
	onDownload?: () => void
}

export default function RfaModelViewer({ product, className = '', onDownload }: RfaModelViewerProps) {
	const hasRfa = !!product.model_rfa
	const rfaPreviewUrl = getRfaPreviewModelUrl(product)

	return (
		<div className={`bg-gray-bg rounded-lg overflow-hidden min-h-[180px] max-h-[300px] p-4 flex flex-col ${className}`}>
			<div className='text-xs font-semibold uppercase tracking-wide text-gray mb-2'>RFA Viewer</div>
			<div className='flex-1 flex flex-col items-center justify-center text-center gap-2'>
				{rfaPreviewUrl ? (
					<div className='w-full h-full min-h-[160px]'>
						<ProductModelViewer
							product={product}
							variant='page'
							compact
							modelUrlOverride={rfaPreviewUrl}
						/>
					</div>
				) : (
					<>
						<div className='text-4xl leading-none'>🧩</div>
						<div className='text-sm font-medium text-black'>Revit Family (.rfa)</div>
					</>
				)}
				{hasRfa && !rfaPreviewUrl ? (
					<div className='text-xs text-gray px-2'>Файл доступен для скачивания</div>
				) : (
					!hasRfa && <div className='text-xs text-gray'>RFA-файл для этого товара не добавлен</div>
				)}
			</div>
			<button
				type='button'
				onClick={onDownload}
				disabled={!hasRfa}
				className='mt-3 py-2 px-3 text-sm rounded-lg border border-gray2 text-black bg-white hover:bg-gray-bg hover:border-main1 hover:text-main1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
			>
				{hasRfa ? 'Скачать RFA' : 'RFA недоступен'}
			</button>
		</div>
	)
}

