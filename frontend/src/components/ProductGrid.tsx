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
				{/* White background container */}
				<div className='bg-white rounded-xl p-8'>
					{/* Header section */}
					<div className='mb-8'>
						<h2 className='text-3xl font-bold text-black mb-2'>{title}</h2>
						<a href='#' className='text-black hover:text-gray-600 font-medium'>
							Посмотреть все трендовые продукты
						</a>
					</div>

					{/* Products grid */}
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
						{products.map(product => (
							<ProductCard
								key={product.id}
								{...product}
								onAddToCart={onAddToCart}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
