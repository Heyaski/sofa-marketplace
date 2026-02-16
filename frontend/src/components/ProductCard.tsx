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

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(Number(price))
	}

	const handleCardClick = () => {
		router.push(`/product/${product.id}`)
	}

	return (
		<div className='product-card bg-white rounded-xl shadow-sm p-3 sm:p-4 hover:shadow-md transition-all duration-200'>
			{/* 3D модель или изображение товара — можно крутить в каталоге */}
			<div className='rounded-lg mb-3 sm:mb-4 overflow-hidden' onClick={handleCardClick}>
				<ProductModelViewer product={product} variant='card' />
			</div>

			{/* Название товара */}
			<div
				className='text-sm font-semibold text-black mb-1 sm:mb-2 cursor-pointer hover:text-main1 transition-colors line-clamp-2 min-h-[2.5rem]'
				onClick={handleCardClick}
				title={product.title}
			>
				{product.title}
			</div>

			{/* Артикул */}
			{product.article && (
				<div className='text-xs text-gray mb-2'>
					Артикул: {product.article}
				</div>
			)}

			{/* Цена */}
			<div className='text-base sm:text-lg font-bold text-black mb-2 sm:mb-3'>
				{formatPrice(Number(product.price))} {config.CURRENCY_SYMBOL}
			</div>

			{/* Кнопка добавления — формат .rfa по умолчанию */}
			<button
				onClick={() => onAddToCart(product.id, config.DEFAULT_FORMAT)}
				className='btn-primary py-2 sm:py-2.5 px-4 w-full sm:w-auto text-sm sm:text-base'
			>
				В корзину
			</button>
		</div>
	)
}
