'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { config } from '../config'
import { Product } from '../types'
import { formatDimension } from '../utils/format'
import { getTitleWithoutBrand } from '../utils/productTitle'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import ProductModelViewer, { getProductModelUrlAt } from './ProductModelViewer'
import EditProductModal from './EditProductModal'
import { productService } from '../services/api'

interface ProductCardProps {
	product: Product
	onAddToCart: (productId: number, format: string) => void
	isSuperuser?: boolean
	onProductUpdated?: (product: Product) => void
	onProductDeleted?: (productId: number) => void
	onAuthRequired?: () => void
	/** Режим каталога: 2D — фото, 3D — model-viewer */
	catalogDisplayMode?: '2d' | '3d'
}

export default function ProductCard({
	product,
	onAddToCart,
	isSuperuser = false,
	onProductUpdated,
	onProductDeleted,
	onAuthRequired,
	catalogDisplayMode = '3d',
}: ProductCardProps) {
	const router = useRouter()
	const [toastMessage, setToastMessage] = useState<string | null>(null)
	const [menuOpen, setMenuOpen] = useState(false)
	const [editModalOpen, setEditModalOpen] = useState(false)

	useEffect(() => {
		if (!toastMessage) return
		const t = setTimeout(() => setToastMessage(null), 3000)
		return () => clearTimeout(t)
	}, [toastMessage])

	const rgbToHex = (rgb?: string) => {
		if (!rgb) return undefined
		const parts = rgb.split(',').map(p => parseInt(p.trim(), 10))
		if (parts.length !== 3 || parts.some(p => Number.isNaN(p))) return undefined
		const toByte = (v: number) =>
			Math.max(0, Math.min(255, v))
				.toString(16)
				.padStart(2, '0')
				.toUpperCase()
		return `#${toByte(parts[0])}${toByte(parts[1])}${toByte(parts[2])}`
	}

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(Number(price))
	}

	const displayTitle = product.title_display ?? getTitleWithoutBrand(product.title || '', product.brand)
	const catalogThumbUrl = getProductPrimaryImageUrl(product)

	const getCategoryName = () => {
		if (!displayTitle) return ''
		const match = displayTitle.match(/^[А-Яа-яЁё]+/)
		return match ? match[0] : ''
	}

	const getCardDescription = () => {
		const categoryName = getCategoryName()
		const colorName = product.color || ''
		const dims: string[] = []
		if (product.width != null) dims.push(formatDimension(product.width))
		if (product.depth != null) dims.push(formatDimension(product.depth))
		if (product.height != null) dims.push(formatDimension(product.height))

		let line = categoryName
		if (colorName) line += ` ${colorName}`
		if (dims.length) line += ` ${dims.join('×')} см`
		return line.trim()
	}

	const handleDownloadModel = async () => {
		if (!product.model_rfa) {
			setToastMessage('У этой модели отсутствует файл модели')
			return
		}

		const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
		if (!token) {
			if (onAuthRequired) {
				onAuthRequired()
			} else {
				setToastMessage('Для скачивания файлов необходимо войти в аккаунт')
			}
			return
		}

		try {
			const response = await fetch(`${config.API_URL}/api/downloads/presign/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					product_id: product.id,
					format: '.ifc',
				}),
			})

			const contentType = response.headers.get('content-type')
			const isJson = contentType && contentType.includes('application/json')
			const data = isJson ? await response.json() : null

			if (!response.ok) {
				if (response.status === 401) {
					if (onAuthRequired) {
						onAuthRequired()
					} else {
						setToastMessage('Для скачивания файлов необходимо войти в аккаунт')
					}
					return
				}
				const message =
					data?.error ||
					data?.detail ||
					data?.message ||
					'Ошибка при получении ссылки для скачивания файла'
				alert(message)
				return
			}

			if (data?.url) {
				window.location.href = data.url
			} else {
				alert('Файл модели недоступен для этого товара')
			}
		} catch (error) {
			console.error('Ошибка при скачивании файла модели:', error)
			alert('Ошибка при скачивании файла модели')
		}
	}

	const handleCardClick = () => {
		router.push(`/product/${product.id}`)
	}

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation()
		setMenuOpen(false)
		setEditModalOpen(true)
	}

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation()
		setMenuOpen(false)
		if (!confirm(`Удалить товар «${getTitleWithoutBrand(product.title || '', product.brand)}»?`)) return
		try {
			await productService.deleteProduct(product.id)
			onProductDeleted?.(product.id)
			setToastMessage('Товар удалён')
		} catch (err) {
			console.error(err)
			setToastMessage('Ошибка удаления товара')
		}
	}

	return (
		<div className='product-card bg-white rounded-xl shadow-md p-3 sm:p-4 hover:shadow-lg transition-all duration-200 relative'>
			{/* 3 точки для суперпользователя */}
			{isSuperuser && (
				<div className='absolute right-2 top-2 z-20'>
					<button
						type='button'
						onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
						className='p-1 rounded-full hover:bg-gray-200 text-gray hover:text-black'
						aria-label='Меню'
					>
						<EllipsisVerticalIcon className='w-5 h-5' />
					</button>
					{menuOpen && (
						<>
							<div
								className='fixed inset-0 z-40'
								onClick={() => setMenuOpen(false)}
								aria-hidden='true'
							/>
							<div className='absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray2 py-1 min-w-[140px]'>
								<button
									type='button'
									onClick={handleEdit}
									className='w-full text-left px-4 py-2 text-sm hover:bg-gray-bg text-black'
								>
									Редактировать
								</button>
								<button
									type='button'
									onClick={handleDelete}
									className='w-full text-left px-4 py-2 text-sm hover:bg-gray-bg text-red-500'
								>
									Удалить
								</button>
							</div>
						</>
					)}
				</div>
			)}
			{/* Каталог: 2D — фото, 3D — интерактивная модель */}
			<div className='rounded-lg mb-3 sm:mb-4 overflow-hidden relative aspect-square bg-gray-50'>
				<div className='absolute right-2 bottom-2 z-10 flex gap-1'>
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded ${getProductModelUrlAt(product, 0) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
						title={getProductModelUrlAt(product, 0) ? '3D доступен' : '3D не добавлен'}
					>
						3D
					</span>
				</div>
				{isSuperuser && product.model_3d_id && catalogDisplayMode === '3d' && (
					<span className='absolute left-2 top-2 z-10 text-xs text-gray font-medium bg-white/80 px-1.5 py-0.5 rounded'>
						{product.model_3d_id}
					</span>
				)}
				{catalogDisplayMode === '2d' ? (
					catalogThumbUrl ? (
						// eslint-disable-next-line @next/next/no-img-element -- внешние URL с API
						<img
							src={catalogThumbUrl}
							alt={displayTitle || 'Товар'}
							className='w-full h-full object-cover cursor-pointer'
							onClick={handleCardClick}
						/>
					) : (
						<button
							type='button'
							onClick={handleCardClick}
							className='w-full h-full flex items-center justify-center text-xs text-gray px-2 text-center'
						>
							Нет фото
						</button>
					)
				) : getProductModelUrlAt(product, 0) ? (
					<ProductModelViewer product={product} variant='card' onClick={handleCardClick} />
				) : (
					<button
						type='button'
						onClick={handleCardClick}
						className='w-full h-full flex flex-col items-center justify-center text-xs text-gray px-2 text-center gap-1'
					>
						<span>Нет 3D</span>
						{catalogThumbUrl && (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={catalogThumbUrl}
								alt=''
								className='max-h-[70%] max-w-full object-contain rounded'
							/>
						)}
					</button>
				)}
			</div>

			{/* Описание: категория + цвет + размеры — клик открывает карточку */}
			<div
				className='text-sm font-semibold text-black mb-1 cursor-pointer hover:text-main1 transition-colors line-clamp-2 min-h-[2.5rem]'
				onClick={handleCardClick}
				title={getCardDescription()}
				role='button'
				tabIndex={0}
				onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
			>
				{getCardDescription()}
			</div>
			<button
				type='button'
				onClick={handleCardClick}
				className='text-xs text-main1 hover:text-main2 mb-2 text-left w-full'
			>
				Подробнее →
			</button>

			{/* Действия */}
			<div className='flex flex-col gap-2 relative'>
				<button
					onClick={() => onAddToCart(product.id, config.DEFAULT_FORMAT)}
					className='btn-primary py-2 px-3 w-full text-sm font-medium whitespace-nowrap rounded-lg'
				>
					В корзину
				</button>

				<button
					onClick={handleDownloadModel}
					className='py-2 px-3 w-full text-sm font-medium whitespace-nowrap rounded-lg border border-gray2 text-black bg-white hover:bg-gray-bg hover:border-main1 hover:text-main1 transition-colors'
				>
					Скачать файл
				</button>

				{toastMessage && (
					<div className='fixed left-1/2 bottom-8 -translate-x-1/2 px-4 py-3 text-sm rounded-lg shadow-xl z-[9999]' style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
						{toastMessage}
					</div>
				)}
			</div>

			<EditProductModal
				product={product}
				isOpen={editModalOpen}
				onClose={() => setEditModalOpen(false)}
				onSaved={updated => { onProductUpdated?.(updated); setEditModalOpen(false) }}
			/>
		</div>
	)
}
