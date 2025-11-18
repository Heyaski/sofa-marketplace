'use client'

import { authService } from '@/services/api'
import { User } from '@/types'
import {
	formatCardCVV,
	formatCardExpiry,
	formatCardHolder,
	formatCardNumber,
	validateCardData,
} from '@/utils/cardValidation'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

interface PaymentModalProps {
	isOpen: boolean
	onClose: () => void
	onPaymentSuccess: () => void
	planName: string
	planPrice: string
	planId: string
}

export default function PaymentModal({
	isOpen,
	onClose,
	onPaymentSuccess,
	planName,
	planPrice,
	planId,
}: PaymentModalProps) {
	const [user, setUser] = useState<User | null>(null)
	const [showNewCardForm, setShowNewCardForm] = useState(false)
	const [selectedCard, setSelectedCard] = useState<'saved' | 'new'>('saved')
	const [loading, setLoading] = useState(false)

	// Данные новой карты
	const [newCardData, setNewCardData] = useState({
		card_number: '',
		card_holder: '',
		card_expiry: '',
		card_cvv: '',
		remember_card: true,
	})

	useEffect(() => {
		if (isOpen) {
			fetchUser()
		}
	}, [isOpen])

	const fetchUser = async () => {
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
			// Если у пользователя нет сохраненной карты, показываем форму новой карты
			if (
				!userData.profile?.card_number ||
				userData.profile.card_number.trim() === ''
			) {
				setShowNewCardForm(true)
				setSelectedCard('new')
			} else {
				setShowNewCardForm(false)
				setSelectedCard('saved')
			}
		} catch (error) {
			console.error('Ошибка при загрузке пользователя:', error)
			// При ошибке показываем форму новой карты
			setShowNewCardForm(true)
			setSelectedCard('new')
		}
	}

	const hasSavedCard = () => {
		return user?.profile?.card_number && user.profile.card_number.trim() !== ''
	}

	const getCardType = (cardNumber: string): string => {
		if (!cardNumber) return 'Visa'
		const number = cardNumber.replace(/\s/g, '')
		if (number.startsWith('4')) return 'Visa'
		if (number.startsWith('5')) return 'MasterCard'
		if (number.startsWith('2')) return 'MIR'
		return 'Visa'
	}

	const getMaskedCardNumber = () => {
		if (!user?.profile?.card_number) return ''
		const cardNumber = user.profile.card_number.replace(/\s/g, '')
		if (cardNumber.length >= 4) {
			return `**** **** **** ${cardNumber.slice(-4)}`
		}
		return '**** **** **** ****'
	}

	const handlePayment = async () => {
		// Если выбрана новая карта, валидируем данные
		if (selectedCard === 'new') {
			const cardErrors = validateCardData({
				card_number: newCardData.card_number,
				card_holder: newCardData.card_holder,
				card_expiry: newCardData.card_expiry,
				card_cvv: newCardData.card_cvv,
			})

			if (cardErrors) {
				// Показываем первую ошибку
				const firstError = Object.values(cardErrors)[0]
				alert(firstError)
				return
			}
		}

		setLoading(true)
		try {
			// Если выбрана новая карта, сначала сохраняем её в профиль
			if (selectedCard === 'new' && newCardData.remember_card) {
				await authService.updateUser({
					profile: {
						subscription_type: user?.profile?.subscription_type || 'trial',
						card_number: newCardData.card_number,
						card_holder: newCardData.card_holder,
						card_expiry: newCardData.card_expiry,
						card_cvv: newCardData.card_cvv,
						chat_notifications: user?.profile?.chat_notifications ?? true,
						new_models_notifications:
							user?.profile?.new_models_notifications ?? false,
					},
				})
			}

			// Здесь будет логика оплаты подписки через API
			// Пока что просто имитируем успешную оплату
			await new Promise(resolve => setTimeout(resolve, 1000))

			onPaymentSuccess()
			onClose()
		} catch (error: any) {
			console.error('Ошибка при оплате:', error)
			alert(error.response?.data?.detail || 'Ошибка при оплате подписки')
		} finally {
			setLoading(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div
				className={`bg-white rounded-3xl ${
					showNewCardForm ? 'max-w-2xl' : 'max-w-lg'
				} w-full p-8 relative`}
			>
				{/* Header */}
				<div className='flex items-center justify-between mb-6'>
					{showNewCardForm ? (
						<button
							onClick={() => {
								setShowNewCardForm(false)
								setSelectedCard('saved')
							}}
							className='flex items-center gap-2 text-gray hover:text-main1 transition-colors'
						>
							<ArrowLeftIcon className='w-5 h-5' />
							<span>Назад</span>
						</button>
					) : (
						<div></div>
					)}
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Title */}
				<h2 className='text-2xl font-bold text-black mb-6 text-left'>
					{showNewCardForm ? 'Оплата подписки новой картой' : 'Оплата подписки'}
				</h2>

				{/* Content */}
				{!showNewCardForm && hasSavedCard() ? (
					<div className='space-y-4'>
						{/* Выбор способа оплаты */}
						<div>
							<label className='block text-sm font-medium text-gray mb-3'>
								Способ оплаты:
							</label>
							<div className='space-y-3'>
								{/* Сохраненная карта */}
								<label className='flex items-center gap-3 p-4 border-2 border-main1 rounded-lg cursor-pointer bg-gray-bg'>
									<input
										type='radio'
										name='payment_method'
										value='saved'
										checked={selectedCard === 'saved'}
										onChange={() => setSelectedCard('saved')}
										className='w-4 h-4 text-main1 focus:ring-main1'
									/>
									<div className='flex-1'>
										<div className='flex items-center justify-between'>
											<span className='font-medium text-black'>
												{getCardType(user?.profile?.card_number || '')} USD
											</span>
										</div>
										<p className='text-sm text-gray mt-1'>
											{getMaskedCardNumber()}
										</p>
									</div>
								</label>

								{/* Кнопка добавления новой карты */}
								<button
									onClick={() => {
										setShowNewCardForm(true)
										setSelectedCard('new')
									}}
									className='w-full p-3 text-left hover:bg-gray-50 transition-colors'
								>
									<span className='text-gray text-sm'>
										+ Добавить другой способ оплаты
									</span>
								</button>
							</div>
						</div>
					</div>
				) : (
					<div className='space-y-4'>
						{/* Форма новой карты - в две строки */}
						{/* Первая строка: Номер карты и Держатель карты */}
						<div className='grid grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-gray mb-2'>
									Номер карты
								</label>
								<input
									type='text'
									value={newCardData.card_number}
									onChange={e => {
										const formatted = formatCardNumber(e.target.value)
										setNewCardData({
											...newCardData,
											card_number: formatted,
										})
									}}
									placeholder='XXXX - XXXX - XXXX - XXXX'
									maxLength={19}
									className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray mb-2'>
									Держатель карты
								</label>
								<input
									type='text'
									value={newCardData.card_holder}
									onChange={e => {
										const formatted = formatCardHolder(e.target.value)
										setNewCardData({
											...newCardData,
											card_holder: formatted,
										})
									}}
									placeholder='Фамилия и Имя'
									className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								/>
							</div>
						</div>

						{/* Вторая строка: Месяц/год и Код */}
						<div className='grid grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-gray mb-2'>
									Месяц/год
								</label>
								<input
									type='text'
									value={newCardData.card_expiry}
									onChange={e => {
										const formatted = formatCardExpiry(e.target.value)
										setNewCardData({
											...newCardData,
											card_expiry: formatted,
										})
									}}
									placeholder='00 / 00'
									maxLength={5}
									className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray mb-2'>
									Код
								</label>
								<input
									type='text'
									value={newCardData.card_cvv}
									onChange={e => {
										const formatted = formatCardCVV(e.target.value)
										setNewCardData({
											...newCardData,
											card_cvv: formatted,
										})
									}}
									placeholder='***'
									maxLength={4}
									className='w-full px-4 py-3 rounded-lg border border-gray2 bg-gray-bg text-black placeholder-gray focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
								/>
							</div>
						</div>

						{/* Чекбокс "Запомнить карту" */}
						<label className='flex items-center gap-2 cursor-pointer'>
							<input
								type='checkbox'
								checked={newCardData.remember_card}
								onChange={e =>
									setNewCardData({
										...newCardData,
										remember_card: e.target.checked,
									})
								}
								className='w-4 h-4 text-main1 focus:ring-main1 border-gray2 rounded'
							/>
							<span className='text-sm text-black'>Запомнить новую карту</span>
						</label>
					</div>
				)}

				{/* Footer */}
				<div className='mt-8 flex justify-end'>
					<button
						onClick={handlePayment}
						disabled={loading}
						className='bg-main1 text-white px-8 py-3 rounded-lg hover:bg-main2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{loading ? 'Обработка...' : 'Оплатить'}
					</button>
				</div>
			</div>
		</div>
	)
}
