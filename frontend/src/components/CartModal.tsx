'use client'

import { useState } from 'react'

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

	if (!isOpen) return null

	const handleSubmit = () => {
		if (isCreatingNew && newCartName.trim()) {
			onCreateNewCart(newCartName.trim())
		} else if (selectedCart) {
			onAddToCart(selectedCart)
		}
		onClose()
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-xl max-w-md w-full p-6'>
				{/* Header */}
				<div className='flex justify-between items-center mb-6'>
					<button
						onClick={onClose}
						className='text-gray hover:text-black transition-colors'
					>
						← Назад
					</button>
				</div>

				{/* Title */}
				<h2 className='text-xl font-bold text-black mb-6'>
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
									className='flex items-center space-x-3 cursor-pointer'
								>
									<input
										type='radio'
										name='cart'
										value={cart}
										checked={selectedCart === cart}
										onChange={e => setSelectedCart(e.target.value)}
										className='w-4 h-4 text-main1 focus:ring-main1'
									/>
									<span className='text-black'>{cart}</span>
								</label>
							))}
						</div>

						{/* Create new cart option */}
						<button
							onClick={() => setIsCreatingNew(true)}
							className='flex items-center space-x-2 text-main1 hover:text-main2 transition-colors mb-6'
						>
							<span className='text-lg'>+</span>
							<span>Создать новую корзину</span>
						</button>
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
								className='input-field'
								autoFocus
							/>
						</div>
					</>
				)}

				{/* Action button */}
				<button
					onClick={handleSubmit}
					className='w-full btn-primary'
					disabled={!selectedCart && (!isCreatingNew || !newCartName.trim())}
				>
					{isCreatingNew ? 'Создать' : 'Добавить'}
				</button>
			</div>
		</div>
	)
}
