'use client'

import { config } from '@/config'
import { authService, downloadService } from '@/services/api'
import { Download, User } from '@/types'
import {
	ArrowDownTrayIcon,
	EyeIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import UpgradeSubscriptionModal from './UpgradeSubscriptionModal'

export default function DownloadsList() {
	const router = useRouter()
	const [downloads, setDownloads] = useState<Download[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedFormats, setSelectedFormats] = useState<
		Record<number, string>
	>({})
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
	const [upgradeModalMessage, setUpgradeModalMessage] = useState<string>('')
	const [currentUser, setCurrentUser] = useState<User | null>(null)

	useEffect(() => {
		fetchDownloads()
		fetchCurrentUser()
	}, [])

	const fetchCurrentUser = async () => {
		try {
			const userData = await authService.getCurrentUser()
			setCurrentUser(userData)
		} catch (error) {
			console.error('Ошибка при загрузке пользователя:', error)
		}
	}

	const fetchDownloads = async () => {
		try {
			const response = await downloadService.getDownloads()
			// Проверяем формат ответа (может быть массив или объект с results)
			if (response && response.results && Array.isArray(response.results)) {
				setDownloads(response.results)
			} else if (Array.isArray(response)) {
				setDownloads(response)
			} else {
				setDownloads([])
			}
		} catch (error) {
			console.error('Ошибка при загрузке истории загрузок:', error)
			setDownloads([])
		} finally {
			setLoading(false)
		}
	}

	const handleFormatChange = (downloadId: number, format: string) => {
		setSelectedFormats(prev => ({
			...prev,
			[downloadId]: format,
		}))
	}

	const handleDownload = async (productId: number, format: string) => {
		try {
			const response = await fetch(`${config.API_URL}/api/downloads/presign/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: localStorage.getItem('access_token')
						? `Bearer ${localStorage.getItem('access_token')}`
						: '',
				},
				body: JSON.stringify({
					product_id: productId,
					format: format,
				}),
			})

			const contentType = response.headers.get('content-type')
			if (!contentType || !contentType.includes('application/json')) {
				const text = await response.text()
				console.error('Неожиданный формат ответа:', text.substring(0, 100))
				alert('Ошибка: сервер вернул неверный формат ответа')
				return
			}

			const data = await response.json()

			// Проверяем, достигнут ли лимит скачиваний (403 Forbidden или 500 с сообщением о лимите)
			const isLimitError =
				(response.status === 403 && data.error) ||
				(response.status === 500 &&
					data.error &&
					(data.error.includes('лимит') ||
						data.error.includes('скачиваний') ||
						data.error.includes('подписк')))

			if (isLimitError) {
				// Открываем модальное окно с выбором подписки
				setUpgradeModalMessage(
					data.error ||
						'Достигнут лимит скачиваний для вашей подписки. Обновите подписку для продолжения.'
				)
				setIsUpgradeModalOpen(true)
				return
			}

			if (response.ok && data.url) {
				// Скачиваем изображение через fetch и blob
				const imageResponse = await fetch(data.url)
				if (!imageResponse.ok) {
					throw new Error('Не удалось загрузить изображение')
				}

				const blob = await imageResponse.blob()
				const blobUrl = window.URL.createObjectURL(blob)

				const link = document.createElement('a')
				link.href = blobUrl
				link.download = `product_${productId}_image.jpg`
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)

				window.URL.revokeObjectURL(blobUrl)

				// Обновляем список после скачивания
				await fetchDownloads()
			} else {
				alert(data.error || 'Ошибка при скачивании')
			}
		} catch (error: any) {
			console.error('Ошибка при скачивании:', error)
			alert(error.message || 'Ошибка при скачивании')
		}
	}

	const handleDelete = async (downloadId: number) => {
		try {
			await downloadService.deleteDownload(downloadId)
			// Обновляем список после удаления
			await fetchDownloads()
		} catch (error) {
			console.error('Ошибка при удалении:', error)
			alert('Ошибка при удалении записи')
		}
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	if (loading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
			</div>
		)
	}

	return (
		<div>
			{/* Header with sorting */}
			<div className='flex items-center justify-between mb-6'>
				<h1 className='text-3xl font-bold text-black'>История загрузок</h1>
				<div className='flex items-center gap-2'>
					<span className='text-gray text-sm'>Сортировка:</span>
					<select className='px-4 py-2 border border-gray2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-main1'>
						<option>По дате</option>
						<option>По названию</option>
					</select>
				</div>
			</div>

			{/* Downloads list */}
			<div className='space-y-0'>
				{downloads.length === 0 ? (
					<p className='text-gray text-center py-8'>История загрузок пуста</p>
				) : (
					downloads.map((download, index) => (
						<div
							key={download.id}
							className={`flex items-center gap-4 p-4 ${
								index !== downloads.length - 1 ? 'border-b border-gray2' : ''
							}`}
						>
							{/* Product image */}
							<div className='flex-shrink-0'>
								{download.product.image ? (
									<Image
										src={download.product.image}
										alt={download.product.title || 'Товар'}
										width={120}
										height={120}
										className='w-24 h-24 object-cover rounded-lg bg-gray-bg'
										unoptimized
									/>
								) : (
									<Image
										src='/img/sofa-card.svg'
										alt='Заглушка'
										width={120}
										height={120}
										className='w-24 h-24 object-cover rounded-lg bg-gray-bg'
									/>
								)}
							</div>

							{/* Product name */}
							<div className='w-48'>
								<h3 className='text-base font-medium text-black'>
									{download.product.title || 'Наименование товара'}
								</h3>
							</div>

							{/* Right side - grouped together */}
							<div className='flex items-center gap-4 ml-auto'>
								{/* 3D buttons with formats - 2 rows */}
								<div className='flex flex-col gap-2'>
									{/* First row: 3D Viewer + 2 formats */}
									<div className='flex items-center gap-2'>
										<button className='border-2 border-main1 bg-white text-black px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-xs whitespace-nowrap w-36'>
											Открыть 3D Viewer
										</button>
										{['.fbx', '.glb'].map(format => (
											<label
												key={format}
												className='flex items-center gap-1 cursor-pointer border border-gray2 rounded-lg px-2 py-1.5'
											>
												<input
													type='checkbox'
													checked={
														selectedFormats[download.id] === format ||
														(format === '.fbx' && !selectedFormats[download.id])
													}
													onChange={() =>
														handleFormatChange(download.id, format)
													}
													className='w-3 h-3 text-main1 focus:ring-main1 focus:ring-2 rounded'
												/>
												<span className='text-xs text-black'>{format}</span>
											</label>
										))}
									</div>
									{/* Second row: GLB Fitting + 2 formats */}
									<div className='flex items-center gap-2'>
										<button className='border-2 border-main1 bg-white text-black px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-xs whitespace-nowrap w-36'>
											Примерка GLB
										</button>
										{['.rfa', '.uszd'].map(format => (
											<label
												key={format}
												className='flex items-center gap-1 cursor-pointer border border-gray2 rounded-lg px-2 py-1.5'
											>
												<input
													type='checkbox'
													checked={selectedFormats[download.id] === format}
													onChange={() =>
														handleFormatChange(download.id, format)
													}
													className='w-3 h-3 text-main1 focus:ring-main1 focus:ring-2 rounded'
												/>
												<span className='text-xs text-black'>{format}</span>
											</label>
										))}
									</div>
								</div>

								{/* Action buttons */}
								<div className='flex items-center gap-3'>
									<button
										onClick={() =>
											router.push(`/product/${download.product.id}`)
										}
										title='Просмотр'
										className='text-gray hover:text-main1 transition-colors'
									>
										<EyeIcon className='w-5 h-5' />
									</button>
									<button
										onClick={() =>
											handleDownload(
												download.product.id,
												selectedFormats[download.id] || '.fbx'
											)
										}
										title='Скачать'
										className='text-gray hover:text-main1 transition-colors'
									>
										<ArrowDownTrayIcon className='w-5 h-5' />
									</button>
									<button
										onClick={() => handleDelete(download.id)}
										title='Удалить'
										className='text-red-500 hover:text-red-700 transition-colors'
									>
										<TrashIcon className='w-5 h-5' />
									</button>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{/* Modal for subscription upgrade */}
			<UpgradeSubscriptionModal
				isOpen={isUpgradeModalOpen}
				onClose={() => setIsUpgradeModalOpen(false)}
				currentSubscription={
					(currentUser?.profile?.subscription_type as
						| 'trial'
						| 'basic'
						| 'premium') || 'trial'
				}
				message={upgradeModalMessage}
			/>
		</div>
	)
}
