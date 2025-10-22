'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import ProductGrid from '@/components/ProductGrid'
import { Product } from '@/types'
import { useState } from 'react'

// Mock data
const mockProducts: Product[] = [
	{
		id: 1,
		title: 'Современный диван',
		category: {
			id: 1,
			name: 'Диваны',
			slug: 'sofas',
			parent: null,
		},
		description: 'Современный диван для гостиной',
		price: 300000,
		material: 'Ткань',
		style: 'Современный',
		color: 'Серый',
		is_active: true,
	},
	{
		id: 2,
		title: 'Классический диван',
		category: {
			id: 1,
			name: 'Диваны',
			slug: 'sofas',
			parent: null,
		},
		description: 'Классический диван в традиционном стиле',
		price: 250000,
		material: 'Кожа',
		style: 'Классический',
		color: 'Коричневый',
		is_active: true,
	},
	{
		id: 3,
		title: 'Модульный диван',
		category: {
			id: 1,
			name: 'Диваны',
			slug: 'sofas',
			parent: null,
		},
		description: 'Модульный диван для современного интерьера',
		price: 350000,
		material: 'Ткань',
		style: 'Современный',
		color: 'Белый',
		is_active: true,
	},
	{
		id: 4,
		title: 'Угловой диван',
		category: {
			id: 1,
			name: 'Диваны',
			slug: 'sofas',
			parent: null,
		},
		description: 'Угловой диван для больших помещений',
		price: 400000,
		material: 'Ткань',
		style: 'Современный',
		color: 'Синий',
		is_active: true,
	},
]

export default function Home() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)

	const handleAddToCart = (productId: number, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = (cartId: number) => {
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
			<main>
				<HeroSection />
				<ProductGrid
					title='Трендовые продукты'
					products={mockProducts}
					onAddToCart={handleAddToCart}
				/>
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
