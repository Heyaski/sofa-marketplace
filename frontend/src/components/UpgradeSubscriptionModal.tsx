'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import PaymentModal from './PaymentModal'
import { subscriptionService } from '@/services/api'
import { Plan } from '@/types'

interface UpgradeSubscriptionModalProps {
	isOpen: boolean
	onClose: () => void
	currentSubscription: 'trial' | 'basic' | 'premium'
	message?: string
}

interface SubscriptionPlan {
	id: string
	name: string
	price: string
	features: string
	image: string
	downloadLimit: number | null
}

// Пробная подписка не хранится в базе, добавляем её вручную
const trialPlan: SubscriptionPlan = {
	id: 'trial',
	name: 'Пробная',
	price: 'БЕСПЛАТНО',
	features: 'Пробное скачивание 3-х моделей',
	image: '/img/test_subscriptions.svg',
	downloadLimit: 3,
}

export default function UpgradeSubscriptionModal({
	isOpen,
	onClose,
	currentSubscription,
	message,
}: UpgradeSubscriptionModalProps) {
	const [plans, setPlans] = useState<SubscriptionPlan[]>([])
	const [loading, setLoading] = useState(true)
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
	const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{
		id: string
		name: string
		price: string
	} | null>(null)

	// Загружаем планы подписок при открытии модального окна
	useEffect(() => {
		if (isOpen) {
			const fetchPlans = async () => {
				try {
					const plansResponse = await subscriptionService.getPlans()

					// Преобразуем планы из API в формат для компонента
					const plansList: SubscriptionPlan[] = [trialPlan]

					// Маппинг изображений для планов
					const planImages: Record<string, string> = {
						basic: '/img/base_subscriptions.svg',
						premium: '/img/premium_subscriptions.svg',
					}

					// Маппинг лимитов скачиваний
					const planLimits: Record<string, number | null> = {
						basic: 10,
						premium: null,
					}

					// Добавляем планы из API
					const apiPlans = plansResponse.results || plansResponse
					if (Array.isArray(apiPlans)) {
						apiPlans.forEach((plan: Plan) => {
							const priceValue = typeof plan.price === 'string' 
								? parseFloat(plan.price) 
								: plan.price
							const formattedPrice = priceValue.toLocaleString('ru-RU', {
								style: 'currency',
								currency: 'RUB',
								minimumFractionDigits: 0,
							}) + '/мес'

							plansList.push({
								id: plan.subscription_type,
								name: plan.name,
								price: formattedPrice,
								features: plan.description || '',
								image: planImages[plan.subscription_type] || '/img/base_subscriptions.svg',
								downloadLimit: planLimits[plan.subscription_type] || null,
							})
						})
					}

					setPlans(plansList)
				} catch (error) {
					console.error('Ошибка при загрузке планов:', error)
					// В случае ошибки используем дефолтные планы
					setPlans([trialPlan])
				} finally {
					setLoading(false)
				}
			}

			fetchPlans()
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleSelectPlan = (planId: string) => {
		const plan = plans.find(p => p.id === planId)
		if (plan && plan.id !== currentSubscription) {
			// Открываем модальное окно оплаты
			setSelectedPlanForPayment({
				id: plan.id,
				name: plan.name,
				price: plan.price,
			})
			setIsPaymentModalOpen(true)
		}
	}

	const handlePaymentSuccess = () => {
		// После успешной оплаты закрываем оба модальных окна
		setIsPaymentModalOpen(false)
		setSelectedPlanForPayment(null)
		onClose()
		// Здесь можно добавить обновление подписки через API
		console.log('Payment successful for plan:', selectedPlanForPayment)
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-3xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto'>
				{/* Header */}
				<div className='flex justify-end items-center mb-6'>
					<button
						onClick={onClose}
						className='text-black hover:text-gray transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Title */}
				<h2 className='text-2xl font-bold text-black mb-4 text-left'>
					Достигнут лимит скачиваний
				</h2>

				{/* Message */}
				{message && (
					<div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
						<p className='text-sm text-yellow-800'>{message}</p>
					</div>
				)}

				{/* Description */}
				<p className='text-gray mb-6'>
					Для продолжения скачивания моделей выберите подходящий план подписки:
				</p>

				{/* Subscription Plans */}
				{loading ? (
					<div className='flex items-center justify-center h-64 mb-6'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
						{plans.map(plan => {
						const isCurrent = plan.id === currentSubscription
						const isUpgrade =
							(currentSubscription === 'trial' && plan.id === 'basic') ||
							(currentSubscription === 'trial' && plan.id === 'premium') ||
							(currentSubscription === 'basic' && plan.id === 'premium')

						return (
							<div
								key={plan.id}
								className={`p-6 text-center flex flex-col border-2 rounded-xl ${
									isCurrent
										? 'border-main1 bg-main1/5'
										: isUpgrade
										? 'border-gray2 hover:border-main1 cursor-pointer transition-colors'
										: 'border-gray2 opacity-50'
								}`}
								onClick={
									isUpgrade ? () => handleSelectPlan(plan.id) : undefined
								}
							>
								{/* Plan name */}
								<h3 className='text-xl font-semibold text-black mb-4'>
									{plan.name}
								</h3>

								{/* Plan image */}
								<div className='mb-4'>
									<div className='w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mx-auto'>
										<Image
											src={plan.image}
											alt={plan.name}
											width={100}
											height={100}
											className='w-full h-full object-contain'
										/>
									</div>
								</div>

								{/* Price */}
								<div className='mb-4'>
									<span className='text-2xl text-black font-bold'>
										{plan.price}
									</span>
								</div>

								{/* Features */}
								<p className='text-black text-sm mb-6 flex-grow'>
									{plan.features}
								</p>

								{/* Badge or Button */}
								{isCurrent ? (
									<div className='px-4 py-2 bg-gray text-white rounded-lg text-sm font-medium'>
										Текущий план
									</div>
								) : isUpgrade ? (
									<button className='bg-main1 text-white px-4 py-2 rounded-lg hover:bg-main2 transition-colors font-medium text-sm'>
										Выбрать
									</button>
								) : (
									<div className='px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium'>
										Недоступно
									</div>
								)}
							</div>
						)
					})}
					</div>
				)}

				{/* Footer */}
				<div className='flex justify-end'>
					<button
						onClick={onClose}
						className='px-6 py-2 border border-gray2 text-black rounded-lg hover:bg-gray-bg transition-colors'
					>
						Закрыть
					</button>
				</div>
			</div>

			{/* Payment Modal */}
			{selectedPlanForPayment && (
				<PaymentModal
					isOpen={isPaymentModalOpen}
					onClose={() => {
						// При закрытии модального окна оплаты просто закрываем его,
						// но оставляем модальное окно обновления подписки открытым
						setIsPaymentModalOpen(false)
						setSelectedPlanForPayment(null)
					}}
					onPaymentSuccess={handlePaymentSuccess}
					planName={selectedPlanForPayment.name}
					planPrice={selectedPlanForPayment.price}
					planId={selectedPlanForPayment.id}
				/>
			)}
		</div>
	)
}
