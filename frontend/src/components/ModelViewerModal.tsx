'use client'

import { useEffect, useState } from 'react'
import { FileAsset } from '../types'

interface ModelViewerModalProps {
	isOpen: boolean
	onClose: () => void
	models: FileAsset[]
	productTitle?: string
}

// Поддерживаемые форматы для model-viewer
const SUPPORTED_FORMATS = ['.glb', '.gltf', '.usdz']
const MODEL_VIEWER_FORMATS = ['glb', 'gltf', 'usdz']

export default function ModelViewerModal({
	isOpen,
	onClose,
	models,
	productTitle,
}: ModelViewerModalProps) {
	const [selectedModelIndex, setSelectedModelIndex] = useState(0)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen && models.length > 0) {
			setSelectedModelIndex(0)
			setError(null)
		}
	}, [isOpen, models])

	if (!isOpen || models.length === 0) return null

	const selectedModel = models[selectedModelIndex]
	const fileExtension = selectedModel.file_url
		.toLowerCase()
		.substring(selectedModel.file_url.lastIndexOf('.'))
	
	// Определяем формат для model-viewer
	const getModelFormat = (url: string): string | null => {
		const ext = url.toLowerCase().substring(url.lastIndexOf('.') + 1)
		if (MODEL_VIEWER_FORMATS.includes(ext)) {
			return ext
		}
		return null
	}

	const modelFormat = getModelFormat(selectedModel.file_url)
	const isSupported = modelFormat !== null

	const handleModelError = () => {
		setError('Не удалось загрузить 3D модель. Возможно, формат не поддерживается.')
	}

	const handleDownload = () => {
		window.open(selectedModel.file_url, '_blank')
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col'>
				{/* Header */}
				<div className='flex justify-between items-center p-6 border-b border-gray-200'>
					<div>
						<h2 className='text-xl font-bold text-black'>
							{productTitle ? `3D Просмотр: ${productTitle}` : '3D Просмотр'}
						</h2>
						{selectedModel.description && (
							<p className='text-sm text-gray mt-1'>{selectedModel.description}</p>
						)}
					</div>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors text-4xl font-light'
					>
						×
					</button>
				</div>

				{/* Content */}
				<div className='flex-1 overflow-hidden flex flex-col'>
					{/* Model Viewer */}
					<div className='flex-1 bg-gray-100 flex items-center justify-center min-h-[400px] relative'>
						{error ? (
							<div className='text-center p-8'>
								<p className='text-red-500 mb-4'>{error}</p>
								<button
									onClick={handleDownload}
									className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main1/90 transition-colors'
								>
									Скачать файл
								</button>
							</div>
						) : !isSupported || !modelFormat ? (
							<div className='text-center p-8'>
								<p className='text-gray mb-4'>
									Формат {fileExtension} не поддерживается для просмотра в браузере.
								</p>
								<p className='text-sm text-gray mb-4'>
									Поддерживаемые форматы: .glb, .gltf, .usdz
								</p>
								<button
									onClick={handleDownload}
									className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main1/90 transition-colors'
								>
									Скачать файл
								</button>
							</div>
						) : (
							<model-viewer
								src={selectedModel.file_url}
								alt={selectedModel.description || productTitle || '3D Model'}
								camera-controls
								auto-rotate
								ar
								shadow-intensity='1'
								style={{
									width: '100%',
									height: '100%',
									backgroundColor: '#f3f4f6',
								}}
								onError={handleModelError}
							/>
						)}
					</div>

					{/* Model selector - если есть несколько моделей */}
					{models.length > 1 && (
						<div className='border-t border-gray-200 p-4'>
							<div className='flex gap-2 overflow-x-auto pb-2'>
								{models.map((model, index) => {
									const ext = model.file_url
										.toLowerCase()
										.substring(model.file_url.lastIndexOf('.'))
									const modelFormat = getModelFormat(model.file_url)
									const isModelSupported = modelFormat !== null

									return (
										<button
											key={index}
											onClick={() => {
												setSelectedModelIndex(index)
												setError(null)
											}}
											className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-colors ${
												selectedModelIndex === index
													? 'border-main1 bg-main1/10 text-main1'
													: 'border-gray-300 bg-white text-black hover:border-main1'
											}`}
										>
											<div className='text-sm font-medium'>
												{model.description || `Модель ${index + 1}`}
											</div>
											<div className='text-xs text-gray mt-1'>
												{ext}
												{!isModelSupported && ' (не поддерживается)'}
											</div>
										</button>
									)
								})}
							</div>
						</div>
					)}

					{/* Controls info */}
					<div className='border-t border-gray-200 p-4 bg-gray-50'>
						<div className='text-xs text-gray text-center'>
							💡 Используйте мышь для вращения, колесико для масштабирования, зажмите
							правую кнопку для перемещения
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

