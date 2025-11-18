'use client'

import { authService, chatService } from '@/services/api'
import { Chat, User } from '@/types'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

interface CreateChatModalProps {
	isOpen: boolean
	onClose: () => void
	onChatCreated: (chat: Chat) => void
}

export default function CreateChatModal({
	isOpen,
	onClose,
	onChatCreated,
}: CreateChatModalProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [users, setUsers] = useState<User[]>([])
	const [loading, setLoading] = useState(false)
	const [creating, setCreating] = useState(false)
	const [currentUser, setCurrentUser] = useState<User | null>(null)

	const fetchCurrentUser = async () => {
		try {
			const user = await authService.getCurrentUser()
			setCurrentUser(user)
		} catch (error) {
			console.error('Ошибка при загрузке текущего пользователя:', error)
		}
	}

	const searchUsers = useCallback(async () => {
		if (!searchQuery.trim()) {
			setUsers([])
			return
		}

		setLoading(true)
		try {
			const response = await authService.searchUsers(searchQuery.trim())
			// response всегда массив User[]
			const usersList = Array.isArray(response) ? response : []

			// Фильтруем текущего пользователя из результатов
			const filteredUsers = usersList.filter(
				user => user.id !== currentUser?.id
			)
			setUsers(filteredUsers)
		} catch (error) {
			console.error('Ошибка при поиске пользователей:', error)
			setUsers([])
		} finally {
			setLoading(false)
		}
	}, [searchQuery, currentUser])

	useEffect(() => {
		if (isOpen) {
			fetchCurrentUser()
		}
	}, [isOpen])

	useEffect(() => {
		if (isOpen && searchQuery.trim()) {
			const timeoutId = setTimeout(() => {
				searchUsers()
			}, 300) // Debounce 300ms

			return () => clearTimeout(timeoutId)
		} else {
			setUsers([])
		}
	}, [searchQuery, isOpen, searchUsers])

	const handleCreateChat = async (userId: number) => {
		setCreating(true)
		try {
			const chat = await chatService.createChat(userId)
			onChatCreated(chat)
			handleClose()
		} catch (error) {
			console.error('Ошибка при создании чата:', error)
		} finally {
			setCreating(false)
		}
	}

	const handleClose = () => {
		setSearchQuery('')
		setUsers([])
		onClose()
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-md w-full p-8'>
				<div className='flex justify-end items-center mb-6'>
					<button
						onClick={handleClose}
						className='text-black hover:text-gray transition-colors text-4xl font-light'
					>
						×
					</button>
				</div>

				<h2 className='text-xl font-bold text-black mb-6 text-left'>
					Новый чат
				</h2>

				{/* Поиск */}
				<div className='mb-6'>
					<input
						type='text'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						placeholder='Поиск по имени пользователя или email...'
						className='w-full px-4 py-3 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1'
						autoFocus
					/>
				</div>

				{/* Список пользователей */}
				<div className='max-h-96 overflow-y-auto'>
					{loading ? (
						<div className='flex items-center justify-center py-8'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
						</div>
					) : searchQuery.trim() === '' ? (
						<div className='text-center text-gray py-8'>
							<p>Введите имя пользователя или email для поиска</p>
						</div>
					) : users.length === 0 ? (
						<div className='text-center text-gray py-8'>
							<p>Пользователи не найдены</p>
						</div>
					) : (
						<div className='space-y-2'>
							{users.map(user => (
								<button
									key={user.id}
									onClick={() => handleCreateChat(user.id)}
									disabled={creating}
									className='w-full flex items-center gap-3 p-3 bg-gray-bg rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-left'
								>
									<div className='flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 overflow-hidden'>
										<Image
											src='/img/profile_default.svg'
											alt={user.username}
											width={40}
											height={40}
											className='w-full h-full object-cover'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<p className='text-sm font-medium text-black truncate'>
											{user.username}
										</p>
										{user.email && (
											<p className='text-xs text-gray truncate'>{user.email}</p>
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
