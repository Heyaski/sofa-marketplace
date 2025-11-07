'use client'

import { chatService } from '@/services/api'
import { Chat } from '@/types'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import CreateChatModal from './CreateChatModal'

interface ChatsListProps {
	onSelectChat: (chat: Chat) => void
	selectedChatId?: number
}

export default function ChatsList({
	onSelectChat,
	selectedChatId,
}: ChatsListProps) {
	const [chats, setChats] = useState<Chat[]>([])
	const [loading, setLoading] = useState(true)
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

	useEffect(() => {
		fetchChats()
	}, [])

	const fetchChats = async () => {
		try {
			const response = await chatService.getChats()
			// Проверяем, что response существует
			if (!response) {
				setChats([])
				return
			}

			// Проверяем, что response имеет поле results (пагинированный ответ)
			if (response.results && Array.isArray(response.results)) {
				setChats(response.results)
			} else if (Array.isArray(response)) {
				// Если response - это массив напрямую
				setChats(response)
			} else {
				// Если формат ответа неожиданный, устанавливаем пустой массив
				setChats([])
			}
		} catch (error) {
			console.error('Ошибка при загрузке чатов:', error)
			setChats([]) // Устанавливаем пустой массив при ошибке
		} finally {
			setLoading(false)
		}
	}

	const formatTime = (dateString: string) => {
		const date = new Date(dateString)
		const hours = date.getHours().toString().padStart(2, '0')
		const minutes = date.getMinutes().toString().padStart(2, '0')
		return `${hours}:${minutes}`
	}

	const getPreviewText = (chat: Chat) => {
		if (!chat.last_message) return ''
		if (chat.last_message.message_type === 'product') {
			return 'Товар'
		}
		if (chat.last_message.message_type === 'basket') {
			return 'Корзина'
		}
		return chat.last_message.content || ''
	}

	if (loading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
			</div>
		)
	}

	const handleChatCreated = (chat: Chat) => {
		// Обновляем список чатов и открываем новый чат
		fetchChats()
		onSelectChat(chat)
	}

	return (
		<div>
			{/* Кнопка создания нового чата */}
			<button
				onClick={() => setIsCreateModalOpen(true)}
				className='w-full mb-4 bg-main1 text-white px-4 py-3 rounded-lg hover:bg-main2 transition-colors font-medium'
			>
				+ Новый чат
			</button>

			{/* Модальное окно создания чата */}
			<CreateChatModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onChatCreated={handleChatCreated}
			/>

			<div className='space-y-2'>
				{!chats || chats.length === 0 ? (
					<div className='text-center text-gray py-8'>
						<p>У вас пока нет чатов</p>
					</div>
				) : (
					chats.map(chat => {
						const otherUser = chat.other_participant || chat.participant2
						const isSelected = selectedChatId === chat.id
						const previewText = getPreviewText(chat)

						return (
							<div
								key={chat.id}
								onClick={() => onSelectChat(chat)}
								className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
									isSelected ? 'bg-main1 text-white' : 'hover:bg-gray-bg'
								}`}
							>
								{/* Avatar */}
								<div className='flex-shrink-0 w-12 h-12 rounded-full bg-gray-bg overflow-hidden'>
									<Image
										src='/img/profile_default.svg'
										alt={otherUser?.username || 'User'}
										width={48}
										height={48}
										className='w-full h-full object-cover'
									/>
								</div>

								{/* Content */}
								<div className='flex-1 min-w-0'>
									<div className='flex items-center justify-between mb-1'>
										<h3
											className={`font-medium text-sm truncate ${
												isSelected ? 'text-white' : 'text-black'
											}`}
										>
											{otherUser?.username || 'Имя пользователя'}
										</h3>
										{chat.last_message && (
											<span
												className={`text-xs flex-shrink-0 ml-2 ${
													isSelected ? 'text-white/80' : 'text-gray'
												}`}
											>
												{formatTime(chat.last_message.created_at)}
											</span>
										)}
									</div>
									<div className='flex items-center justify-between'>
										<p
											className={`text-xs truncate flex-1 ${
												isSelected ? 'text-white/80' : 'text-gray'
											}`}
										>
											{previewText}
										</p>
										{chat.unread_count > 0 && (
											<div className='flex items-center gap-2 ml-2'>
												{chat.is_pinned && (
													<svg
														className={`w-4 h-4 ${
															isSelected ? 'text-white' : 'text-gray'
														}`}
														fill='currentColor'
														viewBox='0 0 20 20'
													>
														<path d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' />
													</svg>
												)}
												<span
													className={`text-xs font-medium px-2 py-0.5 rounded-full ${
														isSelected
															? 'bg-white text-main1'
															: 'bg-main1 text-white'
													}`}
												>
													{chat.unread_count}
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}
