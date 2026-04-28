'use client'

import { Product } from '@/types'
import ProductModelViewer, { getRfaPreviewModelUrl } from './ProductModelViewer'
import IfcModelViewer from './IfcModelViewer'
import { getIfcViewerUrl, hasDownloadableRfa } from '@/utils/productModelFiles'

interface RfaModelViewerProps {
	product: Product
	className?: string
	onDownload?: () => void
}

export default function RfaModelViewer({ product, className = '', onDownload }: RfaModelViewerProps) {
	const ifcUrl = getIfcViewerUrl(product)
	const hasRfaFile = hasDownloadableRfa(product)
	const modelPreviewUrl = getRfaPreviewModelUrl(product)
	const cs = product.model_rfa_convert_status

	let secondaryHint: string | null = null
	if (hasRfaFile && !modelPreviewUrl && !ifcUrl) {
		if (cs === 'queued' || cs === 'processing')
			secondaryHint = 'Готовится GLB-превью из Revit-модели…'
		else if (cs === 'failed')
			secondaryHint = product.model_rfa_convert_error
				? `Конвертация не удалась: ${product.model_rfa_convert_error.slice(0, 280)}`
				: 'Конвертация превью не удалась. Файл .rfa всё равно можно скачать ниже.'
	}

	return (
		<div className={`bg-gray-bg rounded-lg overflow-hidden min-h-[180px] max-h-[300px] p-4 flex flex-col ${className}`}>
			<div className='flex-1 flex flex-col items-center justify-center text-center gap-2'>
				{ifcUrl ? (
					<div className='w-full h-full min-h-[160px]'>
						<IfcModelViewer ifcUrl={ifcUrl} />
					</div>
				) : modelPreviewUrl ? (
					<div className='w-full h-full min-h-[160px]'>
						<ProductModelViewer
							product={product}
							variant='page'
							compact
							modelUrlOverride={modelPreviewUrl}
						/>
					</div>
				) : (
					<>
						<div className='text-4xl leading-none'>🧩</div>
						<div className='text-sm font-medium text-black'>
							{hasRfaFile ? 'Файла IFC для просмотра нет (есть только .rfa)' : 'Нет IFC / превью'}
						</div>
					</>
				)}
				{secondaryHint && <div className='text-xs text-gray px-2'>{secondaryHint}</div>}
				{!hasRfaFile && (
					<div className='text-xs text-gray'>Файл .rfa для этого товара не добавлен</div>
				)}
			</div>
			<button
				type='button'
				onClick={onDownload}
				disabled={!hasRfaFile}
				className='mt-3 py-2 px-3 text-sm rounded-lg border border-gray2 text-black bg-white hover:bg-gray-bg hover:border-main1 hover:text-main1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
			>
				{hasRfaFile ? 'Скачать .rfa' : 'Файл .rfa недоступен'}
			</button>
		</div>
	)
}
