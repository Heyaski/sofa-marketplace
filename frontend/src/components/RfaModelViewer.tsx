'use client'

import { Product } from '@/types'

interface RfaModelViewerProps {
	product: Product
	className?: string
	onDownload?: () => void
}

function getFileName(url?: string | null): string | null {
	if (!url) return null
	try {
		const clean = url.split('?')[0]
		const name = clean.substring(clean.lastIndexOf('/') + 1)
		return name || null
	} catch {
		return null
	}
}

export default function RfaModelViewer({ product, className = '', onDownload }: RfaModelViewerProps) {
	const hasRfa = !!product.model_rfa
	const fileName = getFileName(product.model_rfa)

	return (
		<div className={`bg-gray-bg rounded-lg overflow-hidden min-h-[180px] max-h-[300px] p-4 flex flex-col ${className}`}>
			<div className='text-xs font-semibold uppercase tracking-wide text-gray mb-2'>RFA Viewer</div>
			<div className='flex-1 flex flex-col items-center justify-center text-center gap-2'>
				<div className='text-4xl leading-none'>🧩</div>
				<div className='text-sm font-medium text-black'>Revit Family (.rfa)</div>
				{hasRfa ? (
					<>
						<div className='text-xs text-gray break-all'>
							{fileName || 'Файл доступен'}
						</div>
						<div className='text-xs text-gray px-2'>
							RFA не рендерится в браузере как 3D. Файл доступен для скачивания и открытия в Revit.
						</div>
					</>
				) : (
					<div className='text-xs text-gray'>RFA-файл для этого товара не добавлен</div>
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

