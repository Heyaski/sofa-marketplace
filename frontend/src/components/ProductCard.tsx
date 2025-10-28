'use client'

import Image from 'next/image'
import { useState } from 'react'
import { config } from '../config'
import { Product } from '../types'

interface ProductCardProps {
	product: Product
	onAddToCart: (productId: number, format: string) => void
}

export default function ProductCard({
	product,
	onAddToCart,
}: ProductCardProps) {
	const [selectedFormat, setSelectedFormat] = useState(
		config.SUPPORTED_FORMATS[0]
	)

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(Number(price))
	}

	return (
		<div className='product-card bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all duration-200'>
			{/* Изображение товара */}
			<div className='aspect-square rounded-lg mb-4 overflow-hidden bg-gray-50 flex items-center justify-center'>
				{product.image && typeof product.image === 'string' ? (
					<Image
						src={product.image}
						alt={product.title || 'Товар'}
						width={300}
						height={300}
						className='w-full h-full object-cover'
						unoptimized
					/>
				) : (
					<Image
						src='/img/sofa-card.svg'
						alt='Заглушка'
						width={300}
						height={300}
						className='w-full h-full object-contain opacity-70'
					/>
				)}
			</div>

			{/* Цена */}
			<div className='flex items-center gap-2 mb-4'>
				<div className='text-lg font-bold text-black'>
					{formatPrice(Number(product.price))} {config.CURRENCY_SYMBOL}
				</div>
			</div>

			{/* Форматы файлов */}
			<div className='flex flex-wrap gap-2 mb-4'>
				{config.SUPPORTED_FORMATS.map(format => (
					<label
						key={format}
						className='flex items-center cursor-pointer border border-gray2 rounded-lg px-2 py-1 flex-shrink-0 bg-white hover:bg-gray-50'
					>
						<input
							type='checkbox'
							checked={selectedFormat === format}
							onChange={() => setSelectedFormat(format)}
							className='w-4 h-4 rounded-lg border border-gray-300 text-main1 focus:ring-main1 focus:ring-2 mr-2'
						/>
						<span className='text-xs text-black whitespace-nowrap'>
							{format}
						</span>
					</label>
				))}
			</div>

			{/* Кнопка добавления */}
			<button
				onClick={() => onAddToCart(product.id, selectedFormat)}
				className='w-full btn-primary py-3'
			>
				В корзину
			</button>
		</div>
	)
}
