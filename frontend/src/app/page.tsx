'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import ProductGrid from '@/components/ProductGrid'
import { useState } from 'react'

// Mock data
const mockProducts = [
	{
		id: '1',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
	{
		id: '2',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
	{
		id: '3',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
	{
		id: '4',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
	{
		id: '5',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
	{
		id: '6',
		name: 'Современный диван',
		price: 300000,
		oldPrice: 300000,
		image: '/sofa.jpg',
		formats: ['.fbx', '.glb', '.rfa', '.usdz'],
	},
]

export default function Home() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: string
		format: string
	} | null>(null)

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
