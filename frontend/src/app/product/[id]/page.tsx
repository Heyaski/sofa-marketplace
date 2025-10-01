'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useState } from 'react'

interface ProductPageProps {
	params: {
		id: string
	}
}

export default function ProductPage({ params }: ProductPageProps) {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedFormat, setSelectedFormat] = useState('.fbx')

	const formats = ['.fbx', '.glb', '.rfa']

	const handleAddToCart = () => {
		setIsCartModalOpen(true)
	}

	const handleCartSelect = (cartId: string) => {
		console.log(
			`Adding product ${params.id} with format ${selectedFormat} to cart ${cartId}`
		)
		setIsCartModalOpen(false)
	}

	const handleCreateNewCart = (cartName: string) => {
		console.log(`Creating new cart: ${cartName}`)
		setIsCartModalOpen(false)
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
						<span>Каталог</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Страница товара</span>
					</nav>
				</div>

				<div className='grid lg:grid-cols-2 gap-12'>
					{/* Product Images */}
					<div className='space-y-4'>
						{/* Main Image */}
						<div className='aspect-square bg-white rounded-xl p-8 shadow-card'>
							<div className='w-full h-full bg-gray-bg rounded-lg flex items-center justify-center'>
								<div className='w-32 h-32 bg-gray2 rounded-lg'></div>
							</div>
						</div>

						{/* Thumbnails */}
						<div className='grid grid-cols-4 gap-4'>
							{Array.from({ length: 8 }, (_, i) => (
								<div
									key={i}
									className='aspect-square bg-white rounded-lg p-2 shadow-card'
								>
									<div className='w-full h-full bg-gray-bg rounded flex items-center justify-center'>
										<div className='w-8 h-8 bg-gray2 rounded'></div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Product Info */}
					<div className='space-y-6'>
						<h1 className='text-3xl font-bold text-black'>
							Наименование Наименование Наименование Наименование
						</h1>

						{/* Price */}
						<div className='space-y-2'>
							<div className='text-3xl font-bold text-black'>300 000 ₽</div>
							<div className='text-lg text-gray line-through'>300 000 ₽</div>
						</div>

						{/* Description */}
						<div className='prose max-w-none'>
							<p className='text-black leading-relaxed'>
								Weather-resistant aluminium cladding with I-tec Insulation
								technology and innovative ventilation system. High-quality
								materials ensure durability and modern design.
							</p>
						</div>

						{/* Specifications */}
						<div className='space-y-3'>
							<h3 className='font-semibold text-black'>Характеристики:</h3>
							<div className='space-y-2 text-sm'>
								<div className='flex justify-between'>
									<span className='text-gray'>Теплоизоляция:</span>
									<span className='text-black'>Uw до 0.62 W/(m²K)</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-gray'>Звукоизоляция:</span>
									<span className='text-black'>до 34-47 дБ</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-gray'>Безопасность:</span>
									<span className='text-black'>до RC1N, RC2</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-gray'>Замок:</span>
									<span className='text-black'>скрытый</span>
								</div>
							</div>
						</div>

						{/* Format Selection */}
						<div className='space-y-3'>
							<h3 className='font-semibold text-black'>Формат файла:</h3>
							<div className='flex space-x-2'>
								{formats.map(format => (
									<button
										key={format}
										onClick={() => setSelectedFormat(format)}
										className={`px-4 py-2 rounded-lg transition-colors ${
											selectedFormat === format
												? 'bg-main1 text-white'
												: 'bg-gray2 text-black hover:bg-gray'
										}`}
									>
										{format}
									</button>
								))}
							</div>
						</div>

						{/* Action Buttons */}
						<div className='space-y-4'>
							<button
								onClick={handleAddToCart}
								className='w-full btn-primary py-4 text-lg'
							>
								Добавить в корзину
							</button>

							<div className='grid grid-cols-2 gap-4'>
								<button className='btn-secondary'>Открыть 3D Viewer</button>
								<button className='btn-secondary'>Примерка GLB</button>
							</div>
						</div>

						<div className='text-sm text-gray'>
							<button className='hover:text-black transition-colors'>
								Войти / Зарегестрироваться
							</button>
						</div>
					</div>
				</div>

				{/* Recommended Products */}
				<section className='mt-16'>
					<h2 className='text-2xl font-bold text-black mb-8'>
						Рекомендуемые товары
					</h2>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6'>
						{Array.from({ length: 6 }, (_, i) => (
							<div key={i} className='product-card'>
								<div className='aspect-square bg-gray-bg rounded-lg mb-4 flex items-center justify-center'>
									<div className='w-16 h-16 bg-gray2 rounded-lg'></div>
								</div>
								<div className='text-lg font-bold text-black mb-2'>
									300 000 ₽
								</div>
								<div className='text-sm text-gray line-through mb-4'>
									300 000 ₽
								</div>
								<div className='flex space-x-1 mb-4'>
									{formats.map(format => (
										<button
											key={format}
											className={`px-2 py-1 text-xs rounded ${
												format === '.fbx'
													? 'bg-main1 text-white'
													: 'bg-gray2 text-black'
											}`}
										>
											{format}
										</button>
									))}
								</div>
								<button className='w-full btn-primary py-2 text-sm'>
									В корзину
								</button>
							</div>
						))}
					</div>
				</section>
			</main>

			<Footer />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => setIsCartModalOpen(false)}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>
		</div>
	)
}


