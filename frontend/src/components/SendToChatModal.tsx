'use client'

import { chatService, messageService } from '@/services/api'
import { Chat } from '@/types'
import { useEffect, useState } from 'react'

interface SendToChatModalProps {
	isOpen: boolean
	onClose: () => void
	productIds: number[]
	selectedFormats: Record<number, string[]>
	basketId?: number
}

export default function SendToChatModal({
	isOpen,
	onClose,
	productIds,
	selectedFormats,
	basketId,
}: SendToChatModalProps) {
	const [chats, setChats] = useState<Chat[]>([])
	const [loading, setLoading] = useState(true)
	const [sending, setSending] = useState(false)

	useEffect(() => {
		if (isOpen) {
			fetchChats()
		}
	}, [isOpen])

	const fetchChats = async () => {
		try {
			const response = await chatService.getChats()
			setChats(response.results)
		} catch (error) {
			console.error('Ошибка при загрузке чатов:', error)
		} finally {
			setLoading(false)
		}
	}

	const handleSend = async (chatId: number) => {
		setSending(true)
		try {
			if (basketId) {
				await messageService.sendBasket(chatId, basketId)
			} else if (productIds.length > 0) {
				await messageService.sendProducts(chatId, productIds, selectedFormats)
			}
			onClose()
		} catch (error) {
			console.error('Ошибка при отправке:', error)
		} finally {
			setSending(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-md w-full p-8'>
				<div className='flex justify-end items-center mb-6'>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors text-4xl font-light'
					>
						×
					</button>
				</div>

				<h2 className='text-xl font-bold text-black mb-6 text-left'>
					Выберите чат для отправки
				</h2>

				{loading ? (
					<div className='flex items-center justify-center py-8'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
					</div>
				) : chats.length === 0 ? (
					<div className='text-center text-gray py-8'>
						<p>У вас пока нет чатов</p>
					</div>
				) : (
					<div className='space-y-2 max-h-96 overflow-y-auto'>
						{chats.map(chat => {
							const otherUser = chat.other_participant || chat.participant2
							return (
								<button
									key={chat.id}
									onClick={() => handleSend(chat.id)}
									disabled={sending}
									className='w-full text-left p-3 bg-gray-bg rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50'
								>
									<p className='text-sm font-medium text-black'>
										{otherUser?.username || 'Имя пользователя'}
									</p>
								</button>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
