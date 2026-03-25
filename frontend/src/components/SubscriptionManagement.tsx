'use client'

import { authService, subscriptionService } from '@/services/api'
import { User, Plan } from '@/types'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import PaymentModal from './PaymentModal'
import TariffDetailsModal from './TariffDetailsModal'

interface SubscriptionPlan {
	id: string
	name: string
	price: string
	priceYearly?: string
	priceYearlyPerMonth?: string
	features: string
	image: string
	isSelected?: boolean
	isCurrent?: boolean
}

const planImages: Record<string, string> = {
	free: '/img/test_subscriptions.svg',
	trial: '/img/test_subscriptions.svg',
	basic: '/img/base_subscriptions.svg',
	pro: '/img/premium_subscriptions.svg',
	premium: '/img/premium_subscriptions.svg',
}

export default function SubscriptionManagement() {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [plans, setPlans] = useState<SubscriptionPlan[]>([])
	const [selectedPlan, setSelectedPlan] = useState<string>('free')
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
	const [isTariffDetailsModalOpen, setIsTariffDetailsModalOpen] = useState(false)
	const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{
		id: string
		name: string
		price: string
		priceYearly?: string
		priceYearlyPerMonth?: string
		billingPeriod: 'monthly' | 'yearly'
	} | null>(null)
	const [isBillingChoiceOpen, setIsBillingChoiceOpen] = useState(false)
	const [pendingPlanForPayment, setPendingPlanForPayment] = useState<{
		id: string
		name: string
		price: string
		priceYearly?: string
		priceYearlyPerMonth?: string
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
				if (userData.profile?.subscription_type) {
					setSelectedPlan(userData.profile.subscription_type)
				}

				// Преобразуем планы из API в формат для компонента
				let apiPlans: Plan[] = []
				if (Array.isArray(plansResponse)) {
					apiPlans = plansResponse
				} else if (plansResponse && typeof plansResponse === 'object' && 'results' in plansResponse) {
					apiPlans = plansResponse.results
				}

				const plansList: SubscriptionPlan[] = apiPlans.map((plan: Plan) => {
					const priceValue = typeof plan.price === 'string' ? parseFloat(plan.price) : Number(plan.price)
					const priceYearly = plan.price_yearly != null ? Number(plan.price_yearly) : null
					const priceYearlyPerMonth = plan.price_yearly_per_month != null ? Number(plan.price_yearly_per_month) : null
					const formattedPrice = priceValue === 0
						? 'Бесплатно'
						: priceValue.toLocaleString('ru-RU', {
								style: 'currency',
								currency: 'RUB',
								minimumFractionDigits: 0,
							}) + '/мес'
					const formattedYearly = priceYearly != null && priceYearly > 0
						? priceYearly.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 })
						: undefined
					const formattedYearlyPerMonth = priceYearlyPerMonth != null && priceYearlyPerMonth > 0
						? priceYearlyPerMonth.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }) + '/мес'
						: undefined
					return {
						id: plan.subscription_type,
						name: plan.name,
						price: formattedPrice,
						priceYearly: formattedYearly,
						priceYearlyPerMonth: formattedYearlyPerMonth,
						features: plan.limits || plan.description || '',
						image: planImages[plan.subscription_type] || '/img/base_subscriptions.svg',
					}
				})

				setPlans(plansList)
			} catch (error) {
				console.error('Ошибка при загрузке данных:', error)
				setPlans([])
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

			if (paymentSuccess === 'true') {
				try {
					// Обновляем данные пользователя в любом случае (webhook мог уже обработать платеж)
					const userData = await authService.getCurrentUser()
					setUser(userData)
					if (userData.profile?.subscription_type) {
						setSelectedPlan(userData.profile.subscription_type)
					}

					// Если есть pendingPaymentId, проверяем статус
					if (pendingPaymentId) {
						try {
							const paymentStatus = await subscriptionService.checkPaymentStatus(
								pendingPaymentId
							)

							if (paymentStatus.paid && paymentStatus.subscription_activated) {
								// Обновляем данные еще раз после проверки
								const updatedUserData = await authService.getCurrentUser()
								setUser(updatedUserData)
								if (updatedUserData.profile?.subscription_type) {
									setSelectedPlan(updatedUserData.profile.subscription_type)
								}
								alert('Подписка успешно активирована!')
							} else if (paymentStatus.paid && !paymentStatus.subscription_activated) {
								alert(
									'Платеж успешен, но произошла ошибка при активации подписки. Обратитесь в поддержку.'
								)
							} else {
								alert('Платеж еще не обработан. Подписка будет активирована автоматически через webhook.')
							}
						} catch (error: any) {
							console.error('Ошибка при проверке статуса платежа:', error)
							// Если проверка не удалась, но данные пользователя обновились, значит webhook уже сработал
							if (userData.profile?.subscription_type && userData.profile.subscription_type !== 'trial') {
								alert('Подписка успешно активирована!')
							} else {
								alert(
									'Платеж обрабатывается. Подписка будет активирована автоматически.'
								)
							}
						}
						
						// Очищаем localStorage
						localStorage.removeItem('pending_payment_id')
						localStorage.removeItem('pending_payment_plan')
					} else {
						// Нет pendingPaymentId, но есть payment_success - значит webhook уже обработал
						if (userData.profile?.subscription_type && userData.profile.subscription_type !== 'trial') {
							alert('Подписка успешно активирована!')
						}
					}
				} catch (error: any) {
					console.error('Ошибка при обновлении данных пользователя:', error)
				}
			}
		}

		checkPaymentStatus()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Запускаем только один раз при монтировании компонента

	const currentSubscription = user?.profile?.subscription_type || 'free'

	const handleSelectPlan = (planId: string) => {
		if (planId === 'free' || planId === 'trial') return // Не оплачиваются
		const plan = plans.find(p => p.id === planId)
		if (plan && planId !== currentSubscription) {
			// Если есть годовой тариф — показываем выбор периода
			if (plan.priceYearly && plan.priceYearlyPerMonth) {
				setPendingPlanForPayment({
					id: plan.id,
					name: plan.name,
					price: plan.price,
					priceYearly: plan.priceYearly,
					priceYearlyPerMonth: plan.priceYearlyPerMonth,
				})
				setIsBillingChoiceOpen(true)
			} else {
				setSelectedPlanForPayment({
					id: plan.id,
					name: plan.name,
					price: plan.price,
					billingPeriod: 'monthly',
				})
				setIsPaymentModalOpen(true)
			}
		}
	}

	const handleChooseBillingPeriod = (billingPeriod: 'monthly' | 'yearly') => {
		if (!pendingPlanForPayment) return
		const price = billingPeriod === 'yearly' && pendingPlanForPayment.priceYearly
			? pendingPlanForPayment.priceYearly
			: pendingPlanForPayment.price
		setSelectedPlanForPayment({
			...pendingPlanForPayment,
			price,
			billingPeriod,
		})
		setPendingPlanForPayment(null)
		setIsBillingChoiceOpen(false)
		setIsPaymentModalOpen(true)
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
		setPendingPlanForPayment(null)
		console.log('Payment successful for plan:', selectedPlanForPayment)
	}

	return (
		<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
			<div className='mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
				<h1 className='text-3xl font-bold text-black'>Управление подпиской</h1>
				<button
					onClick={() => setIsTariffDetailsModalOpen(true)}
					className='text-main1 hover:text-main2 font-medium text-sm sm:text-base whitespace-nowrap'
				>
					Подробное описание
				</button>
			</div>

			{loading ? (
				<div className='flex items-center justify-center h-64'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
				</div>
			) : (
				<div className='bg-white rounded-xl overflow-hidden'>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-x divide-gray-300'>
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
									{(plan.id === 'free' || plan.id === 'trial') ? (
										<button
											className={`w-full py-3 px-4 rounded-lg font-medium ${
												isCurrent ? 'bg-gray text-white cursor-not-allowed' : 'bg-gray-bg text-black cursor-default'
											}`}
											disabled={!isCurrent}
										>
											{isCurrent ? 'Текущий тариф' : 'Бесплатно'}
										</button>
									) : (
										<button
											onClick={() => handleSelectPlan(plan.id)}
											className={`w-full py-3 px-4 rounded-lg font-medium ${
												isCurrent
													? 'bg-gray text-white cursor-not-allowed'
													: 'bg-main1 text-white hover:bg-main2'
											}`}
											disabled={isCurrent}
										>
											{isCurrent ? 'Текущий тариф' : 'Выбрать'}
										</button>
									)}
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Billing period choice modal */}
			{isBillingChoiceOpen && pendingPlanForPayment && (
				<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
					<div className='bg-white rounded-xl p-6 max-w-md w-full shadow-xl'>
						<h3 className='text-xl font-bold text-black mb-4'>Выберите период оплаты</h3>
						<p className='text-gray text-sm mb-6'>{pendingPlanForPayment.name}</p>
						<div className='space-y-3'>
							<button
								onClick={() => handleChooseBillingPeriod('monthly')}
								className='w-full p-4 border-2 border-main1 rounded-lg text-left hover:bg-main1/5 transition-colors'
							>
								<span className='font-medium text-black block'>За месяц</span>
								<span className='text-main1'>{pendingPlanForPayment.price}</span>
							</button>
							<button
								onClick={() => handleChooseBillingPeriod('yearly')}
								className='w-full p-4 border-2 border-main1 rounded-lg text-left hover:bg-main1/5 transition-colors'
							>
								<span className='font-medium text-black block'>За год</span>
								<span className='text-main1'>{pendingPlanForPayment.priceYearly}</span>
								{pendingPlanForPayment.priceYearlyPerMonth && (
									<span className='text-gray text-sm block mt-1'>
										{pendingPlanForPayment.priceYearlyPerMonth} — экономия
									</span>
								)}
							</button>
						</div>
						<button
							onClick={() => {
								setIsBillingChoiceOpen(false)
								setPendingPlanForPayment(null)
							}}
							className='mt-4 w-full py-2 text-gray hover:text-black'
						>
							Отмена
						</button>
					</div>
				</div>
			)}

			{/* Tariff Details Modal */}
			<TariffDetailsModal
				isOpen={isTariffDetailsModalOpen}
				onClose={() => setIsTariffDetailsModalOpen(false)}
			/>

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
					billingPeriod={selectedPlanForPayment.billingPeriod}
				/>
			)}
		</div>
	)
}
