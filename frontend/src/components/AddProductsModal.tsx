'use client'

import { useProducts } from '@/hooks/useApi'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import ProductCard from './ProductCard'

interface AddProductsModalProps {
	isOpen: boolean
	onClose: () => void
	onAddProducts: (products: { id: number; format: string }[]) => void
	currentBasketId: number
}

export default function AddProductsModal({
	isOpen,
	onClose,
	onAddProducts,
	currentBasketId,
}: AddProductsModalProps) {
	const [selectedProducts, setSelectedProducts] = useState<Map<number, string>>(
		new Map()
	)
	const [searchQuery, setSearchQuery] = useState('')
	const { products, loading } = useProducts({ is_active: true })

	// Фильтруем товары по поисковому запросу
	const filteredProducts = products.filter(product =>
		product.title.toLowerCase().includes(searchQuery.toLowerCase())
	)

	useEffect(() => {
		if (!isOpen) {
			setSelectedProducts(new Map())
			setSearchQuery('')
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleProductSelect = (productId: number, format: string) => {
		setSelectedProducts(prev => {
			const newMap = new Map(prev)
			if (newMap.has(productId) && newMap.get(productId) === format) {
				// Если тот же товар с тем же форматом - убираем
				newMap.delete(productId)
			} else {
				// Иначе добавляем/обновляем
				newMap.set(productId, format)
			}
			return newMap
		})
	}

	const handleAdd = () => {
		const productsArray = Array.from(selectedProducts.entries()).map(
			([id, format]) => ({ id, format })
		)
		onAddProducts(productsArray)
		onClose()
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto'>
			<div className='bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col'>
				{/* Header */}
				<div className='flex justify-between items-center p-6 border-b border-gray2'>
					<h2 className='text-2xl font-bold text-black'>
						Добавить товары из каталога
					</h2>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Search */}
				<div className='p-6 border-b border-gray2'>
					<input
						type='text'
						placeholder='Поиск товаров...'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
					/>
				</div>

				{/* Products grid - scrollable */}
				<div className='flex-1 overflow-y-auto p-6'>
					{loading ? (
						<div className='text-center py-8'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1 mx-auto'></div>
							<p className='mt-4 text-gray'>Загрузка товаров...</p>
						</div>
					) : filteredProducts.length === 0 ? (
						<div className='text-center py-8 text-gray'>
							<p>Товары не найдены</p>
						</div>
					) : (
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
							{filteredProducts.map(product => {
								const isSelected = selectedProducts.has(product.id)
								const selectedFormat = selectedProducts.get(product.id)

								return (
									<div
										key={product.id}
										className={`relative border-2 rounded-lg overflow-hidden transition-all ${
											isSelected
												? 'border-main1 shadow-lg'
												: 'border-transparent hover:border-gray2'
										}`}
									>
										<ProductCard
											product={product}
											onAddToCart={(productId, format) =>
												handleProductSelect(productId, format)
											}
										/>
										{isSelected && (
											<div className='absolute top-2 right-2 bg-main1 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold'>
												✓
											</div>
										)}
									</div>
								)
							})}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className='p-6 border-t border-gray2 flex justify-between items-center'>
					<div className='text-gray'>
						Выбрано товаров: {selectedProducts.size}
					</div>
					<div className='flex gap-3'>
						<button
							onClick={onClose}
							className='px-6 py-2 border border-gray2 text-black rounded-lg hover:bg-gray-bg transition-colors'
						>
							Отмена
						</button>
						<button
							onClick={handleAdd}
							disabled={selectedProducts.size === 0}
							className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
						>
							Добавить выбранные ({selectedProducts.size})
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
