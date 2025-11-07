'use client'

import { basketService, messageService } from '@/services/api'
import { Basket, Chat, Message } from '@/types'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface ChatDetailProps {
	chat: Chat | null
	onBack: () => void
	currentUserId: number
}

export default function ChatDetail({
	chat,
	onBack,
	currentUserId,
}: ChatDetailProps) {
	const router = useRouter()
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(true)
	const [messageText, setMessageText] = useState('')
	const [baskets, setBaskets] = useState<Basket[]>([])
	const [showBasketSelector, setShowBasketSelector] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (chat) {
			fetchMessages()
			fetchBaskets()
		}
	}, [chat])

	useEffect(() => {
		// Отмечаем сообщения как прочитанные после загрузки сообщений
		if (chat?.id && !loading && messages && messages.length >= 0) {
			// Небольшая задержка, чтобы убедиться, что все загружено
			const timeoutId = setTimeout(() => {
				messageService.markChatRead(chat.id).catch(error => {
					// Игнорируем ошибку 400, 404, 403 - это нормально, если чат только создан
					const status = error.response?.status
					if (status && ![400, 404, 403].includes(status)) {
						console.error(
							'Ошибка при отметке сообщений как прочитанных:',
							error
						)
					}
				})
			}, 500)

			return () => clearTimeout(timeoutId)
		}
	}, [chat?.id, loading, messages?.length])

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	const fetchMessages = async () => {
		if (!chat) return
		try {
			const response = await messageService.getMessages(chat.id)
			// Проверяем формат ответа (может быть массив или объект с results)
			if (response && response.results && Array.isArray(response.results)) {
				setMessages(response.results)
			} else if (Array.isArray(response)) {
				setMessages(response)
			} else {
				setMessages([])
			}
		} catch (error) {
			console.error('Ошибка при загрузке сообщений:', error)
			setMessages([]) // Устанавливаем пустой массив при ошибке
		} finally {
			setLoading(false)
		}
	}

	const fetchBaskets = async () => {
		try {
			const response = await basketService.getBaskets()
			// Проверяем формат ответа (может быть массив или объект с results)
			if (response && response.results && Array.isArray(response.results)) {
				setBaskets(response.results)
			} else if (Array.isArray(response)) {
				setBaskets(response)
			} else {
				setBaskets([])
			}
		} catch (error) {
			console.error('Ошибка при загрузке корзин:', error)
			setBaskets([]) // Устанавливаем пустой массив при ошибке
		}
	}

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	const handleSendMessage = async () => {
		if (!chat || !messageText.trim()) return

		try {
			const newMessage = await messageService.sendTextMessage(
				chat.id,
				messageText.trim()
			)
			// Проверяем, что сообщение имеет sender перед добавлением
			if (newMessage && newMessage.sender) {
				setMessages(prev => [...(prev || []), newMessage])
			} else {
				// Если sender отсутствует, перезагружаем сообщения
				await fetchMessages()
			}
			setMessageText('')
		} catch (error: any) {
			console.error('Ошибка при отправке сообщения:', error)
			// Показываем более детальную ошибку
			const errorData = error.response?.data
			if (errorData) {
				console.error('Детали ошибки:', errorData)
			}
		}
	}

	const handleSendBasket = async (basketId: number) => {
		if (!chat) return

		try {
			const newMessage = await messageService.sendBasket(chat.id, basketId)
			setMessages([...messages, newMessage])
			setShowBasketSelector(false)
		} catch (error) {
			console.error('Ошибка при отправке корзины:', error)
		}
	}

	const formatTime = (dateString: string) => {
		const date = new Date(dateString)
		const hours = date.getHours().toString().padStart(2, '0')
		const minutes = date.getMinutes().toString().padStart(2, '0')
		return `${hours}:${minutes}`
	}

	if (!chat) {
		return (
			<div className='flex items-center justify-center h-full text-gray'>
				<p>Выберите чат для просмотра</p>
			</div>
		)
	}

	const otherUser = chat.other_participant || chat.participant2

	return (
		<div className='flex flex-col h-full'>
			{/* Header */}
			<div className='flex items-center justify-between p-4 border-b border-gray2'>
				<div className='flex items-center gap-3'>
					<button
						onClick={onBack}
						className='text-gray hover:text-main1 transition-colors'
					>
						&lt; Назад
					</button>
					<h2 className='text-lg font-semibold text-black'>
						{otherUser?.username || 'Имя пользователя'}
					</h2>
				</div>
				<div className='w-10 h-10 rounded-full bg-gray-bg overflow-hidden'>
					<Image
						src='/img/profile_default.svg'
						alt={otherUser?.username || 'User'}
						width={40}
						height={40}
						className='w-full h-full object-cover'
					/>
				</div>
			</div>

			{/* Messages */}
			<div className='flex-1 overflow-y-auto p-4 space-y-4'>
				{loading ? (
					<div className='flex items-center justify-center h-full'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
					</div>
				) : messages.length === 0 ? (
					<div className='text-center text-gray py-8'>
						<p>Нет сообщений</p>
					</div>
				) : (
					messages
						.filter(message => message.sender) // Фильтруем сообщения без sender
						.map(message => {
							const isOwn = message.sender?.id === currentUserId

							return (
								<div
									key={message.id}
									className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
								>
									<div
										className={`max-w-[70%] ${
											isOwn ? 'bg-main1 text-white' : 'bg-gray-bg text-black'
										} rounded-lg p-3`}
									>
										{/* Text message */}
										{message.message_type === 'text' && (
											<p className='text-sm'>{message.content}</p>
										)}

										{/* Product message */}
										{message.message_type === 'product' &&
											message.products &&
											message.products.map(productMsg => (
												<div
													key={productMsg.id}
													className='bg-white rounded-lg p-3 mb-2 last:mb-0'
												>
													<div className='flex gap-3'>
														<div className='w-16 h-16 bg-gray-bg rounded-lg overflow-hidden flex-shrink-0'>
															{productMsg.product.image ? (
																<Image
																	src={productMsg.product.image}
																	alt={productMsg.product.title}
																	width={64}
																	height={64}
																	className='w-full h-full object-cover'
																/>
															) : (
																<div className='w-full h-full flex items-center justify-center text-gray text-xs'>
																	Нет фото
																</div>
															)}
														</div>
														<div className='flex-1'>
															<p className='text-sm font-medium text-black mb-2'>
																{productMsg.product.title}
															</p>
															<div className='flex flex-wrap gap-2'>
																{['.rfa', '.glb', '.fbx'].map(format => (
																	<label
																		key={format}
																		className='flex items-center gap-1 cursor-pointer'
																	>
																		<input
																			type='checkbox'
																			checked={productMsg.selected_formats.includes(
																				format
																			)}
																			readOnly
																			className='w-3 h-3 text-main1 focus:ring-main1 focus:ring-2 rounded'
																		/>
																		<span className='text-xs text-black'>
																			{format}
																		</span>
																	</label>
																))}
															</div>
														</div>
													</div>
												</div>
											))}

										{/* Basket message */}
										{message.message_type === 'basket' &&
											message.baskets &&
											message.baskets.map(basketMsg => (
												<button
													key={basketMsg.id}
													onClick={() =>
														router.push(
															`/profile/basket/${basketMsg.basket.id}`
														)
													}
													className='bg-white rounded-lg p-3 mb-2 last:mb-0 hover:bg-gray-50 transition-colors w-full text-left'
												>
													<div className='flex items-center gap-2'>
														<svg
															className='w-5 h-5 text-gray'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'
														>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																strokeWidth={2}
																d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
															/>
														</svg>
														<p className='text-sm font-medium text-black'>
															{basketMsg.basket.name}
														</p>
													</div>
												</button>
											))}

										<span
											className={`text-xs mt-2 block ${
												isOwn ? 'text-white/70' : 'text-gray'
											}`}
										>
											{formatTime(message.created_at)}
										</span>
									</div>
								</div>
							)
						})
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input area */}
			<div className='border-t border-gray2 p-4'>
				{showBasketSelector ? (
					<div className='mb-4'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-sm font-medium text-black'>
								Выберите корзину для отправки:
							</h3>
							<button
								onClick={() => setShowBasketSelector(false)}
								className='text-gray hover:text-main1'
							>
								✕
							</button>
						</div>
						<div className='space-y-2 max-h-40 overflow-y-auto'>
							{!baskets || baskets.length === 0 ? (
								<p className='text-sm text-gray'>Нет корзин</p>
							) : (
								baskets.map(basket => (
									<button
										key={basket.id}
										onClick={() => handleSendBasket(basket.id)}
										className='w-full text-left p-2 bg-gray-bg rounded-lg hover:bg-gray-200 transition-colors'
									>
										<p className='text-sm font-medium text-black'>
											{basket.name}
										</p>
									</button>
								))
							)}
						</div>
					</div>
				) : null}

				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={messageText}
						onChange={e => setMessageText(e.target.value)}
						onKeyDown={e => {
							if (e.key === 'Enter') {
								handleSendMessage()
							}
						}}
						placeholder='Введите сообщение'
						className='flex-1 px-4 py-2 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1'
					/>
					<button
						onClick={() => setShowBasketSelector(!showBasketSelector)}
						className='p-2 text-gray hover:text-main1 transition-colors'
						title='Отправить корзину'
					>
						<svg
							className='w-5 h-5'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'
							/>
						</svg>
					</button>
					<button
						onClick={handleSendMessage}
						disabled={!messageText.trim()}
						className='bg-main1 text-white px-6 py-2 rounded-lg font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
					>
						Отправить
					</button>
				</div>
			</div>
		</div>
	)
}
