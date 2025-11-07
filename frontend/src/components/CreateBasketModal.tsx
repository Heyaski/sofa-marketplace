'use client'

import { useState } from 'react'
import { basketService } from '../services/api'

interface CreateBasketModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess: () => void
}

export default function CreateBasketModal({
	isOpen,
	onClose,
	onSuccess,
}: CreateBasketModalProps) {
	const [basketName, setBasketName] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	if (!isOpen) return null

	const handleSubmit = async () => {
		if (!basketName.trim()) return

		setLoading(true)
		setError(null)

		try {
			await basketService.createBasket(basketName.trim())
			setBasketName('')
			onSuccess()
		} catch (err: any) {
			setError(err.response?.data?.detail || 'Ошибка при создании корзины')
		} finally {
			setLoading(false)
		}
	}

	const handleClose = () => {
		setBasketName('')
		setError(null)
		onClose()
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-md w-full p-8'>
				{/* Header */}
				<div className='flex justify-end items-center mb-6'>
					<button
						onClick={handleClose}
						className='text-black hover:text-gray transition-colors text-4xl font-light'
					>
						×
					</button>
				</div>

				{/* Title */}
				<h2 className='text-xl font-bold text-black mb-6 text-left'>
					Создание новой корзины
				</h2>

				{/* Error message */}
				{error && (
					<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-red-600 text-sm'>{error}</p>
					</div>
				)}

				{/* Form */}
				<div className='mb-6'>
					<input
						type='text'
						placeholder='Введите название корзины'
						value={basketName}
						onChange={e => setBasketName(e.target.value)}
						className='w-full px-4 py-3 rounded-xl border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
						autoFocus
						onKeyDown={e => {
							if (e.key === 'Enter') {
								handleSubmit()
							}
						}}
					/>
				</div>

				{/* Bottom */}
				<div className='flex justify-center'>
					<button
						onClick={handleSubmit}
						disabled={loading || !basketName.trim()}
						className='bg-main1 text-white px-16 py-3 rounded-xl font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{loading ? 'Создание...' : 'Создать'}
					</button>
				</div>
			</div>
		</div>
	)
}
