'use client'

import Image from 'next/image'
import { useState } from 'react'

interface ProductCardProps {
	id: string
	name: string
	price: number
	oldPrice?: number
	image: string
	formats: string[]
	onAddToCart: (productId: string, format: string) => void
}

export default function ProductCard({
	id,
	name,
	price,
	oldPrice,
	image,
	formats,
	onAddToCart,
}: ProductCardProps) {
	const [selectedFormat, setSelectedFormat] = useState(formats[0])

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price)
	}

	return (
		<div className='product-card'>
			{/* Product Image */}
			<div className='aspect-square bg-gray-bg rounded-lg mb-4 overflow-hidden'>
				<Image
					src='/img/sofa-card.svg'
					alt={name}
					width={300}
					height={300}
					className='w-full h-full object-cover'
				/>
			</div>

			{/* Product Name */}
			<div className='mb-2'>
				<h3 className='text-black font-medium'>{name}</h3>
			</div>

			{/* Price */}
			<div className='mb-4'>
				<div className='text-lg font-bold text-black'>
					{formatPrice(price)} ₽
				</div>
				{oldPrice && (
					<div className='text-sm text-gray line-through'>
						{formatPrice(oldPrice)} ₽
					</div>
				)}
			</div>

			{/* Format Selection */}
			<div className='flex space-x-2 mb-4'>
				{formats.map(format => (
					<button
						key={format}
						onClick={() => setSelectedFormat(format)}
						className={`px-3 py-1 text-xs rounded transition-colors ${
							selectedFormat === format
								? 'bg-main1 text-white'
								: 'bg-gray2 text-black hover:bg-gray'
						}`}
					>
						{format}
					</button>
				))}
			</div>

			{/* Add to Cart Button */}
			<button
				onClick={() => onAddToCart(id, selectedFormat)}
				className='w-full btn-primary py-3'
			>
				В корзину
			</button>
		</div>
	)
}
