'use client'

import ProductCard from './ProductCard'

interface Product {
	id: string
	name: string
	price: number
	oldPrice?: number
	image: string
	formats: string[]
}

interface ProductGridProps {
	title: string
	products: Product[]
	onAddToCart: (productId: string, format: string) => void
}

export default function ProductGrid({
	title,
	products,
	onAddToCart,
}: ProductGridProps) {
	return (
		<section className='py-16 bg-gray-bg'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center mb-8'>
					<h2 className='text-3xl font-bold text-black'>{title}</h2>
					<a href='#' className='text-main1 hover:text-main2 font-medium'>
						Посмотреть все трендовые продукты
					</a>
				</div>

				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'>
					{products.map(product => (
						<ProductCard
							key={product.id}
							{...product}
							onAddToCart={onAddToCart}
						/>
					))}
				</div>
			</div>
		</section>
	)
}


