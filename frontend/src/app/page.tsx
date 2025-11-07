'use client'

import AuthModal from '@/components/AuthModal'
import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import ProductGrid from '@/components/ProductGrid'
import { useBaskets, useProducts } from '@/hooks/useApi'
import { useState } from 'react'

export default function Home() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: number
		format: string
	} | null>(null)

	// Получаем трендовые товары из базы данных
	const { products, loading: productsLoading } = useProducts({
		is_active: true,
		is_trending: true,
	})
	const { createBasket, addToBasket } = useBaskets()

	const handleAddToCart = (productId: number, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = async (cartId: number) => {
		if (selectedProduct) {
			try {
				await addToBasket(cartId, selectedProduct.id, 1, selectedProduct.format)
				console.log(
					`Добавлен товар ${selectedProduct.id} (${selectedProduct.format}) в корзину ${cartId}`
				)
			} catch (error) {
				console.error('Ошибка при добавлении в корзину:', error)
			}
		}
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const handleCreateNewCart = async (cartName: string) => {
		try {
			const newBasket = await createBasket(cartName)
			if (selectedProduct) {
				await addToBasket(
					newBasket.id,
					selectedProduct.id,
					1,
					selectedProduct.format
				)
				console.log(`Создана новая корзина: ${cartName}`)
			}
		} catch (error) {
			console.error('Ошибка при создании корзины:', error)
		}
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const handleAuthSuccess = () => {
		// После успешной авторизации просто закрываем модальное окно
		setIsAuthModalOpen(false)
		// Перезагружаем страницу, чтобы обновить Header с новой информацией о пользователе
		window.location.reload()
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />
			<main>
				<HeroSection onOpenAuth={() => setIsAuthModalOpen(true)} />
				{productsLoading ? (
					<div className='text-center py-12'>Загрузка товаров...</div>
				) : (
					<ProductGrid
						title='Трендовые продукты'
						products={products}
						onAddToCart={handleAddToCart}
					/>
				)}
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

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</div>
	)
}
