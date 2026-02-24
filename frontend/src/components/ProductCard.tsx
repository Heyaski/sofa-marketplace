'use client'

import { useRouter } from 'next/navigation'
import { config } from '../config'
import { Product } from '../types'
import ProductModelViewer from './ProductModelViewer'

interface ProductCardProps {
	product: Product
	onAddToCart: (productId: number, format: string) => void
}

export default function ProductCard({
	product,
	onAddToCart,
}: ProductCardProps) {
	const router = useRouter()

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

	const getCategoryName = () => {
		if (!product.title) return ''
		const match = product.title.match(/^[А-Яа-яЁё]+/)
		return match ? match[0] : ''
	}

	const getCardDescription = () => {
		const categoryName = getCategoryName()
		const colorName = product.color || ''
		const dims: string[] = []
		if (product.width) dims.push(`${product.width}`)
		if (product.depth) dims.push(`${product.depth}`)
		if (product.height) dims.push(`${product.height}`)

		let line = categoryName
		if (colorName) line += ` ${colorName}`
		if (dims.length) line += ` ${dims.join('×')} см`
		return line.trim()
	}

	const handleDownloadRfa = async () => {
		try {
			// Если для товара нет RFA модели, просто выходим
			if (!product.model_rfa) {
				alert('Для этого товара RFA-файл недоступен')
				return
			}

			const response = await fetch(`${config.API_URL}/api/downloads/presign/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: typeof window !== 'undefined' && localStorage.getItem('access_token')
						? `Bearer ${localStorage.getItem('access_token')}`
						: '',
				},
				body: JSON.stringify({
					product_id: product.id,
					format: '.rfa',
				}),
			})

			const contentType = response.headers.get('content-type')
			const isJson = contentType && contentType.includes('application/json')
			const data = isJson ? await response.json() : null

			if (!response.ok) {
				const message =
					data?.error ||
					data?.message ||
					'Ошибка при получении ссылки для скачивания RFA'
				alert(message)
				return
			}

			if (data?.url) {
				// Открываем RFA в новом табе / запускаем скачивание
				window.location.href = data.url
			} else {
				alert('RFA-файл недоступен для этого товара')
			}
		} catch (error) {
			console.error('Ошибка при скачивании RFA:', error)
			alert('Ошибка при скачивании RFA-файла')
		}
	}

	const handleCardClick = () => {
		router.push(`/product/${product.id}`)
	}

	return (
		<div className='product-card bg-white rounded-xl shadow-md p-3 sm:p-4 hover:shadow-lg transition-all duration-200'>
			{/* 3D модель или изображение товара — можно крутить в каталоге */}
			<div className='rounded-lg mb-3 sm:mb-4 overflow-hidden' onClick={handleCardClick}>
				<ProductModelViewer product={product} variant='card' />
			</div>

			{/* Описание: категория + цвет + размеры */}
			<div
				className='text-sm font-semibold text-black mb-3 cursor-pointer hover:text-main1 transition-colors line-clamp-2 min-h-[2.5rem]'
				onClick={handleCardClick}
				title={getCardDescription()}
			>
				{getCardDescription()}
			</div>

			{/* Действия */}
			<div className='flex flex-col sm:flex-row gap-2'>
				<button
					onClick={() => onAddToCart(product.id, config.DEFAULT_FORMAT)}
					className='btn-primary py-2 sm:py-2.5 px-4 w-full sm:w-auto text-sm sm:text-base'
				>
					В корзину
				</button>

				{product.model_rfa && (
					<button
						onClick={handleDownloadRfa}
						className='border border-main1 text-main1 bg-white hover:bg-main1 hover:text-white transition-colors rounded-lg py-2 sm:py-2.5 px-4 text-xs sm:text-sm w-full sm:w-auto'
					>
						Скачать RFA
					</button>
				)}
			</div>
		</div>
	)
}
