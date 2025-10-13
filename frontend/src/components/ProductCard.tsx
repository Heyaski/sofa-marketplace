'use client'

import Image from 'next/image'
import { useState } from 'react'

interface ProductCardProps {
	id: string
	price: number
	oldPrice?: number
	image: string
	formats: string[]
	onAddToCart: (productId: string, format: string) => void
}

export default function ProductCard({
	id,
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
			<div className='aspect-square rounded-lg mb-4 overflow-hidden'>
				<Image
					src='/img/sofa-card.svg'
					alt='Product Image'
					width={300}
					height={300}
					className='w-full h-full object-cover'
				/>
			</div>

			{/* Price - in line */}
			<div className='flex items-center gap-2 mb-4'>
				<div className='text-lg font-bold text-black'>
					{formatPrice(price)} ₽
				</div>
				{oldPrice && (
					<div className='text-sm text-gray line-through'>
						{formatPrice(oldPrice)} ₽
					</div>
				)}
			</div>

			{/* Format Selection - checkboxes */}
			<div className='flex flex-wrap gap-2 mb-4'>
				{formats.map(format => (
					<label
						key={format}
						className='flex items-center cursor-pointer border border-gray2 rounded-lg px-2 py-1 flex-shrink-0'
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
