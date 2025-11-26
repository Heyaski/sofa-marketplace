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
	const [isLoading, setIsLoading] = useState(true)
	const [isScriptReady, setIsScriptReady] = useState(false)
	const [loadProgress, setLoadProgress] = useState(0)

	// Динамически импортируем @google/model-viewer на клиенте
	useEffect(() => {
		if (!isOpen) return

		let cancelled = false

		const loadScript = async () => {
			try {
				// Импортируем web-component один раз на клиенте
				await import('@google/model-viewer')
				if (!cancelled) {
					console.log('model-viewer component registered via @google/model-viewer')
					setIsScriptReady(true)
				}
			} catch (e) {
				console.error('Failed to load @google/model-viewer:', e)
				if (!cancelled) {
					setError(
						'Не удалось загрузить компонент 3D просмотра. Пожалуйста, обновите страницу или проверьте подключение к интернету.'
					)
					setIsLoading(false)
				}
			}
		}

		loadScript()

		return () => {
			cancelled = true
		}
	}, [isOpen])

	useEffect(() => {
		if (isOpen && models.length > 0) {
			setSelectedModelIndex(0)
			setError(null)
			setIsLoading(true)
			setLoadProgress(0)
			// Отладочная информация
			console.log('3D Models:', models)
			console.log('Selected model URL:', models[0]?.file_url)

			// Таймаут для загрузки модели (30 секунд)
			const loadTimeout = setTimeout(() => {
				setIsLoading((prevLoading) => {
					if (prevLoading) {
						console.warn('Model loading timeout after 30 seconds')
						setError(
							'Загрузка модели занимает слишком много времени. Возможно, файл слишком большой или недоступен. Попробуйте обновить страницу или проверить подключение к интернету.'
						)
						return false
					}
					return prevLoading
				})
			}, 30000)

			return () => clearTimeout(loadTimeout)
		}
	}, [isOpen, models])

	// Упрощённо: без DOM-поллинга, полагаемся на события model-viewer

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

	const handleModelError = (e?: Event) => {
		console.error('Model viewer error:', e)
		console.error('Model URL:', selectedModel.file_url)
		setError(
			`Не удалось загрузить 3D модель. Проверьте консоль браузера для деталей. URL: ${selectedModel.file_url}`
		)
		setIsLoading(false)
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
						{isLoading && !error && loadProgress === 0 ? (
							<div className='text-center p-8'>
								<div className='inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mb-4'></div>
								<p className='text-gray'>Загрузка 3D модели...</p>
								<p className='text-xs text-gray mt-2'>
									Пожалуйста, подождите. Это может занять некоторое время.
								</p>
							</div>
						) : error ? (
							<div className='text-center p-8'>
								<p className='text-red-500 mb-4'>{error}</p>
								<div className='text-xs text-gray mb-4 break-all'>
									URL: {selectedModel.file_url}
								</div>
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
								<div className='text-xs text-gray mb-4 break-all'>
									URL: {selectedModel.file_url}
								</div>
								<button
									onClick={handleDownload}
									className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main1/90 transition-colors'
								>
									Скачать файл
								</button>
							</div>
						) : !isScriptReady ? (
							<div className='text-center p-8'>
								<div className='inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mb-4'></div>
								<p className='text-gray'>Инициализация 3D просмотра...</p>
								<p className='text-xs text-gray mt-2'>
									Ожидание загрузки скрипта model-viewer...
								</p>
							</div>
						) : (
							<>
								<model-viewer
									id={`model-viewer-${selectedModelIndex}`}
									src={selectedModel.file_url}
									alt={selectedModel.description || productTitle || '3D Model'}
									camera-controls
									auto-rotate
									ar
									shadow-intensity='1'
									interaction-policy='allow-when-focused'
									loading='eager'
									reveal='interaction'
									style={{
										width: '100%',
										height: '100%',
										backgroundColor: '#f3f4f6',
										display: 'block',
									}}
									onError={(e: any) => {
										console.error('Model viewer error:', e)
										console.error('Error details:', e.detail)
										console.error('Error type:', e.type)
										console.error('Error target:', e.target)
										handleModelError(e)
									}}
									onLoad={(e: any) => {
										console.log('✅ Model loaded successfully (onLoad event):', selectedModel.file_url)
										console.log('Load event details:', e)
										setIsLoading(false)
										setError(null)
										setLoadProgress(100)
									}}
									onProgress={(e: any) => {
										const progress = e.detail?.totalProgress || 0
										const progressPercent = Math.round(progress * 100)
										setLoadProgress(progressPercent)
										console.log('📊 Model loading progress:', progressPercent + '%')
										// Если прогресс больше 5%, скрываем основной индикатор загрузки
										if (progress > 0.05) {
											setIsLoading(false)
										}
									}}
								/>
								{/* Индикатор прогресса загрузки */}
								{isLoading && loadProgress > 0 && (
									<div className='absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg z-10'>
										<div className='text-sm'>Загрузка: {loadProgress}%</div>
										<div className='w-48 h-2 bg-gray-700 rounded-full mt-2'>
											<div
												className='h-2 bg-main1 rounded-full transition-all duration-300'
												style={{ width: `${loadProgress}%` }}
											></div>
										</div>
									</div>
								)}
								{/* Отладочная информация в режиме разработки */}
								{process.env.NODE_ENV === 'development' && (
									<div className='absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded z-10 max-w-xs break-all'>
										<div>URL: {selectedModel.file_url}</div>
										<div>Format: {modelFormat}</div>
										<div>Script ready: {isScriptReady ? 'Yes' : 'No'}</div>
										<div>Loading: {isLoading ? 'Yes' : 'No'}</div>
										<div>Progress: {loadProgress}%</div>
									</div>
								)}
							</>
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

