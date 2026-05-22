'use client'

import VoiceMessage from '@/components/VoiceMessage'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { basketService, messageService } from '@/services/api'
import { Basket, Chat, Message } from '@/types'
import { formatAudioDuration } from '@/utils/formatAudioDuration'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type InputMode = 'text' | 'voice'

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
	const [inputMode, setInputMode] = useState<InputMode>('text')
	const [sendingVoice, setSendingVoice] = useState(false)
	const [baskets, setBaskets] = useState<Basket[]>([])
	const [showBasketSelector, setShowBasketSelector] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const voiceRecorder = useVoiceRecorder()

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
		const container = messagesContainerRef.current
		if (container) {
			container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
		}
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

	const handleSendVoice = async () => {
		if (!chat) return
		const file = voiceRecorder.getFileForUpload()
		if (!file) return

		setSendingVoice(true)
		try {
			const newMessage = await messageService.sendVoiceMessage(
				chat.id,
				file,
				voiceRecorder.duration
			)
			if (newMessage?.sender) {
				setMessages(prev => [...(prev || []), newMessage])
			} else {
				await fetchMessages()
			}
			voiceRecorder.clearPreview()
			setInputMode('text')
		} catch (error) {
			console.error('Ошибка при отправке голосового:', error)
		} finally {
			setSendingVoice(false)
		}
	}

	const switchInputMode = (mode: InputMode) => {
		if (voiceRecorder.isRecording) {
			voiceRecorder.cancelRecording()
		}
		if (mode === 'text') {
			voiceRecorder.clearPreview()
		}
		setInputMode(mode)
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
	const isGroupChat = chat.chat_type === 'group'
	const participants = chat.participants_list || []

	return (
		<div className='flex flex-col h-full'>
			{/* Header */}
			<div className='flex items-center gap-3 p-3 sm:p-4 border-b border-gray2'>
				<button
					onClick={onBack}
					className='text-gray hover:text-main1 transition-colors flex-shrink-0 text-sm py-1'
				>
					&lt; Назад
				</button>
				<h2 className='flex-1 min-w-0 text-base sm:text-lg font-semibold text-black truncate text-center'>
					{isGroupChat
						? chat.name || 'Групповой чат'
						: otherUser?.username || 'Имя пользователя'}
				</h2>
				{!isGroupChat ? (
					<div className='w-10 h-10 rounded-full bg-gray-bg overflow-hidden flex-shrink-0'>
						<Image
							src='/img/profile_default.svg'
							alt={otherUser?.username || 'User'}
							width={40}
							height={40}
							className='w-full h-full object-cover'
						/>
					</div>
				) : (
					<div className='flex -space-x-2 flex-shrink-0'>
						{participants.slice(0, 3).map((participant, idx) => (
							<div
								key={participant.id}
								className='w-10 h-10 rounded-full bg-gray-bg overflow-hidden border-2 border-white'
								style={{ zIndex: 10 - idx }}
							>
								<Image
									src='/img/profile_default.svg'
									alt={participant.username}
									width={40}
									height={40}
									className='w-full h-full object-cover'
								/>
							</div>
						))}
						{participants.length > 3 && (
							<div className='w-10 h-10 rounded-full bg-main1 text-white flex items-center justify-center text-xs font-medium border-2 border-white'>
								+{participants.length - 3}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Messages */}
			<div
				ref={messagesContainerRef}
				className='flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4'
			>
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

										{/* Voice message */}
										{message.message_type === 'voice' &&
											message.voice_file_url && (
												<VoiceMessage
													url={message.voice_file_url}
													duration={message.voice_duration || 0}
													isOwn={isOwn}
												/>
											)}

										{/* Product message */}
										{message.message_type === 'product' &&
											message.products &&
											message.products.map(productMsg => (
												<div
													key={productMsg.id}
													className='bg-white rounded-lg p-3 mb-2 last:mb-0'
												>
													<p className='text-xs text-gray mb-2'>Товар</p>
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
																{productMsg.product.title_display ?? getTitleWithoutBrand(productMsg.product.title || '', productMsg.product.brand) ?? productMsg.product.title}
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
															className='w-5 h-5 text-main1 flex-shrink-0'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'
														>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																strokeWidth={2}
																d='M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
															/>
														</svg>
														<div className='text-left'>
															<p className='text-xs text-gray'>Корзина</p>
															<p className='text-sm font-medium text-black'>
																{basketMsg.basket.name}
															</p>
														</div>
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
			<div className='border-t border-gray2 p-3 sm:p-4'>
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

				{voiceRecorder.error && (
					<p className='text-sm text-red-600 mb-2'>{voiceRecorder.error}</p>
				)}

				<div className='flex items-center gap-1 sm:gap-1.5 mb-2'>
					<button
						type='button'
						onClick={() => switchInputMode('text')}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
							inputMode === 'text'
								? 'bg-main1 text-white'
								: 'bg-gray-bg text-gray hover:text-black'
						}`}
					>
						Текст
					</button>
					<button
						type='button'
						onClick={() => switchInputMode('voice')}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
							inputMode === 'voice'
								? 'bg-main1 text-white'
								: 'bg-gray-bg text-gray hover:text-black'
						}`}
					>
						Голос
					</button>
				</div>

				{inputMode === 'text' ? (
					<div className='flex items-center gap-1.5 sm:gap-2 min-w-0'>
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
							className='flex-1 min-w-0 px-3 py-2 sm:px-4 rounded-lg bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 text-sm sm:text-base'
						/>
						<button
							onClick={() => setShowBasketSelector(!showBasketSelector)}
							className='p-2 flex-shrink-0 text-gray hover:text-main1 transition-colors'
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
							title='Отправить'
							aria-label='Отправить'
							className='bg-main1 text-white px-3 py-2 sm:px-5 rounded-lg font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex-shrink-0'
						>
							<span className='hidden sm:inline'>Отправить</span>
							<svg
								className='w-5 h-5 sm:hidden'
								fill='currentColor'
								viewBox='0 0 24 24'
								aria-hidden
							>
								<path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
							</svg>
						</button>
					</div>
				) : (
					<div className='flex flex-col gap-3'>
						{voiceRecorder.previewUrl ? (
							<div className='flex items-center gap-3 p-3 bg-gray-bg rounded-lg'>
								<audio
									src={voiceRecorder.previewUrl}
									controls
									className='flex-1 h-9 min-w-0'
								/>
								<span className='text-sm text-gray flex-shrink-0'>
									{formatAudioDuration(voiceRecorder.duration)}
								</span>
							</div>
						) : (
							<div className='flex items-center justify-center gap-4 py-2'>
								{voiceRecorder.isRecording ? (
									<>
										<span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
										<span className='text-sm font-medium text-black'>
											Запись {formatAudioDuration(voiceRecorder.duration)}
										</span>
									</>
								) : (
									<p className='text-sm text-gray'>
										Нажмите кнопку, чтобы начать запись
									</p>
								)}
							</div>
						)}

						<div className='flex items-center justify-center gap-3'>
							{voiceRecorder.previewUrl ? (
								<>
									<button
										type='button'
										onClick={voiceRecorder.clearPreview}
										className='px-4 py-2 rounded-lg bg-gray-bg text-gray hover:text-black text-sm'
									>
										Удалить
									</button>
									<button
										type='button'
										onClick={handleSendVoice}
										disabled={sendingVoice}
										className='px-5 py-2 rounded-lg bg-main1 text-white font-medium hover:bg-main2 disabled:opacity-50 text-sm'
									>
										{sendingVoice ? 'Отправка…' : 'Отправить'}
									</button>
								</>
							) : (
								<>
									{voiceRecorder.isRecording && (
										<button
											type='button'
											onClick={voiceRecorder.cancelRecording}
											className='px-4 py-2 rounded-lg bg-gray-bg text-gray hover:text-black text-sm'
										>
											Отмена
										</button>
									)}
									<button
										type='button'
										onClick={
											voiceRecorder.isRecording
												? voiceRecorder.stopRecording
												: voiceRecorder.startRecording
										}
										className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
											voiceRecorder.isRecording
												? 'bg-red-500 hover:bg-red-600 text-white'
												: 'bg-main1 hover:bg-main2 text-white'
										}`}
										title={
											voiceRecorder.isRecording
												? 'Остановить запись'
												: 'Начать запись'
										}
										aria-label={
											voiceRecorder.isRecording
												? 'Остановить запись'
												: 'Начать запись'
										}
									>
										{voiceRecorder.isRecording ? (
											<span className='w-4 h-4 bg-white rounded-sm' />
										) : (
											<svg
												className='w-6 h-6'
												fill='currentColor'
												viewBox='0 0 24 24'
											>
												<path d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z' />
											</svg>
										)}
									</button>
								</>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
