'use client'

import { authService, chatService, messageService } from '@/services/api'
import { Chat, User } from '@/types'
import { ClipboardDocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

interface SendBasketModalProps {
	isOpen: boolean
	onClose: () => void
	basketId: number
	basketName?: string
}

export default function SendBasketModal({
	isOpen,
	onClose,
	basketId,
	basketName,
}: SendBasketModalProps) {
	const [sendToUser, setSendToUser] = useState(false)
	const [sendToEmail, setSendToEmail] = useState(true)
	const [email, setEmail] = useState('')
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
	const [users, setUsers] = useState<User[]>([])
	const [chats, setChats] = useState<Chat[]>([])
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(false)
	const [sending, setSending] = useState(false)
	const [linkCopied, setLinkCopied] = useState(false)

	useEffect(() => {
		if (isOpen) {
			fetchUsers()
			fetchChats()
		}
	}, [isOpen])

	const fetchUsers = async () => {
		try {
			setLoading(true)
			const uniqueUsers: User[] = []
			const userIds = new Set<number>()

			// Получаем текущего пользователя, чтобы исключить его из списка
			let currentUser: User | null = null
			try {
				currentUser = await authService.getCurrentUser()
			} catch (error) {
				console.error('Ошибка при загрузке текущего пользователя:', error)
			}

			// Получаем пользователей из чатов
			try {
				const chatsResponse = await chatService.getChats()
				const chats = chatsResponse?.results || []

				chats.forEach((chat: Chat) => {
					const otherUser = chat.other_participant || chat.participant2
					if (otherUser && !userIds.has(otherUser.id)) {
						// Исключаем текущего пользователя
						if (currentUser && otherUser.id === currentUser.id) {
							return
						}
						userIds.add(otherUser.id)
						uniqueUsers.push(otherUser)
					}
				})
			} catch (error) {
				console.error('Ошибка при загрузке чатов:', error)
			}

			// Получаем всех пользователей через поиск (пустая строка вернет всех активных)
			try {
				const searchResponse = await authService.searchUsers('')
				// Проверяем формат ответа (может быть массив или объект с results)
				const usersList = Array.isArray(searchResponse)
					? searchResponse
					: searchResponse?.results || []

				usersList.forEach((user: User) => {
					// Исключаем текущего пользователя
					if (currentUser && user.id === currentUser.id) {
						return
					}
					if (!userIds.has(user.id)) {
						userIds.add(user.id)
						uniqueUsers.push(user)
					}
				})
			} catch (error) {
				console.error('Ошибка при поиске пользователей:', error)
			}

			console.log('Загружено пользователей:', uniqueUsers.length)
			setUsers(uniqueUsers)
		} catch (error) {
			console.error('Ошибка при загрузке пользователей:', error)
			setUsers([])
		} finally {
			setLoading(false)
		}
	}

	const fetchChats = async () => {
		try {
			const response = await chatService.getChats()
			setChats(response?.results || [])
		} catch (error) {
			console.error('Ошибка при загрузке чатов:', error)
			setChats([])
		}
	}

	const handleSend = async () => {
		if (sendToUser && !selectedUserId) {
			alert('Выберите пользователя')
			return
		}

		if (sendToEmail && !email.trim()) {
			alert('Введите e-mail адрес')
			return
		}

		setSending(true)
		try {
			if (sendToUser && selectedUserId) {
				// Находим или создаем чат с выбранным пользователем
				let chat = chats.find(
					c =>
						(c.other_participant?.id === selectedUserId ||
							c.participant2?.id === selectedUserId) &&
						c.participant1?.id !== selectedUserId
				)

				// Если чата нет, создаем его
				if (!chat) {
					try {
						chat = await chatService.createChat(selectedUserId)
						console.log('Создан чат:', chat)

						// Обновляем список чатов после создания нового
						await fetchChats()

						// Проверяем, что chat.id существует
						if (!chat || !chat.id) {
							console.error('Чат создан, но не содержит ID:', chat)
							alert('Ошибка: не удалось получить ID созданного чата')
							return
						}
					} catch (chatError: any) {
						console.error('Ошибка при создании чата:', chatError)
						const errorMessage =
							chatError.response?.data?.detail ||
							chatError.response?.data?.error ||
							chatError.message ||
							'Ошибка при создании чата'
						alert(`Ошибка при создании чата: ${errorMessage}`)
						return
					}
				}

				// Проверяем, что chat.id существует и является числом
				if (!chat || !chat.id) {
					console.error('Чат не содержит ID:', chat)
					alert('Ошибка: не удалось получить ID чата')
					return
				}

				console.log('Используем чат с ID:', chat.id)

				// Отправляем корзину
				try {
					await messageService.sendBasket(Number(chat.id), Number(basketId))
				} catch (basketError: any) {
					console.error('Ошибка при отправке корзины:', basketError)
					const errorMessage =
						basketError.response?.data?.basket_id?.[0] ||
						basketError.response?.data?.detail ||
						basketError.response?.data?.error ||
						basketError.message ||
						'Ошибка при отправке корзины'
					alert(`Ошибка при отправке корзины: ${errorMessage}`)
					return
				}

				// Если есть комментарий, отправляем его отдельным сообщением
				if (comment.trim()) {
					try {
						await messageService.sendTextMessage(
							Number(chat.id),
							comment.trim()
						)
					} catch (commentError: any) {
						console.error('Ошибка при отправке комментария:', commentError)
						// Не блокируем успешную отправку корзины, если комментарий не отправился
					}
				}
			} else if (sendToEmail) {
				// TODO: Реализовать отправку на email
				alert('Отправка на email будет реализована позже')
				return
			}

			onClose()
			setComment('')
			setEmail('')
			setSelectedUserId(null)
		} catch (error: any) {
			console.error('Ошибка при отправке:', error)
			const errorMessage =
				error.response?.data?.detail ||
				error.response?.data?.error ||
				error.message ||
				'Ошибка при отправке корзины'
			alert(`Ошибка: ${errorMessage}`)
		} finally {
			setSending(false)
		}
	}

	const handleCopyLink = () => {
		const basketUrl = `${window.location.origin}/profile/basket/${basketId}`
		navigator.clipboard.writeText(basketUrl)
		setLinkCopied(true)
		setTimeout(() => setLinkCopied(false), 2000)
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-2xl w-full p-8 relative'>
				{/* Header with title and close button */}
				<div className='flex items-center justify-between mb-6'>
					<h2 className='text-2xl font-bold text-black'>
						Выберите способ отправки товара
					</h2>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Send options - side by side */}
				<div className='grid grid-cols-2 gap-4 mb-6'>
					{/* Send to VizHub.art user */}
					<label
						className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border transition-colors ${
							sendToUser
								? 'border-main1 bg-white'
								: 'border-gray2 bg-white hover:bg-gray-bg'
						}`}
					>
						<input
							type='checkbox'
							checked={sendToUser}
							onChange={e => {
								setSendToUser(e.target.checked)
								if (e.target.checked) {
									setSendToEmail(false)
								}
							}}
							className='w-4 h-4 text-main1 focus:ring-main1 border-gray2 rounded'
						/>
						<span className='text-black'>Пользователю VizHub.art</span>
					</label>

					{/* Send to email */}
					<label
						className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border transition-colors ${
							sendToEmail
								? 'border-gray2 bg-gray-bg'
								: 'border-gray2 bg-white hover:bg-gray-bg'
						}`}
					>
						<input
							type='checkbox'
							checked={sendToEmail}
							onChange={e => {
								setSendToEmail(e.target.checked)
								if (e.target.checked) {
									setSendToUser(false)
								}
							}}
							className='w-4 h-4 text-main1 focus:ring-main1 border-gray2 rounded'
						/>
						<span className='text-black'>Отправка на е-mail</span>
					</label>
				</div>

				{/* User selection */}
				{sendToUser && (
					<div className='mb-6'>
						<label className='block text-sm font-medium text-gray mb-2'>
							Выберите пользователя
						</label>
						{loading ? (
							<div className='flex items-center justify-center py-4'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-main1'></div>
							</div>
						) : users.length === 0 ? (
							<div className='px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-gray text-sm'>
								Пользователи не найдены. Убедитесь, что в системе есть другие
								активные пользователи.
							</div>
						) : (
							<select
								value={selectedUserId || ''}
								onChange={e =>
									setSelectedUserId(Number(e.target.value) || null)
								}
								className='w-full px-4 py-3 rounded-lg border border-gray2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
							>
								<option value=''>Выберите пользователя</option>
								{users.map(user => (
									<option key={user.id} value={user.id}>
										{user.username || user.email || `Пользователь #${user.id}`}
									</option>
								))}
							</select>
						)}
					</div>
				)}

				{/* Email input */}
				{sendToEmail && (
					<div className='mb-6'>
						<input
							type='email'
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder='Введите e-mail'
							className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
						/>
					</div>
				)}

				{/* Comment */}
				<div className='mb-6'>
					<textarea
						value={comment}
						onChange={e => setComment(e.target.value)}
						placeholder='Комментарий'
						rows={4}
						className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent resize-none'
					/>
				</div>

				{/* Action buttons */}
				<div className='flex items-center gap-3'>
					<button
						onClick={handleCopyLink}
						className='flex items-center gap-2 px-4 py-2 bg-gray-bg text-black rounded-lg hover:bg-gray-200 transition-colors text-sm'
					>
						<ClipboardDocumentIcon className='w-5 h-5' />
						{linkCopied ? 'Ссылка скопирована!' : 'Скопировать ссылку'}
					</button>
					<button
						onClick={handleSend}
						disabled={
							sending ||
							(sendToUser && !selectedUserId) ||
							(sendToEmail && !email.trim())
						}
						className='flex-1 bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{sending ? 'Отправка...' : 'Отправить'}
					</button>
				</div>
			</div>
		</div>
	)
}
