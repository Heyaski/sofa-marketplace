'use client'

import { authService, subscriptionService } from '@/services/api'
import { User, Plan } from '@/types'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import PaymentModal from './PaymentModal'

interface SubscriptionPlan {
	id: string
	name: string
	price: string
	features: string
	image: string
	isSelected?: boolean
	isCurrent?: boolean
}

// Пробная подписка не хранится в базе, добавляем её вручную
const trialPlan: SubscriptionPlan = {
	id: 'trial',
	name: 'Пробная',
	price: 'БЕСПЛАТНО',
	features: 'Пробное скачивание 3-х моделей',
	image: '/img/test_subscriptions.svg',
}

export default function SubscriptionManagement() {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [plans, setPlans] = useState<SubscriptionPlan[]>([])
	const [selectedPlan, setSelectedPlan] = useState<string>('trial')
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
	const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{
		id: string
		name: string
		price: string
	} | null>(null)

	// Загружаем данные пользователя и планы подписок при монтировании компонента
	useEffect(() => {
		const fetchData = async () => {
			try {
				// Загружаем пользователя и планы параллельно
				const [userData, plansResponse] = await Promise.all([
					authService.getCurrentUser(),
					subscriptionService.getPlans(),
				])

				setUser(userData)
				// Устанавливаем текущую подписку из данных пользователя
				if (userData.profile?.subscription_type) {
					setSelectedPlan(userData.profile.subscription_type)
				}

				// Преобразуем планы из API в формат для компонента
				const plansList: SubscriptionPlan[] = [trialPlan]

				// Маппинг изображений для планов
				const planImages: Record<string, string> = {
					basic: '/img/base_subscriptions.svg',
					premium: '/img/premium_subscriptions.svg',
				}

				// Маппинг описаний для планов
				const planFeatures: Record<string, string> = {
					basic: '10 скачиваний в месяц',
					premium: 'Безлимитное скачивание моделей',
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
							features: plan.description || planFeatures[plan.subscription_type] || '',
							image: planImages[plan.subscription_type] || '/img/base_subscriptions.svg',
						})
					})
				}

				setPlans(plansList)
			} catch (error) {
				console.error('Ошибка при загрузке данных:', error)
				// В случае ошибки используем дефолтные планы
				setPlans([trialPlan])
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	// Проверяем статус платежа после возврата с ЮКассы
	useEffect(() => {
		const checkPaymentStatus = async () => {
			// Получаем параметры из URL
			const urlParams = new URLSearchParams(window.location.search)
			const paymentSuccess = urlParams.get('payment_success')
			const pendingPaymentId = localStorage.getItem('pending_payment_id')

			if (paymentSuccess === 'true' && pendingPaymentId) {
				try {
					// Проверяем статус платежа
					const paymentStatus = await subscriptionService.checkPaymentStatus(
						pendingPaymentId
					)

					if (paymentStatus.paid && paymentStatus.subscription_activated) {
						// Обновляем данные пользователя
						const userData = await authService.getCurrentUser()
						setUser(userData)
						if (userData.profile?.subscription_type) {
							setSelectedPlan(userData.profile.subscription_type)
						}

						// Очищаем localStorage
						localStorage.removeItem('pending_payment_id')
						localStorage.removeItem('pending_payment_plan')

						// Показываем сообщение об успехе
						alert('Подписка успешно активирована!')
					} else if (paymentStatus.paid && !paymentStatus.subscription_activated) {
						alert(
							'Платеж успешен, но произошла ошибка при активации подписки. Обратитесь в поддержку.'
						)
					} else {
						alert('Платеж еще не обработан. Подписка будет активирована автоматически.')
					}
				} catch (error: any) {
					console.error('Ошибка при проверке статуса платежа:', error)
					alert(
						'Ошибка при проверке статуса платежа. Если платеж был успешным, подписка будет активирована автоматически.'
					)
				}
			}
		}

		checkPaymentStatus()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Запускаем только один раз при монтировании компонента

	// Определяем текущую подписку пользователя
	const currentSubscription = user?.profile?.subscription_type || 'trial'

	const handleSelectPlan = (planId: string) => {
		const plan = plans.find(p => p.id === planId)
		// Проверяем, что план существует и не является текущим
		if (plan && planId !== currentSubscription) {
			setSelectedPlanForPayment({
				id: plan.id,
				name: plan.name,
				price: plan.price,
			})
			setIsPaymentModalOpen(true)
		}
	}

	const handlePaymentSuccess = async () => {
		// После успешной оплаты обновляем данные пользователя
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
			if (userData.profile?.subscription_type) {
				setSelectedPlan(userData.profile.subscription_type)
			}
		} catch (error) {
			console.error('Ошибка при обновлении данных пользователя:', error)
		}
		// Закрываем модальное окно оплаты
		setIsPaymentModalOpen(false)
		setSelectedPlanForPayment(null)
		console.log('Payment successful for plan:', selectedPlanForPayment)
	}

	return (
		<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold text-black'>Управление подпиской</h1>
			</div>

			{loading ? (
				<div className='flex items-center justify-center h-64'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
				</div>
			) : (
				<div className='bg-white rounded-xl overflow-hidden'>
					<div className='grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-300'>
						{plans.map(plan => {
							const isCurrent = plan.id === currentSubscription
							return (
								<div key={plan.id} className='p-6 text-center flex flex-col'>
									{/* Название плана */}
									<h3 className='text-xl font-semibold text-black mb-4'>
										{plan.name}
									</h3>

									{/* Изображение плана */}
									<div className='mb-4'>
										<div className='w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mx-auto'>
											<Image
												src={plan.image}
												alt={plan.name}
												width={100}
												height={100}
												className='w-full h-full object-contain'
											/>
										</div>
									</div>

									{/* Цена */}
									<div className='mb-4'>
										<span className='text-2xl text-black'>{plan.price}</span>
									</div>

									{/* Описание функций */}
									<p className='text-black text-sm mb-6 flex-grow'>
										{plan.features}
									</p>

									{/* Кнопка выбора */}
									<button
										onClick={() => handleSelectPlan(plan.id)}
										className={`w-full py-3 px-4 rounded-lg font-medium ${
											isCurrent
												? 'bg-gray text-white cursor-not-allowed'
												: 'bg-main1 text-white hover:bg-main2'
										}`}
										disabled={isCurrent}
									>
										{isCurrent ? 'Выбрано' : 'Выбрать'}
									</button>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Payment Modal */}
			{selectedPlanForPayment && (
				<PaymentModal
					isOpen={isPaymentModalOpen}
					onClose={() => {
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
