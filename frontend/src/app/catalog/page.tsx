'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { useState } from 'react'

// Mock data for catalog
const catalogProducts = Array.from({ length: 24 }, (_, i) => ({
	id: `catalog-${i + 1}`,
	name: 'Современный диван',
	price: 300000,
	oldPrice: 300000,
	image: '/sofa.jpg',
	formats: ['.fbx', '.glb', '.rfa'],
}))

const categories = [
	'Прямые диваны',
	'Угловые диваны',
	'Кресла',
	'Шкафы книжные',
	'Столы обеденные',
	'Стулья обеденные',
	'Тумбы прикроватные',
]

export default function CatalogPage() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: string
		format: string
	} | null>(null)
	const [activeCategory, setActiveCategory] = useState('Прямые диваны')

	const handleAddToCart = (productId: string, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = (cartId: string) => {
		console.log(
			`Adding product ${selectedProduct?.id} with format ${selectedProduct?.format} to cart ${cartId}`
		)
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const handleCreateNewCart = (cartName: string) => {
		console.log(`Creating new cart: ${cartName}`)
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				{/* Breadcrumbs */}
				<div className='mb-8'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* Categories */}
				<div className='mb-8'>
					<div className='flex space-x-6 overflow-x-auto pb-4'>
						{categories.map(category => (
							<button
								key={category}
								onClick={() => setActiveCategory(category)}
								className={`whitespace-nowrap px-4 py-2 rounded-lg transition-colors ${
									activeCategory === category
										? 'bg-main1 text-white'
										: 'bg-white text-black hover:bg-gray2'
								}`}
							>
								{category}
							</button>
						))}
					</div>
				</div>

				{/* Filters */}
				<div className='bg-white rounded-xl p-6 mb-8'>
					<div className='flex flex-wrap gap-4 items-center'>
						<button className='btn-primary'>Фильтр</button>
						<select className='input-field w-32'>
							<option>Цена</option>
						</select>
						<select className='input-field w-32'>
							<option>Категория</option>
						</select>
						<select className='input-field w-32'>
							<option>Подразделение</option>
						</select>
						<select className='input-field w-32'>
							<option>Цвет</option>
						</select>
						<select className='input-field w-32'>
							<option>Габариты</option>
						</select>
						<select className='input-field w-48 ml-auto'>
							<option>Сортировка: по возрастанию цены</option>
						</select>
					</div>
				</div>

				{/* Products Grid */}
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'>
					{catalogProducts.map(product => (
						<ProductCard
							key={product.id}
							{...product}
							onAddToCart={handleAddToCart}
						/>
					))}
				</div>
			</main>

			<Footer />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => {
					setIsCartModalOpen(false)
					setSelectedProduct(null)
				}}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>
		</div>
	)
}


