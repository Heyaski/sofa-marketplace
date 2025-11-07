'use client'

import {
	ArrowDownTrayIcon,
	ChatBubbleLeftRightIcon,
	MapPinIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import apiClient from '../lib/api'
import { Basket } from '../types'
import CreateBasketModal from './CreateBasketModal'

interface BasketsListProps {
	baskets: Basket[]
	onRefresh: () => void
}

export default function BasketsList({ baskets, onRefresh }: BasketsListProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
	const [basketToDelete, setBasketToDelete] = useState<Basket | null>(null)

	const handleCreateSuccess = () => {
		setIsCreateModalOpen(false)
		onRefresh()
	}

	const handleDeleteClick = (basket: Basket) => {
		setBasketToDelete(basket)
		setIsDeleteModalOpen(true)
	}

	const handleDeleteConfirm = async () => {
		if (!basketToDelete) return

		try {
			await apiClient.delete(`/api/baskets/${basketToDelete.id}/`)
			setIsDeleteModalOpen(false)
			setBasketToDelete(null)
			onRefresh()
		} catch (error) {
			console.error('Ошибка при удалении корзины:', error)
		}
	}

	const handlePin = async (basketId: number) => {
		// TODO: Добавить функционал закрепления
		console.log('Закрепить корзину:', basketId)
	}

	const handleDownload = async (basket: Basket) => {
		// TODO: Добавить функционал скачивания
		console.log('Скачать корзину:', basket.name)
	}

	const handleShare = async (basket: Basket) => {
		// TODO: Добавить функционал совместного доступа
		console.log('Поделиться корзиной:', basket.name)
	}

	return (
		<>
			<div className='flex items-center justify-between mb-6'>
				<h1 className='text-3xl font-bold text-black'>Корзина / проекты</h1>
				<button
					onClick={() => setIsCreateModalOpen(true)}
					className='bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
				>
					+ Создать проект (корзину)
				</button>
			</div>

			{/* Список корзин */}
			<div className='space-y-0'>
				{baskets.length === 0 ? (
					<p className='text-gray text-center py-8'>У вас пока нет корзин</p>
				) : (
					baskets.map((basket, index) => (
						<div
							key={basket.id}
							className={`flex items-center justify-between p-4 hover:bg-gray-bg transition-colors ${
								index !== baskets.length - 1 ? 'border-b border-gray2' : ''
							}`}
						>
							<a
								href={`/profile/basket/${basket.id}`}
								className='text-black font-medium flex-1 hover:underline'
							>
								{basket.name || 'Проект_Квартира_Ивановых'}
							</a>

							<div className='flex items-center gap-3'>
								{/* Pin button */}
								<button
									onClick={() => handlePin(basket.id)}
									className='text-gray hover:text-main1 transition-colors'
									title='Закрепить'
								>
									<MapPinIcon className='w-5 h-5' />
								</button>

								{/* Share button */}
								<button
									onClick={() => handleShare(basket)}
									className='text-gray hover:text-main1 transition-colors'
									title='Поделиться'
								>
									<ChatBubbleLeftRightIcon className='w-5 h-5' />
								</button>

								{/* Download button */}
								<button
									onClick={() => handleDownload(basket)}
									className='text-gray hover:text-main1 transition-colors'
									title='Скачать'
								>
									<ArrowDownTrayIcon className='w-5 h-5' />
								</button>

								{/* Delete button */}
								<button
									onClick={() => handleDeleteClick(basket)}
									className='text-red-500 hover:text-red-700 transition-colors'
									title='Удалить'
								>
									<TrashIcon className='w-5 h-5' />
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{/* Модальное окно подтверждения удаления */}
			{isDeleteModalOpen && basketToDelete && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
					<div className='bg-white rounded-lg p-6 max-w-md w-full'>
						<h3 className='text-xl font-bold text-black mb-4'>
							Удалить корзину?
						</h3>
						<p className='text-gray mb-6'>
							Вы уверены, что хотите удалить корзину &quot;{basketToDelete.name}
							&quot;? Это действие нельзя отменить.
						</p>
						<div className='flex gap-3 justify-end'>
							<button
								onClick={() => {
									setIsDeleteModalOpen(false)
									setBasketToDelete(null)
								}}
								className='px-4 py-2 border border-gray2 rounded-lg hover:bg-gray-100 transition-colors'
							>
								Отмена
							</button>
							<button
								onClick={handleDeleteConfirm}
								className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
							>
								Удалить
							</button>
						</div>
					</div>
				</div>
			)}

			<CreateBasketModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={handleCreateSuccess}
			/>
		</>
	)
}
