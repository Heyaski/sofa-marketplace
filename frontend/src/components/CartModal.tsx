'use client'

import { useEffect, useState } from 'react'

interface CartModalProps {
	isOpen: boolean
	onClose: () => void
	onAddToCart: (cartId: string) => void
	onCreateNewCart: (cartName: string) => void
}

export default function CartModal({
	isOpen,
	onClose,
	onAddToCart,
	onCreateNewCart,
}: CartModalProps) {
	const [selectedCart, setSelectedCart] = useState('')
	const [newCartName, setNewCartName] = useState('')
	const [isCreatingNew, setIsCreatingNew] = useState(false)

	const carts = [
		'Проект_Квартира_Ивановых',
		'Проект_Квартира_Ивановых',
		'Проект_Квартира_Ивановых',
		'Проект_Квартира_Ивановых',
	]

	// Сброс состояния при открытии/закрытии модала
	useEffect(() => {
		if (isOpen) {
			setSelectedCart('')
			setNewCartName('')
			setIsCreatingNew(false)
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleSubmit = () => {
		if (isCreatingNew && newCartName.trim()) {
			onCreateNewCart(newCartName.trim())
		} else if (selectedCart) {
			onAddToCart(selectedCart)
		}
		onClose()
	}

	const handleBack = () => {
		setIsCreatingNew(false)
		setNewCartName('')
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-2xl w-full p-8'>
				{/* Header */}
				<div className='flex justify-between items-center mb-6'>
					{isCreatingNew ? (
						<button
							onClick={handleBack}
							className='text-black hover:text-black transition-colors flex items-center'
						>
							← Назад
						</button>
					) : (
						<div></div>
					)}
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors text-4xl font-light'
					>
						×
					</button>
				</div>

				{/* Title */}
				<h2 className='text-xl font-bold text-black mb-6 text-left'>
					{isCreatingNew
						? 'Создание новой корзины'
						: 'Выберите в какую корзину добавить товар'}
				</h2>

				{!isCreatingNew ? (
					<>
						{/* Cart list */}
						<div className='space-y-3 mb-6'>
							{carts.map((cart, index) => (
								<label
									key={index}
									className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg ${
										selectedCart === `${cart}_${index}` ? 'bg-gray-bg' : ''
									}`}
								>
									<input
										type='checkbox'
										name='cart'
										value={`${cart}_${index}`}
										checked={selectedCart === `${cart}_${index}`}
										onChange={e => {
											if (e.target.checked) {
												setSelectedCart(e.target.value)
											} else {
												setSelectedCart('')
											}
										}}
										className='w-4 h-4 text-main1 focus:ring-main1 focus:ring-2 rounded'
									/>
									<span className='text-black'>{cart}</span>
								</label>
							))}
						</div>

						{/* Bottom section with create new cart and add button */}
						<div className='flex justify-between items-center'>
							<button
								onClick={() => setIsCreatingNew(true)}
								className='flex items-center space-x-2 text-black transition-colors'
							>
								<span className='text-2xl'>+</span>
								<span>Создать новую корзину</span>
							</button>
							<button
								onClick={handleSubmit}
								className='bg-main1 text-white px-16 py-3 rounded-xl font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
								disabled={!selectedCart}
							>
								Добавить
							</button>
						</div>
					</>
				) : (
					<>
						{/* Create new cart form */}
						<div className='mb-6'>
							<input
								type='text'
								placeholder='Введите название'
								value={newCartName}
								onChange={e => setNewCartName(e.target.value)}
								className='w-full px-4 py-3 rounded-xl border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								autoFocus
							/>
						</div>

						{/* Bottom section with create button */}
						<div className='flex justify-center'>
							<button
								onClick={handleSubmit}
								className='bg-main1 text-white px-16 py-3 rounded-xl font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
								disabled={!newCartName.trim()}
							>
								Создать
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
