'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
/** Cache-bust после оптимизации gltfpack */
const GLB_VERSION = 'v=opt3'
const addCacheBust = (url: string) => url + (url.includes('?') ? '&' : '?') + GLB_VERSION

export default function ModelViewerModal({
	isOpen,
	onClose,
	models,
	productTitle,
}: ModelViewerModalProps) {
	const [selectedModelIndex, setSelectedModelIndex] = useState(0)

	// Функция для проверки, является ли URL валидным HTTP URL
	const isValidHttpUrl = useCallback(
		(url: string | null | undefined): boolean => {
			if (!url) return false
			const urlLower = url.toLowerCase()
			return (
				urlLower.startsWith('http://') ||
				urlLower.startsWith('https://') ||
				urlLower.startsWith('/')
			)
		},
		[]
	)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isScriptReady, setIsScriptReady] = useState(false)
	const [loadProgress, setLoadProgress] = useState(0)
	const modelViewerRef = useRef<any>(null)
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Динамически импортируем @google/model-viewer на клиенте
	useEffect(() => {
		if (!isOpen) return

		let cancelled = false

		const loadScript = async () => {
			try {
				// Импортируем web-component один раз на клиенте
				await import('@google/model-viewer')
				if (!cancelled) {
					console.log(
						'model-viewer component registered via @google/model-viewer'
					)
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
		// Фильтруем поддерживаемые модели
		const supported = models.filter(model => {
			if (!model.file_url || !isValidHttpUrl(model.file_url)) return false
			const url = model.file_url.toLowerCase()
			const ext = url.substring(url.lastIndexOf('.') + 1).split('?')[0]
			return MODEL_VIEWER_FORMATS.includes(ext)
		})

		if (isOpen && supported.length > 0) {
			setSelectedModelIndex(0)
			setError(null)
			setIsLoading(true)
			setLoadProgress(0)
			// Отладочная информация
			console.log('3D Models (all):', models)
			console.log('3D Models (supported):', supported)
			console.log('Selected model URL:', supported[0]?.file_url)

			// Таймаут для загрузки модели (60 секунд)
			timeoutRef.current = setTimeout(() => {
				setIsLoading(prevLoading => {
					if (prevLoading) {
						console.warn('Model loading timeout after 60 seconds')
						setError(
							'Загрузка модели занимает слишком много времени. Возможно, файл слишком большой или недоступен. Попробуйте обновить страницу или проверить подключение к интернету.'
						)
						return false
					}
					return prevLoading
				})
			}, 60000)

			return () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current)
				}
			}
		}
	}, [isOpen, models])

	// Подключаем события к model-viewer через ref
	const setupModelViewer = useCallback((element: any) => {
		if (!element) return

		modelViewerRef.current = element
		console.log('Model viewer element mounted, src:', element.src)

		const handleLoad = () => {
			console.log('✅ Model loaded successfully!')
			setIsLoading(false)
			setError(null)
			setLoadProgress(100)
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}

		const handleError = (event: any) => {
			console.error('❌ Model viewer error:', event)
			setError(`Не удалось загрузить 3D модель. URL: ${element.src}`)
			setIsLoading(false)
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}

		const handleProgress = (event: any) => {
			const progress = event.detail?.totalProgress || 0
			const progressPercent = Math.round(progress * 100)
			console.log('📊 Model loading progress:', progressPercent + '%')
			setLoadProgress(progressPercent)
			if (progress > 0.05) {
				setIsLoading(false)
			}
		}

		// Добавляем слушатели событий
		element.addEventListener('load', handleLoad)
		element.addEventListener('error', handleError)
		element.addEventListener('progress', handleProgress)

		// Cleanup
		return () => {
			element.removeEventListener('load', handleLoad)
			element.removeEventListener('error', handleError)
			element.removeEventListener('progress', handleProgress)
		}
	}, [])

	// Фильтруем модели, оставляя только поддерживаемые форматы
	const supportedModels = models.filter(model => {
		if (!model.file_url) return false
		const url = model.file_url.toLowerCase()
		// Проверяем, что это HTTP URL, а не локальный путь
		if (
			!url.startsWith('http://') &&
			!url.startsWith('https://') &&
			!url.startsWith('/')
		) {
			return false
		}
		const ext = url.substring(url.lastIndexOf('.') + 1).split('?')[0] // Убираем query параметры
		return MODEL_VIEWER_FORMATS.includes(ext)
	})

	if (!isOpen || supportedModels.length === 0) {
		// Если нет поддерживаемых моделей, показываем сообщение
		if (isOpen && models.length > 0) {
			return (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
					<div className='bg-white rounded-3xl max-w-2xl w-full p-6'>
						<div className='flex justify-between items-center mb-4'>
							<h2 className='text-xl font-bold text-black'>
								{productTitle ? `3D Просмотр: ${productTitle}` : '3D Просмотр'}
							</h2>
							<button
								onClick={onClose}
								className='text-black hover:text-gray transition-colors text-4xl font-light'
							>
								×
							</button>
						</div>
						<div className='text-center p-8'>
							<p className='text-gray mb-4'>
								Нет поддерживаемых 3D моделей для просмотра в браузере.
							</p>
							<p className='text-sm text-gray mb-4'>
								Поддерживаемые форматы: <strong>.glb</strong>,{' '}
								<strong>.gltf</strong>, <strong>.usdz</strong>
							</p>
							<p className='text-xs text-gray mb-4'>
								Доступные модели:{' '}
								{models
									.map(m => {
										const ext =
											m.file_url
												?.toLowerCase()
												.substring(m.file_url.lastIndexOf('.')) || 'неизвестно'
										return ext
									})
									.join(', ')}
							</p>
							<button
								onClick={onClose}
								className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main1/90 transition-colors'
							>
								Закрыть
							</button>
						</div>
					</div>
				</div>
			)
		}
		return null
	}

	// Обновляем индекс выбранной модели, если он выходит за границы
	const validIndex =
		selectedModelIndex >= supportedModels.length ? 0 : selectedModelIndex
	const selectedModel = supportedModels[validIndex]

	// Определяем формат для model-viewer
	const getModelFormat = (url: string): string | null => {
		if (!url) return null
		const urlLower = url.toLowerCase()
		const ext = urlLower.substring(urlLower.lastIndexOf('.') + 1).split('?')[0] // Убираем query параметры
		if (MODEL_VIEWER_FORMATS.includes(ext)) {
			return ext
		}
		return null
	}

	const modelFormat = getModelFormat(selectedModel.file_url)
	const isSupported = modelFormat !== null

	const handleDownload = () => {
		window.open(selectedModel.file_url, '_blank')
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4'>
			<div className='bg-white rounded-t-3xl sm:rounded-3xl max-w-6xl w-full max-h-[90vh] sm:max-h-[90vh] flex flex-col'>
				{/* Header */}
				<div className='flex justify-between items-center p-4 sm:p-6 border-b border-gray-200'>
					<div className='flex-1 min-w-0 pr-2'>
						<h2 className='text-lg sm:text-xl font-bold text-black truncate'>
							{productTitle ? `3D Просмотр: ${productTitle}` : '3D Просмотр'}
						</h2>
						{selectedModel.description && (
							<p className='text-sm text-gray mt-1'>
								{selectedModel.description}
							</p>
						)}
					</div>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors text-3xl sm:text-4xl font-light flex-shrink-0'
					>
						×
					</button>
				</div>

				{/* Content */}
				<div className='flex-1 overflow-hidden flex flex-col'>
					{/* Model Viewer */}
					<div className='flex-1 bg-gray-100 flex items-center justify-center min-h-[400px] relative'>
						{/* Показываем ошибку */}
						{error ? (
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
							/* Формат не поддерживается */
							<div className='text-center p-8'>
								<p className='text-gray mb-4'>
									Формат{' '}
									{selectedModel.file_url
										?.toLowerCase()
										.substring(selectedModel.file_url.lastIndexOf('.')) ||
										'неизвестно'}{' '}
									не поддерживается для просмотра в браузере.
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
							/* Скрипт еще не загружен */
							<div className='text-center p-8'>
								<div className='inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mb-4'></div>
								<p className='text-gray'>Инициализация 3D просмотра...</p>
								<p className='text-xs text-gray mt-2'>
									Ожидание загрузки скрипта model-viewer...
								</p>
							</div>
						) : (
							/* Рендерим model-viewer сразу после загрузки скрипта */
							<>
								<model-viewer
									ref={setupModelViewer}
									id={`model-viewer-${validIndex}`}
									src={addCacheBust(selectedModel.file_url)}
									alt={
										selectedModel.description ||
										selectedModel.asset_id ||
										productTitle ||
										'3D Model'
									}
									camera-controls
									auto-rotate
									shadow-intensity='1'
									loading='eager'
									reveal='auto'
									interaction-policy='allow-when-focused'
									style={{
										width: '100%',
										height: '100%',
										minHeight: '400px',
										backgroundColor: '#f3f4f6',
										display: 'block',
									}}
								/>
								{/* Индикатор загрузки поверх model-viewer */}
								{isLoading && (
									<div className='absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10'>
										<div className='text-center p-8'>
											<div className='inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mb-4'></div>
											<p className='text-gray'>Загрузка 3D модели...</p>
											{loadProgress > 0 && (
												<>
													<div className='text-sm mt-2'>
														Загрузка: {loadProgress}%
													</div>
													<div className='w-48 h-2 bg-gray-300 rounded-full mt-2 mx-auto'>
														<div
															className='h-2 bg-main1 rounded-full transition-all duration-300'
															style={{ width: `${loadProgress}%` }}
														></div>
													</div>
												</>
											)}
										</div>
									</div>
								)}
							</>
						)}
					</div>

					{/* Model selector - если есть несколько поддерживаемых моделей */}
					{supportedModels.length > 1 && (
						<div className='border-t border-gray-200 p-4'>
							<div className='flex gap-2 overflow-x-auto pb-2'>
								{supportedModels.map((model, index) => {
									const ext = model.file_url
										.toLowerCase()
										.substring(model.file_url.lastIndexOf('.'))
									const modelFormat = getModelFormat(model.file_url)
									const isModelSupported = modelFormat !== null
									const isSelected = validIndex === index

									return (
										<button
											key={index}
											onClick={() => {
												// Находим индекс в исходном массиве models
												const originalIndex = models.findIndex(
													m => m.file_url === model.file_url
												)
												setSelectedModelIndex(
													originalIndex >= 0 ? originalIndex : index
												)
												setError(null)
												setIsLoading(true)
											}}
											className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-colors ${
												isSelected
													? 'border-main1 bg-main1/10 text-main1'
													: 'border-gray-300 bg-white text-black hover:border-main1'
											}`}
										>
											<div className='text-sm font-medium'>
												{model.description ||
													model.asset_id ||
													`Модель ${index + 1}`}
											</div>
											<div className='text-xs text-gray mt-1'>{ext}</div>
										</button>
									)
								})}
							</div>
						</div>
					)}

					{/* Controls info */}
					<div className='border-t border-gray-200 p-4 bg-gray-50'>
						<div className='text-xs text-gray text-center'>
							💡 Используйте мышь для вращения, колесико для масштабирования,
							зажмите правую кнопку для перемещения
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
